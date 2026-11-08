import React, { useState } from 'react';
import { BlueprintEditor } from './TemplateBlueprint.jsx';
import { CompositionEditor } from './CompositionEditor.jsx';
import { BLUEPRINT_FAMILIES, BLUEPRINT_VARIANTS, BLUEPRINT_SHELLS } from './templateBlueprint.js';

export const TEMPLATE_FAMILIES = { list: '列表检索', form: '表单向导', detail: '详情阅读', overview: '概览工作台', settings: '设置配置', custom: '自由组合' };
export const templateCapability = template => template.blueprint ? '可配置字段与动作' : template.composition ? '独立区域组合' : '预置流程';

export function BlueprintSummary({ template }) {
  const b = template.blueprint;
  if (!b) return <p className="cv-field-help">保留原有模板内容与预览。需要按项目调整字段与动作时，可采用目录中的可配置模板。</p>;
  return <>
    <dl className="cv-definition-list cv-template-contract"><div><dt>页面任务</dt><dd>{BLUEPRINT_FAMILIES[b.family]} · {BLUEPRINT_VARIANTS[b.family][b.variant]}</dd></div><div><dt>布局框架</dt><dd>{BLUEPRINT_SHELLS[b.shell]} · 窄屏自动重排</dd></div><div><dt>字段与内容</dt><dd>{b.fields.map(f => f.label).join('、')} · {b.records.length} 条示例数据</dd></div><div><dt>主要动作</dt><dd>{b.actions.primaryLabel}{b.actions.secondaryLabel ? ` / ${b.actions.secondaryLabel}` : ''}</dd></div><div><dt>区域顺序</dt><dd>{b.sections.map(id => ({ intro:'页头',filters:'检索条件',content:'主要内容',actions:'操作区' })[id]).join(' → ')}</dd></div></dl>
    <p className="cv-field-help">字段、示例内容和动作随模板保存；采用到项目后可以独立配置。补充区域中的组件独立试用，不与主流程自动连接。</p>
  </>;
}

export function TemplateBehaviors({ template }) {
  const b = template.blueprint;
  if (!b) return <div className="notice">此资产保留原有预览能力。交互步骤请查看“结构与配置”中的模式引用；不将描述文字视为已执行的业务流程。</div>;
  const rules = {
    list: ['输入检索条件后执行查询；查询与清空条件会清除选择。', '表格与卡片展示同一份字段及内容。', b.actions.allowCreate ? '新建时检查必填项，保存后在当前预览中加入记录。' : '当前模板关闭新建动作。', b.actions.allowDelete ? '选择对象后先确认，再从本地预览中删除。' : '当前模板关闭删除动作。'],
    form: ['必填字段未完成时定位错误，保留已经填写的内容。', '分步填写可回退修改；确认后显示本地提交结果。', '切换布局框架不清空输入；重置动作恢复示例初始值。'],
    detail: ['字段与示例对象共同组成详情内容。', '编辑、保存与取消在本地预览内闭环；编辑时校验必填项。', '结构变体改变信息排布，不改变字段及对象内容。'],
  };
  return <section className="cv-behavior-contract"><h3>已连接的本地行为</h3><ul>{rules[b.family].map(rule => <li key={rule}>{rule}</li>)}</ul><h3>逐项检查状态</h3><p>在“页面预览”上方切换正常、加载、空内容、失败和无权限状态，核对提示及恢复路径。</p><h3>接入业务前还需要</h3><p className="muted">真实数据接口、服务端权限、提交与删除接口。当前动作只改变预览数据，刷新后恢复配置中的示例内容。</p></section>;
}

