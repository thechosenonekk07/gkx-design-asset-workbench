import { UNSAFE_PortalProvider } from 'react-aria';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ComponentPreview } from './ComponentPreview.jsx';
import { FlowPreview, TemplateFlowPreview, canRunFlow, canRunTemplate } from './FlowPreview.jsx';
import {
  upsertAsset, removeAsset, duplicateAsset, createProject,
  recordProjectCheck, removeProjectCheck, createProjectCheckPlan, prepareProjectDelivery, createProjectDeliveryRecord, createProjectFromDelivery, getProjectUpgrade, getUsage, tokenCSS, setProjectTheme, adoptTemplateToProject,
} from './model.js';
import ProjectThemeEditor from './ProjectThemeEditor.jsx';
import ProjectUpgradeReview from './ProjectUpgradeReview.jsx';
import ProjectAcceptancePanel from './ProjectAcceptancePanel.jsx';
import ProjectDeliveryWorkspace from './ProjectDeliveryWorkspace.jsx';
import DeliveryReuseForm from './DeliveryReuseForm.jsx';
import ProjectCheckEditor from './ProjectCheckEditor.jsx';
import { getProjectAcceptance } from './projectAcceptance.js';
import { applyProjectTheme } from './projectTheme.js';
import { CompositionEditor, CompositionPreview } from './CompositionEditor.jsx';
import { compositionFromReferences, deriveCompositionReferences } from './composition.js';
import { createProjectContext, createArchivedProjectContext, projectContextMarkdown } from './projectContext.js';
import { BlueprintEditor, BlueprintPreview } from './TemplateBlueprint.jsx';
import { createTemplatePresets } from './templatePresets.js';
import { templateFamily, resolvePageTemplate, validatePageOverrides } from './templateBlueprint.js';
import { TEMPLATE_FAMILIES, templateCapability, BlueprintSummary, TemplateBehaviors, ProjectPageConfiguration, AdoptionForm } from './TemplateTools.jsx';
import { downloadFile } from './ui.jsx';
import './chain-views.css';

const LAYERS = {
  patterns: { title: '交互模式', singular: '交互模式', subtitle: '将通用组件组织成可复用的任务流程，明确操作、反馈与恢复。' },
  templates: { title: '页面模板', singular: '页面模板', subtitle: '按页面任务找到模板，配置结构、字段与动作，再采用到项目独立调整。' },
  projects: { title: '项目工作区', singular: '项目', subtitle: '从模板创建项目页面，锁定资产版本，记录验收证据并交付。' },
};
const LAYOUTS = { list: '查询列表', form: '信息表单', settings: '设置页面', detail: '详情页面', dashboard: '信息概览', wizard: '分步流程' };
const LAYER_LABELS = { tokens: '基础规范', components: '组件', patterns: '交互模式', templates: '页面模板', projects: '项目' };
const STATUS_LABELS = { passed: '人工通过', failed: '需要修复', pending: '待检查', stale: '需重新检查' };
const array = value => Array.isArray(value) ? value : [];
const makeId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
const find = (doc, layer, id) => array(doc?.[layer]).find(item => item.id === id);
const revisionLabel = revision => `r${revision ?? 0}`;
const dateLabel = value => value ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

function downloadJSON(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DialogFrame({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const node = ref.current;
    if (node && !node.open) node.showModal();
    return () => { if (node?.open) node.close(); };
  }, []);
  return <dialog ref={ref} className={`cv-dialog ${className}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="cv-dialog-head"><h2 id={titleId}>{title}</h2><button className="cv-close" type="button" aria-label="关闭对话框" onClick={onClose}>×</button></div>
    <UNSAFE_PortalProvider getContainer={() => ref.current}>{children}</UNSAFE_PortalProvider>
  </dialog>;
}

function ReferenceLinks({ ids, layer, doc, navigate, empty = '暂无引用', currentDoc }) {
  return array(ids).length ? <div className="cv-reference-list">{ids.map(id => {
    const item = find(doc, layer, id);
    const currentExists = !currentDoc || Boolean(find(currentDoc, layer, id));
    return <button key={id} className="cv-reference" type="button" disabled={!item || !currentExists} onClick={() => navigate(layer, id)}
      title={!currentExists ? '此资产保留在项目快照中，共享库已删除' : `前往${LAYER_LABELS[layer]}：${item?.name || id}`}>
      <span>{item?.name || id}</span><span aria-hidden="true">↗</span>{!currentExists && <small>快照保留</small>}
    </button>;
  })}</div> : <p className="muted cv-compact-copy">{empty}</p>;
}

function ReferencePicker({ legend, items, value, onChange, empty }) {
  const [search, setSearch] = useState('');
  const visible = array(items).filter(item => `${item.name} ${item.kind || ''} ${item.description || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <fieldset className="cv-picker"><legend>{legend} <span>{value.length} 项</span></legend>
    <input className="cv-picker-search" aria-label={`查找${legend}`} placeholder="按名称查找" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if(event.key === 'Enter') event.preventDefault(); }} />
    {visible.length ? <div className="cv-picker-options">{visible.map(item => <label key={item.id}>
      <input type="checkbox" checked={value.includes(item.id)} onChange={event => onChange(event.target.checked ? [...value, item.id] : value.filter(id => id !== item.id))} />
      <span>{item.name}<small>{item.kind || item.description || item.id}</small></span>
    </label>)}</div> : <p className="muted">{search ? '没有匹配的资产。' : empty}</p>}
  </fieldset>;
}