export function ProjectPageConfiguration({ page, template, source, onChange }) {
  const overrides = page.overrides || {};
  const effective = { ...template, ...overrides };
  const patch = changes => onChange({ ...page, overrides: { ...overrides, ...changes } });
  const reset = key => { const next = { ...overrides }; delete next[key]; onChange({ ...page, overrides: next }); };
  const allowedPatterns = new Set(template.patternIds || []);
  const allowedComponents = new Set([...(template.componentIds || []), ...source.patterns.filter(p => allowedPatterns.has(p.id)).flatMap(p => p.componentIds)]);
  const limitedSource = { ...source, components: source.components.filter(c => allowedComponents.has(c.id)), patterns: source.patterns.filter(p => allowedPatterns.has(p.id)) };
  return <div className="cv-project-configuration">
    <p className="notice">仅修改当前项目页面。共享模板、其他页面与其他项目保持各自配置；保存后原验收记录需要复测。</p>
    {template.blueprint ? <><div className="cv-section-heading"><h3>页面内容与行为</h3><span className="cv-status">{overrides.blueprint ? '本页独立配置' : '继承锁定模板'}</span></div><BlueprintEditor value={effective.blueprint} onChange={blueprint => patch({blueprint})}/>{overrides.blueprint && <button className="button" type="button" onClick={() => reset('blueprint')}>恢复锁定模板的字段与动作</button>}</> : <p className="cv-field-help">此旧版模板没有可配置字段契约，继续沿用原流程。可在模板目录采用新版列表、表单或详情模板。</p>}
    {template.composition && <details className="cv-config-details"><summary>补充区域与实例</summary><CompositionEditor composition={effective.composition} source={limitedSource} onChange={composition => patch({composition})}/>{overrides.composition && <button className="button" type="button" onClick={() => reset('composition')}>恢复锁定模板的补充区域</button>}</details>}
  </div>;
}

export function AdoptionForm({ template, doc, onAdopt, onCreate, onClose, onOpenProject }) {
  const [target, setTarget] = useState('new');
  const [name, setName] = useState('');
  const [pageName, setPageName] = useState(template.name);
  const [error, setError] = useState('');
  const project = doc.projects.find(p => p.id === target);
  const locked = project?.snapshot.templates.find(t => t.id === template.id);
  const changed = locked && JSON.stringify(locked) !== JSON.stringify(template);
  return <form className="cv-form" onSubmit={event => {
    event.preventDefault();
    try {
      if (!pageName.trim()) throw new Error('请填写项目页面名称。');
      if (target === 'new') { if (!name.trim()) throw new Error('请填写项目名称。'); onCreate({name: name.trim(), pageName:pageName.trim()}); }
      else onAdopt({projectId: target, templateId:template.id, pageName:pageName.trim()});
    } catch(reason) { setError(reason.message); }
  }}>
    <p>将「{template.name}」用作项目页面，随后可以独立调整内容。</p>
    <label className="field">采用到<select value={target} onChange={e => {setTarget(e.target.value);setError('');}}><option value="new">新建项目</option>{doc.projects.map(p => <option key={p.id} value={p.id}>{p.name} · r{p.snapshot.revision}</option>)}</select></label>
    {target === 'new' && <label className="field">项目名称<input autoFocus required value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="例如：客户协作平台"/></label>}
    <label className="field">页面名称<input required value={pageName} onChange={e => setPageName(e.target.value)} maxLength={100}/></label>
    {target === 'new' ? <p className="notice">新项目锁定当前共享库 r{doc.revision}。此页面从共享模板继承，后续编辑独立保存。</p> : !locked ? <p className="notice">此项目的 r{project?.snapshot.revision} 尚未包含该模板。请先到该项目的“版本与影响”查看并主动升级，再返回采用；也可以新建项目。<button type="button" className="cv-text-link" onClick={() => onOpenProject?.(project.id)}>打开此项目</button></p> : <p className="notice">采用项目已锁定的 r{project.snapshot.revision}，不会升级其他页面。{changed ? '该模板与共享库当前内容不同，本次采用项目中的旧版本。' : '该模板内容与当前共享库一致。'}</p>}
    {error && <p className="cv-form-error" role="alert">{error}</p>}
    <div className="cv-dialog-actions"><button type="button" className="button" onClick={onClose}>取消</button><button type="submit" className="button primary" disabled={target !== 'new' && !locked}>{target === 'new' ? '创建项目并采用' : '采用锁定版本'}</button></div>
  </form>;
}