function AssetEditor({ layer, asset, doc, onSave, onClose }) {
  const starter = layer === 'templates' && !asset ? createTemplatePresets(doc)[0] : null;
  const [draft, setDraft] = useState(() => ({
    ...starter, ...asset, name: asset?.name || '', description: asset?.description || '',
    componentIds: array(asset?.componentIds || starter?.componentIds), patternIds: array(asset?.patternIds || starter?.patternIds),
    stepsText: array(asset?.steps).join('\n'), layout: asset?.layout || 'list',
    composition: asset?.composition,
    templateId: asset?.templateId || array(doc.templates)[0]?.id || '',
  }));
  const [error, setError] = useState('');
  const patch = changes => setDraft(old => ({ ...old, ...changes }));
  const submit = event => {
    event.preventDefault();
    if (!draft.name.trim()) return setError('请填写名称。');
    if (layer === 'patterns' && (!draft.componentIds.length || !draft.stepsText.trim())) return setError('交互模式至少需要一个组件和一个操作步骤。');
    if (layer === 'templates' && !draft.componentIds.length && !draft.patternIds.length) return setError('页面模板至少需要一个组件或交互模式。');
    if (layer === 'projects' && !asset && !draft.templateId) return setError('请先创建一个页面模板，再创建项目。');
    const { stepsText, templateId, ...rest } = draft;
    const payload = { ...rest, custom: asset?.custom ?? true, name: draft.name.trim(), description: draft.description.trim() };
    if (layer === 'patterns') payload.steps = stepsText.split('\n').map(step => step.trim()).filter(Boolean);
    if (layer === 'projects' && !asset) payload.templateId = templateId;
    try { onSave(payload); } catch (reason) { setError(reason.message || '保存失败，请检查填写内容。'); }
  };
  return <DialogFrame title={`${asset ? '编辑' : '新建'}${LAYERS[layer].singular}`} onClose={onClose} className={layer === 'templates' ? 'cv-wide-editor' : ''}>
    <form onSubmit={submit} className="cv-form">
      <label className="field">名称<input autoFocus value={draft.name} onChange={event => patch({ name: event.target.value })} maxLength={100} required placeholder={layer === 'patterns' ? '例如：筛选与查询' : layer === 'templates' ? '例如：通用查询列表' : '例如：产品管理后台'} /></label>
      <label className="field">用途说明<textarea value={draft.description} onChange={event => patch({ description: event.target.value })} rows={3} placeholder="说明适用场景与使用边界" /></label>
      {layer === 'patterns' && <>
        <ReferencePicker legend="使用的组件" items={doc.components} value={draft.componentIds} onChange={componentIds => patch({ componentIds })} empty="请先在组件资产中创建组件。" />
        <label className="field">操作步骤<textarea value={draft.stepsText} onChange={event => patch({ stepsText: event.target.value })} rows={5} placeholder={'每行一个步骤，例如：\n填写筛选条件\n执行查询并显示加载反馈\n展示结果或空状态\n调整条件或重置后重新查询'} required /></label>
        <p className="cv-field-help">同时写清成功、空状态、失败与恢复方式，便于模板复用和项目验收。</p>
      </>}
      {layer === 'templates' && <>
        {draft.blueprint ? <>
          <p className="cv-field-help">结构、字段和动作共同保存在此模板中。要创建其他页面类型，可从模板目录选择对应类型，再创建变体。</p>
          <BlueprintEditor value={draft.blueprint} onChange={blueprint => patch({blueprint})}/>
        </> : <>
          <label className="field">页面任务<select value={draft.layout} onChange={event => patch({layout:event.target.value})}>{Object.entries(LAYOUTS).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          {draft.composition && <label className="cv-check-field"><input type="checkbox" checked={!!draft.flowEnabled} onChange={event => patch({flowEnabled:event.target.checked})}/>同时保留预置交互流程（区域内容不会删除）</label>}
        </>}
        <details className="cv-config-details"><summary>引用的交互模式与组件</summary>
          <ReferencePicker legend="采用的交互模式" items={doc.patterns} value={draft.patternIds} onChange={patternIds => patch({patternIds})} empty="尚无交互模式。"/>
          <ReferencePicker legend="采用的组件" items={doc.components} value={draft.componentIds} onChange={componentIds => patch({componentIds})} empty="尚无组件。"/>
        </details>
        <details className="cv-config-details" open={!!draft.composition}><summary>补充区域与重复实例</summary>
          <p className="cv-field-help">添加独立组件或模式，不替换上方主流程。区域顺序、实例与文案持续保留。</p>
          {draft.composition ? <CompositionEditor composition={draft.composition} source={doc} onChange={composition => patch({composition})}/> : <button type="button" className="button" onClick={() => patch({composition:compositionFromReferences({},doc),flowEnabled:!draft.blueprint})}>添加补充区域</button>}
        </details>
      </>}
      {layer === 'projects' && !asset && <>
        <label className="field">首个页面采用的模板<select value={draft.templateId} onChange={event => patch({ templateId: event.target.value })} required><option value="">选择页面模板</option>{array(doc.templates).map(template => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label>
        <div className="notice">创建时锁定当前共享资产 {revisionLabel(doc.revision)}。后续共享库更新不会直接改动项目页面，你可以查看影响后主动升级。</div>
      </>}
      {error && <p className="cv-form-error" role="alert">{error}</p>}
      <div className="cv-dialog-actions"><button className="button" type="button" onClick={onClose}>取消</button><button className="button primary" type="submit">{asset ? '保存修改' : layer === 'projects' ? '创建项目并锁定版本' : '创建资产'}</button></div>
    </form>
  </DialogFrame>;
}

function ComponentComposition({ componentIds, source, onEvent, layout = 'list', compact = false, theme = 'light' }) {
  const components = [...new Set(array(componentIds))].map(id => find(source, 'components', id)).filter(Boolean);
  if (!components.length) return <div className="empty-state">添加组件后，这里显示可操作的组合预览。</div>;
  return <div className={`cv-composition cv-layout-${layout}${compact ? ' cv-composition-compact' : ''}`} style={tokenCSS(source, {}, theme)}>
    {components.map(component => <div key={component.id} style={tokenCSS(source, component.bindings, theme)} className={`cv-component-slot ${['table', 'tree', 'list-box', 'grid-list', 'calendar', 'range-calendar', 'tabs', 'disclosure-group', 'toolbar', 'checkbox-group', 'radio-group', 'drop-zone'].includes(component.kind) ? 'cv-slot-wide' : ''}`}>
      <span className="cv-slot-label">{component.name}</span>
      <ComponentPreview kind={component.kind} config={component.config || {}} compact={compact} onEvent={onEvent} />
    </div>)}
  </div>;
}

function PatternPreview({ pattern, doc, onEvent, theme = 'light' }) {
  const [step, setStep] = useState(0);
  useEffect(() => { setStep(0); }, [pattern.id]);
  const steps = array(pattern.steps);
  const index = Math.min(step, Math.max(0, steps.length - 1));
  if (canRunFlow(pattern, doc)) return <FlowPreview pattern={pattern} source={doc} theme={theme} onEvent={onEvent}/>;
  return <div className="cv-pattern-preview">
    <p className="notice">此自定义组合尚未绑定跨组件业务行为。下方可以操作独立组件，并逐步审阅已定义的流程；这些步骤不会自动执行。</p>
    {steps.length > 0 && <div className="cv-step-preview"><p className="cv-eyebrow">流程演示 · 第 {index + 1} / {steps.length} 步</p><p>{steps[index]}</p>
      <div className="cv-inline-actions"><button className="button" type="button" disabled={index === 0} onClick={() => setStep(old => Math.max(0, old - 1))}>上一步</button>
        <button className="button" type="button" onClick={() => setStep(index === steps.length - 1 ? 0 : index + 1)}>{index === steps.length - 1 ? '从头预览' : '下一步'}</button></div>
    </div>}
    <ComponentComposition componentIds={pattern.componentIds} source={doc} onEvent={onEvent} theme={theme} />
  </div>;
}

function TemplatePreview({ template, source, onEvent, theme = 'light' }) {
  const componentRefs = [...new Set([...(template.componentIds || []), ...(template.patternIds || []).flatMap(id => source.patterns.find(p => p.id === id)?.componentIds || [])])];
  const blueprintSource = {...source,components:componentRefs.map(id => source.components.find(c => c.id === id)).filter(Boolean)};
  if (template.blueprint) return <><BlueprintPreview template={template} blueprint={template.blueprint} source={blueprintSource} theme={theme} onEvent={onEvent}/>{template.composition && <CompositionPreview composition={template.composition} source={source} theme={theme} onEvent={onEvent}/>}</>;
  if (template.composition) return <>{template.flowEnabled && canRunTemplate(template,source) && <TemplateFlowPreview template={template} source={source} theme={theme} onEvent={onEvent}/>}<CompositionPreview composition={template.composition} source={source} theme={theme} onEvent={onEvent}/></>;
  const patterns = array(template.patternIds).map(id => find(source, 'patterns', id)).filter(Boolean);
  const componentIds = [...array(template.componentIds), ...patterns.flatMap(pattern => array(pattern.componentIds))];
  if (canRunTemplate(template, source)) return <TemplateFlowPreview template={template} source={source} theme={theme} onEvent={onEvent}/>;
  return <div className="cv-template-preview">
    <div className="cv-template-preview-head"><strong>{template.name}</strong><span>{LAYOUTS[template.layout] || template.layout || '自定义布局'}</span></div>
    <p className="cv-field-help cv-custom-template-note">此自定义模板展示实际组件组合，尚未绑定跨组件业务行为。</p><ComponentComposition componentIds={componentIds} source={source} onEvent={onEvent} layout={template.layout || 'list'} theme={theme} />
    {!!patterns.length && <details className="cv-preview-patterns"><summary>查看采用的交互流程 · {patterns.length}</summary>{patterns.map(pattern => <div key={pattern.id}><h4>{pattern.name}</h4><ol>{array(pattern.steps).map((step, index) => <li key={index}>{step}</li>)}</ol></div>)}</details>}
  </div>;
}

function DeleteDialog({ layer, asset, doc, onDelete, onClose, navigate }) {
  const usage = layer === 'projects' ? [] : getUsage(doc, layer, asset.id);
  const liveUsage = usage.filter(item => !item.locked);
  const [error, setError] = useState('');
  return <DialogFrame title={`删除${LAYERS[layer].singular}`} onClose={onClose}>
    <p>将删除「{asset.name}」。</p>
    {liveUsage.length ? <div className="notice"><strong>先处理引用，才能删除此资产。</strong><ul>{liveUsage.map(item => <li key={`${item.layer}-${item.id}`}><button type="button" className="cv-text-link" onClick={() => { onClose(); navigate(item.layer, item.id); }}>{LAYER_LABELS[item.layer]} / {item.name} ↗</button></li>)}</ul></div> : <p className="muted">{layer === 'projects' ? `此操作也会移除此项目的页面、快照、人工检查和 ${asset.deliveries?.length || 0} 条交付记录。可先取消，再从顶栏资产库导出完整备份。` : '没有共享资产正在引用它。已锁定的项目快照会保留原内容。'}</p>}
    {error && <p className="cv-form-error" role="alert">{error}</p>}
    <div className="cv-dialog-actions"><button className="button" type="button" onClick={onClose}>取消</button><button className="button danger" type="button" disabled={liveUsage.length > 0} onClick={() => { try { onDelete(); } catch (reason) { setError(reason.message); } }}>删除{LAYERS[layer].singular}</button></div>
  </DialogFrame>;
}

function PageEditor({ project, onSave, onClose, page }) {
  const templates = array(project.snapshot?.templates);
  const [draft,setDraft] = useState(() => ({...page,id:page?.id || makeId('page'),name:page?.name || '',templateId:page?.templateId || templates[0]?.id || ''}));
  const [error,setError] = useState('');
  const template = templates.find(t => t.id === draft.templateId);
  return <DialogFrame title={page ? '编辑当前项目页面' : '添加项目页面'} onClose={onClose} className="cv-wide-editor">
    <form className="cv-form" onSubmit={event => { event.preventDefault(); try {
      if (!draft.name.trim() || !template) throw new Error('请填写页面名称并选择模板。');
      const errors = validatePageOverrides(draft,template,project.snapshot);
      if(errors.length) throw new Error(errors.join(' '));
      onSave({...draft,name:draft.name.trim()});
    } catch(reason) {setError(reason.message);} }}>
      <label className="field">页面名称<input autoFocus required value={draft.name} onChange={e => setDraft({...draft,name:e.target.value})}/></label>
      <label className="field">采用的模板<select disabled={!!page} required value={draft.templateId} onChange={e => setDraft({...draft,templateId:e.target.value,overrides:{}})}>{templates.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
      <p className="cv-field-help">使用项目已锁定的 r{project.snapshot.revision}。已有页面固定来源模板；需要另一种页面任务时，请添加页面，原配置可继续保留。</p>
      {template && <ProjectPageConfiguration key={template.id} page={draft} template={template} source={project.snapshot} onChange={setDraft}/>}
      {error && <p className="cv-form-error" role="alert">{error}</p>}
      <div className="cv-dialog-actions"><button className="button" type="button" onClick={onClose}>取消</button><button className="button primary" type="submit">{page ? '保存本页配置' : '添加页面'}</button></div>
    </form>
  </DialogFrame>;
}

function ProjectView({ project, doc, commit, navigate, notify, deliveryId, theme = 'light' }) {
  const [tab, setTab] = useState(deliveryId ? 'delivery' : 'pages');
  const [reuseRecord, setReuseRecord] = useState(null);
  const [pageId, setPageId] = useState(project.pages?.[0]?.id);
  const [pageEditor, setPageEditor] = useState(null);
  const [checkEditor, setCheckEditor] = useState(null);
  const [deletePage, setDeletePage] = useState(null);
  const [deleteCheck, setDeleteCheck] = useState(null);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [error, setError] = useState('');
  const [interaction, setInteraction] = useState('');
  useEffect(() => { setTab(deliveryId ? 'delivery' : 'pages'); setPageId(project.pages?.[0]?.id); setInteraction(''); setError(''); }, [project.id]);
  useEffect(() => { if(deliveryId)setTab('delivery');setReuseRecord(current=>current?.id === deliveryId ? current : null); }, [deliveryId]);
  const pages = array(project.pages);
  const page = pages.find(item => item.id === pageId) || pages[0];
  const effectiveSnapshot = useMemo(() => applyProjectTheme(project), [project]);
  const baselineTemplate = page ? find(effectiveSnapshot, 'templates', page.templateId) : null;
  const template = baselineTemplate ? resolvePageTemplate(baselineTemplate,page) : null;
  const checks = array(project.checks);
  const upgrade = getProjectUpgrade(doc, project.id);
  const acceptance = useMemo(() => getProjectAcceptance(project), [project]);
  const updateProject = changes => commit(upsertAsset(doc, 'projects', { ...project, ...changes }));
  const attempt = action => { try { action(); setError(''); } catch (reason) { setError(reason.message); } };
  const exportProject = mode => attempt(() => {
    const payload = { ...prepareProjectDelivery(doc, project.id, {mode}), designContext: createProjectContext(doc, project.id) };
    downloadJSON(`${project.name.replace(/[\\/:*?"<>|]/g, '-')}-${mode === 'reviewed' ? '人工验收交付' : '协作草稿'}.json`, payload);
    notify?.(mode === 'reviewed' ? '已导出本版人工验收交付包及完整证据历史。' : '已导出协作草稿，检查缺项与真实状态一并保留。');
  });
  const generateChecks = pageId => attempt(() => {const next=createProjectCheckPlan(doc,project.id,pageId ? {pageId} : {});commit(next);notify?.('基础检查已补齐，请按实际页面逐项记录结果。');});
  const archiveDelivery = options => {
    const next=createProjectDeliveryRecord(doc,project.id,options);
    const record=find(next,'projects',project.id).deliveries.at(-1);
    commit(next);
    notify?.('交付记录已保存，可回看当时的页面、依据和后续变化。');
    return record.id;
  };
  const exportArchivedDelivery = record => attempt(() => {
    const designContext=createArchivedProjectContext(record);
    downloadJSON(`${record.title.replace(/[\\/:*?"<>|]/g,'-')}-${record.id}.json`,{...record.package,delivery:{id:record.id,title:record.title,note:record.note,createdAt:record.createdAt},designContext});
    notify?.('已按留档版本导出，保留原交付时间及证据。');
  });

  const origin=project.derivedFrom;
  const originExists=origin && doc.projects.find(item=>item.id === origin.projectId)?.deliveries?.some(item=>item.id === origin.deliveryId);
  const reuseDelivery=options=>{
    const id=makeId('project');
    const next=createProjectFromDelivery(doc,project.id,reuseRecord.id,{...options,id});
    commit(next);
    setReuseRecord(null);
    navigate('projects',id);
    notify?.('独立项目已创建，页面配置已复用，检查从待检查开始。');
  };

  return <div className="cv-project-detail">
    {origin && <section className="dl-origin" aria-label="项目复用来源"><div><strong>从交付版本继续设计</strong><p>来源：{origin.projectName} / {origin.deliveryTitle} · r{origin.baselineRevision} / d{origin.designRevision}</p><p>创建时复用了 {origin.pages.length} 个页面。原项目的验收结论保留在来源记录中。</p></div>{originExists ? <button type="button" className="cv-text-link" onClick={()=>navigate('projects',origin.projectId,{deliveryId:origin.deliveryId})}>查看来源交付记录</button> : <span className="cv-field-help">来源记录已不在本机库中，来源信息与本项目配置仍保留。</span>}</section>}
    <div className="cv-project-baseline"><span>当前锁定 <strong>{revisionLabel(project.snapshot?.revision)}</strong></span><span>共享库 <strong>{revisionLabel(doc.revision)}</strong></span><button className="cv-text-link" type="button" onClick={() => setTab('versions')}>{upgrade.hasChanges ? `${upgrade.changes.length} 项引用资产有更新` : '引用资产无待升级变更'}</button></div>
    <div className="subnav cv-tabs" aria-label="项目内容">{[['pages', '页面'], ['theme', '主题与风格'], ['versions', '版本与影响'], ['checks', `人工验收${checks.length ? ` ${checks.length}` : ''}`], ['delivery', '交付']].map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    {error && <p className="cv-form-error" role="alert">{error}</p>}
    {tab === 'theme' && <ProjectThemeEditor project={project} theme={theme} onSave={overrides => { commit(setProjectTheme(doc, project.id, overrides)); notify?.('项目规范已保存；原验收标记为待复验。'); }}/>}
    {tab === 'pages' && <div className="cv-project-pages">
      {acceptance.totals.stale > 0 && <div className="ac-change-note"><p>当前设计有 {acceptance.totals.stale} 项旧检查需要复验。</p><button className="cv-text-link" type="button" onClick={() => setTab('checks')}>查看检查与复验 →</button></div>}
      <div className="cv-section-heading"><h3>项目页面 <span>{pages.length}</span></h3><button className="button" type="button" onClick={() => setPageEditor({})} disabled={!array(project.snapshot?.templates).length}>添加页面</button></div>
      {pages.length ? <>
        <div className="cv-page-list">{pages.map(item => <button key={item.id} type="button" className={page?.id === item.id ? 'active' : ''} onClick={() => { setPageId(item.id); setInteraction(''); }}>{item.name}</button>)}</div>
        <div className="cv-section-heading"><div><h3>{page.name}</h3><p className="muted cv-compact-copy">采用 {template?.name || page.templateId} · 基线 {revisionLabel(project.snapshot?.revision)} / 设计修订 d{project.designRevision ?? 1}</p></div><div className="cv-inline-actions"><button type="button" className="cv-text-link" onClick={() => setPageEditor(page)}>编辑当前页面</button><button type="button" className="cv-text-link cv-danger-text" onClick={() => setDeletePage(page)}>删除页面</button></div></div>
        {template ? <TemplatePreview key={`${page.id}-${project.snapshot?.revision}-${project.designRevision ?? 1}`} template={template} source={effectiveSnapshot} theme={theme} onEvent={event => setInteraction(String(event))} /> : <div className="notice">当前项目快照中缺少模板，请检查导入数据或升级项目。</div>}
        {interaction && <p className="cv-interaction" role="status">预览交互：{interaction}</p>}
        <div className="cv-reference-section"><h4>来源模板</h4><ReferenceLinks ids={[page.templateId]} layer="templates" doc={project.snapshot} currentDoc={doc} navigate={navigate} /><p className="cv-field-help">来源链接打开共享库当前版本；上方预览仍使用项目锁定的版本。</p></div>
      </> : <div className="empty-state">项目还没有页面。从已锁定的模板添加一个页面，开始设计与验收。</div>}
    </div>}
    {tab === 'versions' && <section className="cv-version-section">
      <h3>先查看影响，再升级项目</h3>{!!upgrade.availableTemplateIds?.length && <p className="notice">共享库新增 {upgrade.availableTemplateIds.length} 个可采用模板。升级基线后，这些模板才能加入当前项目。</p>}<p className="muted">共享规范的调整会联动共享组件、模式和模板。已锁定的项目保留原版本，直到你主动采用更新。</p>
      {upgrade.hasChanges ? <>
        <div className="cv-table-wrap"><table className="data-table cv-table"><thead><tr><th>引用资产</th><th>层级</th><th>变更</th></tr></thead><tbody>{upgrade.changes.map(change => <tr key={`${change.layer}-${change.id}`}><td>{change.name || change.id}</td><td>{LAYER_LABELS[change.layer] || change.layer}</td><td>{({ added: '新增', modified: '修改', removed: '移除' })[change.change] || change.change}</td></tr>)}</tbody></table></div>
        <p>受影响页面：{array(upgrade.affectedPages).map(item => item.name).join('、') || '请逐页确认引用变化'}</p>
      </> : <div className="notice">项目引用的资产与共享库一致。共享库其他资产的变化不会被列为此项目的升级影响。</div>}
      <div className="cv-version-action"><div><strong>{revisionLabel(project.snapshot?.revision)} → {revisionLabel(doc.revision)}</strong><p className="muted cv-compact-copy">采用更新后，原有检查记录将标记为需重新检查。</p></div><button className="button primary" type="button" disabled={project.snapshot?.revision === doc.revision} onClick={() => setConfirmUpgrade(true)}>审阅差异并升级</button></div>
      {!!project.upgradeReviews?.length && <section className="ur-history"><h4>已采用的升级</h4><ol>{[...project.upgradeReviews].reverse().map(review => <li key={review.id}><strong>r{review.fromRevision} → r{review.toRevision}</strong> · 设计修订 d{review.toDesignRevision}<span> · {review.decisions.filter(item => item.resolution === 'reviewed').length} 项人工选择</span><details><summary>查看本次选择</summary>{review.decisions.length ? <ul>{review.decisions.map(item => <li key={`${item.pageId}-${item.entryId}`}>{pages.find(page => page.id === item.pageId)?.name || item.pageId} · {item.label || item.entryId}：{item.choice === 'local' ? '保留本页' : '采用共享新版'}（{item.resolution === 'reviewed' ? '人工选择' : '自动合并'}）</li>)}</ul> : <p>页面配置未变化；采用了共享资产的新基线。</p>}</details></li>)}</ol></section>}
      <details className="cv-snapshot-details"><summary>锁定的资产明细</summary>{['tokens', 'components', 'patterns', 'templates'].map(layer => <div key={layer}><h4>{LAYER_LABELS[layer]} · {array(project.snapshot?.[layer]).length}</h4>{layer === 'tokens' ? <p className="muted">变量值与引用关系包含在交付 JSON 的 snapshot.tokens 中。</p> : <ReferenceLinks ids={array(project.snapshot?.[layer]).map(item => item.id)} layer={layer} doc={project.snapshot} currentDoc={doc} navigate={navigate} />}</div>)}</details>
    </section>}
    {tab === 'checks' && <ProjectAcceptancePanel project={project} onGenerate={generateChecks} onEdit={setCheckEditor} onDelete={setDeleteCheck} onOpenPage={id => {if(id)setPageId(id);setTab('pages');}} onShowChanges={() => setTab('versions')} onDelivery={() => setTab('delivery')}/>}
    {tab === 'delivery' && <ProjectDeliveryWorkspace project={project} initialRecordId={deliveryId} onSelectRecord={id=>navigate('projects',project.id,{deliveryId:id,reference:false,keepTrail:true})} onReuse={record=>{setReuseRecord(record);navigate('projects',project.id,{deliveryId:record.id,reference:false,keepTrail:true});}} onCreate={archiveDelivery} onExportRecord={exportArchivedDelivery} renderPreview={(storedTemplate,storedSource)=><TemplatePreview template={storedTemplate} source={storedSource} theme={theme}/>} onOpenPage={id=>{setPageId(id);setTab('pages');}} onExport={exportProject} onChecks={() => setTab('checks')} onContextJSON={() => downloadJSON(`${project.id}-design-context.json`, createProjectContext(doc,project.id))} onContextMarkdown={() => downloadFile(`${project.id}-DESIGN.md`, projectContextMarkdown(createProjectContext(doc,project.id)), 'text/markdown')}/>}

    {reuseRecord && <DialogFrame title="从交付版本创建项目" onClose={()=>setReuseRecord(null)}><DeliveryReuseForm record={reuseRecord} onCancel={()=>setReuseRecord(null)} onCreate={reuseDelivery}/></DialogFrame>}
    {pageEditor && <PageEditor project={project} page={pageEditor.id ? pageEditor : null} onClose={() => setPageEditor(null)} onSave={nextPage => { const nextPages = pages.some(item => item.id === nextPage.id) ? pages.map(item => item.id === nextPage.id ? nextPage : item) : [...pages, nextPage]; updateProject({ pages: nextPages }); setPageId(nextPage.id); setPageEditor(null); notify?.('项目页面已保存，采用锁定资产版本。'); }} />}
    {checkEditor && <DialogFrame title={checkEditor.id ? '更新检查与复验记录' : '添加自定义检查'} onClose={() => setCheckEditor(null)}><ProjectCheckEditor project={project} check={checkEditor.id ? checkEditor : null} onClose={() => setCheckEditor(null)} onSave={nextCheck => {commit(recordProjectCheck(doc,project.id,nextCheck));setCheckEditor(null);notify?.('本版检查记录已保存，历史证据继续保留。');}}/></DialogFrame>}

    {deletePage && <DialogFrame title="删除项目页面" onClose={() => setDeletePage(null)}><p>删除「{deletePage.name}」以及属于该页面的人工检查记录？</p>{error && <p role="alert" className="cv-form-error">{error}</p>}<div className="cv-dialog-actions"><button className="button" type="button" onClick={() => setDeletePage(null)}>取消</button><button className="button danger" type="button" onClick={() => attempt(() => { let next = doc; checks.filter(check => check.pageId === deletePage.id).forEach(check => { next = removeProjectCheck(next, project.id, check.id); }); const current = find(next, 'projects', project.id); commit(upsertAsset(next, 'projects', { ...current, pages: pages.filter(item => item.id !== deletePage.id) })); setDeletePage(null); })}>删除页面</button></div></DialogFrame>}
    {deleteCheck && <DialogFrame title="删除人工检查记录" onClose={() => setDeleteCheck(null)}><p>将删除「{deleteCheck.name}」及其证据说明。</p>{error && <p role="alert" className="cv-form-error">{error}</p>}<div className="cv-dialog-actions"><button className="button" type="button" onClick={() => setDeleteCheck(null)}>取消</button><button className="button danger" type="button" onClick={() => attempt(() => { commit(removeProjectCheck(doc, project.id, deleteCheck.id)); setDeleteCheck(null); })}>删除记录</button></div></DialogFrame>}
    {confirmUpgrade && <DialogFrame title="审阅模板与项目差异" className="cv-upgrade-dialog" onClose={() => setConfirmUpgrade(false)}><ProjectUpgradeReview doc={doc} project={project} onClose={() => setConfirmUpgrade(false)} renderPreview={(nextTemplate,source) => <TemplatePreview template={nextTemplate} source={source} theme={theme}/>} onApply={next => {commit(next);setConfirmUpgrade(false);setTab('checks');notify?.('项目已升级，请在下方完成本版复验。历史证据已保留。');}}/></DialogFrame>}
  </div>;
}

export default function ChainViews({ layer, doc, onChange, navigate, notify, selectedId, deliveryId, theme = 'light' }) {
  const info = LAYERS[layer] || LAYERS.patterns;
  const assets = useMemo(() => layer === 'templates' ? [...array(doc[layer])].sort((a,b) => Number(!!b.blueprint)-Number(!!a.blueprint)) : array(doc[layer]), [doc,layer]);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState(selectedId || assets[0]?.id);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [adopting, setAdopting] = useState(null);
  const [family, setFamily] = useState('all');
  const [activeTab, setActiveTab] = useState('preview');
  const [interaction, setInteraction] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setQuery(''); setSelection(selectedId || assets[0]?.id); setActiveTab('preview'); setEditor(null); setDeleting(null); setAdopting(null); setFamily('all'); setInteraction(''); setError(''); }, [layer]);
  useEffect(() => { if (selectedId) { setSelection(selectedId); setQuery(''); setActiveTab('preview'); const target=find(doc,layer,selectedId); if(layer === 'templates' && target && family !== 'all' && templateFamily(target) !== family) setFamily('all'); } }, [selectedId]);
  const visible = useMemo(() => assets.filter(item => (layer !== 'templates' || family === 'all' || templateFamily(item) === family) && `${item.name} ${item.description || ''} ${TEMPLATE_FAMILIES[templateFamily(item)] || ''}`.toLowerCase().includes(query.trim().toLowerCase())), [assets, query, family, layer]);
  const selected = visible.find(item => item.id === selection) || visible[0];
  const commit = next => { onChange(next); setError(''); };
  const select = item => { setSelection(item.id); setActiveTab('preview'); setInteraction(''); navigate(layer, item.id, { reference: false, keepTrail: true }); };
  const saveAsset = payload => {
    const oldIds = new Set(assets.map(item => item.id));
    const next = layer === 'projects' && !editor?.id ? createProject(doc, payload) : upsertAsset(doc, layer, { ...payload, id: editor?.id || makeId(layer.slice(0, -1)) });
    const savedId = editor?.id || array(next[layer]).find(item => !oldIds.has(item.id))?.id;
    commit(next); setEditor(null); setSelection(savedId); navigate(layer, savedId, { reference: false, keepTrail: true }); notify?.(`${info.singular}已保存。`);
  };
  const duplicate = () => {
    try { const oldIds = new Set(assets.map(item => item.id)); const next = duplicateAsset(doc, layer, selected.id, layer === 'templates' ? {derivedFrom:{templateId:selected.id,revision:doc.revision}} : {}); const id = array(next[layer]).find(item => !oldIds.has(item.id))?.id; commit(next); setSelection(id); navigate(layer, id, { reference: false, keepTrail: true }); if(layer === 'templates') setEditor(next.templates.find(item => item.id === id)); notify?.('副本已创建，可继续自定义。'); } catch (reason) { setError(reason.message); }
  };
  const patternsForTemplate = selected && layer === 'templates' ? array(selected.patternIds).map(id => find(doc, 'patterns', id)).filter(Boolean) : [];
  const usedComponents = selected ? [...new Set([...array(selected.componentIds), ...patternsForTemplate.flatMap(item => array(item.componentIds))])] : [];
  const usage = selected && layer !== 'projects' ? getUsage(doc, layer, selected.id) : [];
  return <section className="cv-root">
    <div className="page-head"><div><h1>{info.title}</h1><p>{info.subtitle}</p></div><div className="actions"><button className="button primary" type="button" onClick={() => setEditor({})}>＋ 新建{info.singular}</button></div></div>
    {error && <p className="cv-form-error" role="alert">{error}</p>}
    <div className="cv-chain-layout">
      <aside className="cv-asset-list" aria-label={`${info.title}列表`}>
        <label className="cv-search-label"><span className="cv-sr-only">查找{info.title}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`查找${info.title}`} /></label>
        {layer === 'templates' && <label className="cv-category-filter">页面任务<select value={family} onChange={e => {setFamily(e.target.value);setActiveTab('preview');setInteraction('');}}><option value="all">全部任务 · {assets.length}</option>{Object.entries(TEMPLATE_FAMILIES).map(([id,label]) => {const count=assets.filter(t => templateFamily(t) === id).length;return count ? <option value={id} key={id}>{label} · {count}</option> : null;})}</select></label>}
        <div className="cv-list-summary">{visible.length} {layer === 'projects' ? '个项目' : '项资产'}<span>{layer === 'projects' ? '独立锁定版本' : '通用共享库'}</span></div>
        {visible.length ? <div className="cv-asset-rows">{visible.map(item => <button type="button" key={item.id} className={`cv-asset-row${selected?.id === item.id ? ' active' : ''}`} aria-current={selected?.id === item.id ? 'true' : undefined} onClick={() => select(item)}><strong>{item.name}</strong><span>{item.description || '尚未填写用途说明'}</span><small>{layer === 'patterns' ? `${array(item.componentIds).length} 个组件 · ${array(item.steps).length} 个步骤` : layer === 'templates' ? item.blueprint ? `${TEMPLATE_FAMILIES[templateFamily(item)]} · ${templateCapability(item)}` : item.composition ? `${item.composition.regions.length} 个区域 · ${item.composition.regions.reduce((n, r) => n+r.items.length, 0)} 个实例` : `${LAYOUTS[item.layout] || item.layout || '自定义布局'} · ${array(item.patternIds).length} 个模式` : `${array(item.pages).length} 个页面 · 已锁定 ${revisionLabel(item.snapshot?.revision)}`}</small></button>)}</div> : <div className="empty-state">{query ? '没有匹配结果，试试其他关键词。' : `还没有${info.singular}。点击上方按钮创建。`}</div>}
        {layer === 'projects' && import.meta.env.MODE !== 'github' && <div className="cv-legacy-entry"><span>此前导入的业务内容</span><a href="./legacy.html" target="_blank" rel="noreferrer">历史项目资产 ↗</a><p>原情报系统的组件与走查记录单独保留。</p></div>}
      </aside>
      <div className="cv-asset-detail">
        {selected ? <>
          <div className="cv-detail-header"><div><h2>{selected.name}</h2>{layer === 'templates' && <p className="cv-capability-label">{templateCapability(selected)} · 共享库 {revisionLabel(doc.revision)}{selected.derivedFrom && ` · 派生自 ${find(doc,'templates',selected.derivedFrom.templateId)?.name || selected.derivedFrom.templateId} r${selected.derivedFrom.revision}`}</p>}<p className="muted">{selected.description || '为此资产补充用途说明，便于其他人正确使用。'}</p></div><div className="cv-detail-actions">{layer === 'templates' && <button className="button primary" type="button" onClick={() => setAdopting(selected)}>采用到项目</button>}<button className="button" type="button" onClick={() => setEditor(selected)}>{layer === 'templates' ? '编辑共享模板' : layer === 'projects' ? '编辑信息' : '编辑'}</button>{layer !== 'projects' && <button className="button" type="button" onClick={duplicate}>{layer === 'templates' ? '创建变体' : '创建副本'}</button>}<button className="cv-text-link cv-danger-text" type="button" onClick={() => setDeleting(selected)}>删除</button></div></div>
          {layer === 'projects' ? <ProjectView key={selected.id} deliveryId={selectedId === selected.id ? deliveryId : undefined} project={selected} doc={doc} commit={commit} navigate={navigate} notify={notify} theme={theme} /> : <>
            <div className="subnav cv-tabs" aria-label={`${info.singular}详情`}>{[['preview', layer === 'templates' ? '页面预览' : '组合预览'], ['structure', layer === 'patterns' ? '步骤与引用' : '结构与配置'], ...(layer === 'templates' ? [['behavior','状态与行为']] : []), ['usage', '引用与版本']].map(([id, label]) => <button type="button" key={id} aria-pressed={activeTab === id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>)}</div>
            {activeTab === 'preview' && <div className="cv-preview-section"><p className="cv-field-help">使用当前共享组件真实渲染，可直接操作控件。流程演示用于检查顺序，不会发起业务请求。</p>{layer === 'patterns' ? <PatternPreview key={selected.id} pattern={selected} doc={doc} theme={theme} onEvent={event => setInteraction(String(event))} /> : <TemplatePreview key={selected.id} template={selected} source={doc} theme={theme} onEvent={event => setInteraction(String(event))} />}{interaction && <p className="cv-interaction" role="status">预览交互：{interaction}</p>}</div>}
            {activeTab === 'behavior' && layer === 'templates' && <TemplateBehaviors template={selected}/>}
            {activeTab === 'structure' && <div className="cv-structure-section">{layer === 'patterns' && <><h3>操作与反馈步骤</h3><ol className="cv-process-list">{array(selected.steps).map((step, index) => <li key={index}><span>{index + 1}</span><p>{step}</p></li>)}</ol></>}{layer === 'templates' && <><BlueprintSummary template={selected}/><h3>页面结构</h3><p>{selected.blueprint ? templateCapability(selected) : selected.composition ? '自定义区域组合' : LAYOUTS[selected.layout] || selected.layout || '自定义布局'}</p>{selected.composition && <ol>{selected.composition.regions.map(region => <li key={region.id}>{region.title || '未命名区域'} · {region.columns} 列 · {region.items.length} 个实例</li>)}</ol>}<h3>采用的交互模式</h3><ReferenceLinks ids={selected.patternIds} layer="patterns" doc={doc} navigate={navigate} empty="此模板直接组合组件，尚未采用交互模式。" /></>}<h3>{layer === 'patterns' ? '组成此模式的组件' : '页面实际使用的组件'}</h3><ReferenceLinks ids={usedComponents} layer="components" doc={doc} navigate={navigate} /><p className="cv-field-help">点击具体资产查看其配置。返回后仍可继续查看当前{info.singular}。</p></div>}
            {activeTab === 'usage' && <div className="cv-usage-section"><h3>引用此{info.singular}的资产</h3>{usage.length ? <div className="cv-usage-list">{usage.map(item => <button key={`${item.layer}-${item.id}`} type="button" className="cv-usage-row" onClick={() => navigate(item.layer, item.id)}><span><strong>{item.name}</strong><small>{LAYER_LABELS[item.layer]} · {item.locked ? '项目快照，需主动升级' : item.direct ? '直接引用' : '间接引用'}</small></span><span aria-hidden="true">↗</span></button>)}</div> : <div className="empty-state">暂时没有其他资产引用它。可在{layer === 'patterns' ? '页面模板' : '项目工作区'}中选择此{info.singular}。</div>}</div>}
          </>}
        </> : <div className="empty-state">{selectedId && !assets.some(item => item.id === selectedId) ? '目标资产已不存在，请从左侧选择其他资产。' : `选择一个${info.singular}查看内容，或创建新的资产。`}</div>}
      </div>
    </div>
    {adopting && <DialogFrame title="采用模板到项目" onClose={() => setAdopting(null)}><AdoptionForm template={adopting} doc={doc} onClose={() => setAdopting(null)} onOpenProject={id => {setAdopting(null);navigate('projects',id);}} onAdopt={options => {const next=adoptTemplateToProject(doc,options);commit(next);setAdopting(null);navigate('projects',options.projectId);notify?.('页面已采用，可在项目中独立配置。');}} onCreate={({name,pageName}) => {const id=makeId('project');const next=createProject(doc,{id,name,templateId:adopting.id,pages:[{id:makeId('page'),name:pageName,templateId:adopting.id}]});commit(next);setAdopting(null);navigate('projects',id);notify?.('项目与首个页面已创建。');}}/></DialogFrame>}
    {editor && <AssetEditor key={`${layer}-${editor.id || 'new'}`} layer={layer} asset={editor.id ? editor : null} doc={doc} onSave={saveAsset} onClose={() => setEditor(null)} />}
    {deleting && <DeleteDialog layer={layer} asset={deleting} doc={doc} navigate={navigate} onClose={() => setDeleting(null)} onDelete={() => { const next = removeAsset(doc, layer, deleting.id); commit(next); setDeleting(null); const id = array(next[layer])[0]?.id; setSelection(id); navigate(layer, id, { reference: false, keepTrail: true }); notify?.(`${info.singular}已删除。`); }} />}
  </section>;
}
