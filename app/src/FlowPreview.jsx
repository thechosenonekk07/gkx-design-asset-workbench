import React, { useMemo, useState } from 'react';
import * as R from 'react-aria-components';
import { tokenCSS } from './model.js';
import { ComponentPreview } from './ComponentPreview.jsx';
import { AssetButton, normalizeButtonConfig } from './AssetButton.jsx';
import { COMPONENT_CATALOG } from './componentRegistry.js';
import './flow-preview.css';

const FLOW_NAMES = {
  'p-search-filter': 'search', 'p-form-submit': 'form', 'p-confirm-action': 'confirm',
  'p-settings': 'settings', 'p-selection': 'selection', 'p-multistep': 'wizard',
};
const REQUIRED = {
  search: ['search-field', 'select', 'button', 'table'], form: ['text-field', 'select', 'checkbox', 'button'],
  confirm: ['button', 'alert-dialog'], settings: ['tabs', 'switch', 'radio-group', 'button'],
  selection: ['table', 'checkbox', 'button', 'menu'], wizard: ['text-field', 'radio-group', 'progress-bar', 'button'],
};
const byId = (source, id) => source.components.find(item => item.id === id);
const catalogConfig = kind => COMPONENT_CATALOG.find(item => item.kind === kind)?.config || {};
// Scene wording replaces the untouched specimen defaults; user-supplied copy wins.
function sceneValue(ctx, kind, key, fallback) {
  const value = ctx.config(kind)[key];
  const original = catalogConfig(kind)[key];
  return value == null || JSON.stringify(value) === JSON.stringify(original) ? fallback : value;
}
export function flowType(pattern) {
  return pattern?.behavior || Object.entries(FLOW_NAMES).find(([id]) => pattern?.id === id || pattern?.id?.startsWith(`${id}-copy`))?.[1];
}
export function canRunFlow(pattern, source) {
  const type = flowType(pattern);
  const kinds = (pattern?.componentIds || []).map(id => byId(source, id)?.kind);
  return !!REQUIRED[type]?.every(kind => kinds.includes(kind));
}

function context(pattern, source, theme, onEvent) {
  const assets = (pattern.componentIds || []).map(id => byId(source, id)).filter(Boolean);
  const get = kind => assets.find(item => item.kind === kind);
  return { source, theme, get, config: kind => get(kind)?.config || {}, css: kind => {
    const asset = get(kind);
    const size = asset?.config?.size;
    return { ...tokenCSS(source, asset?.bindings || {}, theme), ...(size === 'small' ? { '--ap-control-height': '28px' } : size === 'large' ? { '--ap-control-height': '44px' } : {}) };
  }, report: text => onEvent?.(text) };
}
function Scope({ ctx, kind, children, className = '' }) {
  return <div className={`fp-scope ${className}`} style={ctx.css(kind)} data-size={ctx.config(kind).size || 'medium'}>{children}</div>;
}
function Action({ ctx, children, secondary, danger, disabled, onPress, type = 'button', ...props }) {
  const config = normalizeButtonConfig(ctx.config('button'));
  const scene = danger ? { variant: 'base', theme: 'danger' } : secondary ? { variant: 'outline', theme: 'default' } : {};
  return <AssetButton {...props} config={{ ...config, ...scene }} type={type} style={ctx.css('button')} disabled={config.disabled || !!disabled} onPress={onPress}>{children}</AssetButton>;
}
function Check({ children, ...props }) {
  return <R.Checkbox className="ap-checkbox" {...props}>{({ isSelected, isIndeterminate }) => <><span className="ap-check" aria-hidden="true">{isIndeterminate ? '−' : isSelected ? '✓' : ''}</span>{children}</>}</R.Checkbox>;
}
function SelectField({ ctx, value, onChange, includeAll = false }) {
  const config = ctx.config('select');
  const options = config.options?.length ? config.options : ['类别一', '类别二', '类别三'];
  return <Scope ctx={ctx} kind="select"><R.Select className="ap-field" selectedKey={value || null} onSelectionChange={onChange} isDisabled={!!config.disabled} isRequired={!includeAll} placeholder={config.placeholder || '请选择'}>
    <R.Label>{config.label || '分类'}</R.Label><R.Button className="ap-button ap-secondary"><R.SelectValue/><span aria-hidden="true">⌄</span></R.Button>
    <R.Popover className="asset-popover" style={ctx.css('select')}><R.ListBox className="ap-listbox">{includeAll && <R.ListBoxItem id="all" textValue="全部" className="ap-option">全部</R.ListBoxItem>}{options.map((option, index) => <R.ListBoxItem key={index} id={String(option)} textValue={String(option)} className="ap-option">{String(option)}</R.ListBoxItem>)}</R.ListBox></R.Popover>
    <R.FieldError className="ap-error-text"/>
  </R.Select></Scope>;
}
function TextField({ ctx, value, onChange, required = false, error, label, autoFocus }) {
  const config = ctx.config('text-field');
  return <Scope ctx={ctx} kind="text-field"><R.TextField className="ap-field" value={value} onChange={onChange} isDisabled={!!config.disabled} isRequired={required || !!config.required} isInvalid={!!error} validationBehavior="aria">
    <R.Label>{label || config.label || '名称'}{(required || config.required) && ' *'}</R.Label><R.Input autoFocus={autoFocus} className="ap-input" placeholder={config.placeholder || '请输入'} />
    {error ? <R.FieldError className="ap-error-text">{error}</R.FieldError> : <R.Text slot="description" className="ap-help">填写内容仅用于当前本地试用。</R.Text>}
  </R.TextField></Scope>;
}
function RadioField({ ctx, value, onChange }) {
  const config = ctx.config('radio-group');
  const options = config.options?.length ? config.options : ['仅自己', '团队成员', '公开'];
  return <Scope ctx={ctx} kind="radio-group"><R.RadioGroup className="ap-field" value={value} onChange={onChange} isDisabled={!!config.disabled}><R.Label>{config.label || '可见范围'}</R.Label>{options.map((option, index) => <R.Radio className="ap-radio" key={index} value={String(option)}><span className="ap-radio-dot" aria-hidden="true"/>{String(option)}</R.Radio>)}</R.RadioGroup></Scope>;
}
function Result({ children, error = false }) { return children ? <div className={`fp-result${error ? ' fp-result-error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div> : null; }
function records(ctx) {
  const names = ctx.config('table').options?.length ? ctx.config('table').options : ['示例成员 A', '示例成员 B', '示例成员 C'];
  const categories = ctx.config('select').options?.length ? ctx.config('select').options : ['设计团队', '产品团队', '研发团队'];
  return names.map((name, index) => ({ id: `row-${index}`, name: String(name), category: String(categories[index % categories.length]), status: '可用' }));
}
function DataTable({ ctx, items, selected, setSelected, onInspect }) {
  const selectable = !!setSelected;
  return <Scope ctx={ctx} kind="table"><div className="ap-table-wrap"><R.Table className="ap-table" aria-label={ctx.config('table').label || '试用结果'} selectionMode={selectable ? 'multiple' : 'none'} selectedKeys={selected} onSelectionChange={setSelected} disabledKeys={ctx.config('table').disabled ? items.map(item => item.id) : []}>
    <R.TableHeader>{selectable && <R.Column width={38}><Check slot="selection" aria-label="选择全部条目" /></R.Column>}<R.Column isRowHeader id="name">名称</R.Column><R.Column id="category">{ctx.config('select').label || '所属团队'}</R.Column><R.Column id="status">状态</R.Column>{onInspect && <R.Column id="action">操作</R.Column>}</R.TableHeader>
    <R.TableBody items={items} renderEmptyState={() => <div className="fp-empty">没有匹配结果。调整关键词或清空条件后重试。</div>}>{item => <R.Row id={item.id}>{selectable && <R.Cell><Check slot="selection" aria-label={`选择${item.name}`} /></R.Cell>}<R.Cell>{item.name}</R.Cell><R.Cell>{item.category}</R.Cell><R.Cell><span className={item.status === '已归档' ? 'fp-row-archived' : ''}>{item.status}</span></R.Cell>{onInspect && <R.Cell><R.Button className="ap-link" onPress={() => onInspect(item)}>查看</R.Button></R.Cell>}</R.Row>}</R.TableBody>
  </R.Table></div></Scope>;
}

function SearchFlow({ ctx, withSelection = false, withConfirm = false }) {
  const search = ctx.config('search-field');
  const [keyword, setKeyword] = useState(String(search.value || ''));
  const [category, setCategory] = useState('all');
  const [applied, setApplied] = useState({ keyword: '', category: 'all' });
  const [rows, setRows] = useState(() => records(ctx));
  const [selected, setSelected] = useState(new Set());
  const [message, setMessage] = useState('');
  const [inspected, setInspected] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [undo, setUndo] = useState(null);
  const visible = rows.filter(row => row.name.toLowerCase().includes(applied.keyword.trim().toLowerCase()) && (applied.category === 'all' || row.category === applied.category));
  const selectedIds = selected === 'all' ? visible.map(row => row.id) : [...selected];
  const report = text => { setMessage(text); ctx.report(text); };
  const apply = () => { setApplied({ keyword, category }); setSelected(new Set()); report(`已应用条件：${keyword.trim() || '全部关键词'} / ${category === 'all' ? '全部分类' : category}`); };
  const reset = () => { setKeyword(''); setCategory('all'); setApplied({ keyword: '', category: 'all' }); setSelected(new Set()); report('已清空条件并恢复完整列表。'); };
  const archive = () => { setUndo(rows); setRows(old => old.map(row => selectedIds.includes(row.id) ? { ...row, status: '已归档' } : row)); setSelected(new Set()); setConfirm(false); report(`已在本地归档 ${selectedIds.length} 个条目，可以恢复。`); };
  return <div className="fp-search-flow">
    <div className="fp-query-row"><Scope ctx={ctx} kind="search-field"><R.SearchField className="ap-field" value={keyword} onChange={setKeyword} onSubmit={apply} onClear={() => setKeyword('')} isDisabled={!!search.disabled}><R.Label>{sceneValue(ctx, 'search-field', 'label', '查找成员')}</R.Label><R.Group className="ap-input-group"><R.Input className="ap-input" placeholder={sceneValue(ctx, 'search-field', 'placeholder', '输入成员姓名')} /><R.Button className="ap-button" aria-label="清空关键词">×</R.Button></R.Group></R.SearchField></Scope><SelectField ctx={ctx} value={category} onChange={next => setCategory(String(next || 'all'))} includeAll /><div className="fp-query-actions"><Action ctx={ctx} onPress={apply}>查询</Action><Action ctx={ctx} secondary onPress={reset}>清空条件</Action></div></div>
    <div className="fp-result-heading"><strong>查询结果</strong><span>{visible.length} 条本地样本</span></div>
    {withSelection && <div className="fp-selection-actions"><span>已选择 {selectedIds.length} 项</span><Action ctx={ctx} secondary disabled={!selectedIds.length} onPress={() => withConfirm ? setConfirm(true) : archive()}>批量归档</Action><Action ctx={ctx} secondary disabled={!selectedIds.length} onPress={() => { setSelected(new Set()); report('已取消全部选择。'); }}>取消选择</Action>{undo && <Action ctx={ctx} secondary onPress={() => { setRows(undo); setUndo(null); report('已恢复上一次归档前的状态。'); }}>恢复上次操作</Action>}</div>}
    <DataTable ctx={ctx} items={visible} selected={withSelection ? selected : undefined} setSelected={withSelection ? setSelected : undefined} onInspect={setInspected}/>
    <Result>{message}</Result>
    {inspected && <div className="fp-inspector"><div><strong>{inspected.name}</strong><p>{inspected.category} · {rows.find(row => row.id === inspected.id)?.status}</p></div><Action ctx={ctx} secondary onPress={() => setInspected(null)}>收起详情</Action></div>}
    <ConfirmModal ctx={ctx} open={confirm} onClose={() => setConfirm(false)} title={`归档所选 ${selectedIds.length} 个条目？`} description="执行后条目标记为已归档。你可以使用恢复按钮撤销这次本地操作。" onConfirm={archive}/>
  </div>;
}

function FormFlow({ ctx }) {
  const field = ctx.config('text-field');
  const checkbox = ctx.config('checkbox');
  const [name, setName] = useState(String(field.value || ''));
  const [category, setCategory] = useState('');
  const [checked, setChecked] = useState(!!checkbox.value);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const submit = event => {
    event.preventDefault();
    if (!name.trim()) { setError(`请填写${field.label || '名称'}。`); setSubmitted(null); return; }
    if (!category) { setError(`请选择${ctx.config('select').label || '分类'}。`); setSubmitted(null); return; }
    if (checkbox.required && !checked) { setError(`请确认${checkbox.label || '必选选项'}。`); return; }
    setError(''); setSubmitted({ name: name.trim(), category, checked }); ctx.report(`本地表单已提交：${name.trim()}，${category}。`);
  };
  return <div className="fp-form-flow"><R.Form className="fp-form" validationBehavior="aria" onSubmit={submit}>
    <TextField ctx={ctx} value={name} onChange={next => { setName(next); setSubmitted(null); setError(''); }} required error={error && !name.trim() ? error : undefined}/>
    <SelectField ctx={ctx} value={category} onChange={next => { setCategory(String(next)); setSubmitted(null); }}/>
    <Scope ctx={ctx} kind="checkbox"><Check isSelected={checked} onChange={next => { setChecked(next); setSubmitted(null); }} isDisabled={!!checkbox.disabled} isRequired={!!checkbox.required}>{checkbox.label || '接收更新通知'}</Check></Scope>
    <Result error>{error}</Result><div className="fp-actions"><Action ctx={ctx} type="submit">提交试用</Action><Action ctx={ctx} secondary onPress={() => { setName(String(field.value || '')); setCategory(''); setChecked(!!checkbox.value); setError(''); setSubmitted(null); ctx.report('表单已恢复初始值。'); }}>恢复初始值</Action></div>
  </R.Form>{submitted && <Result><strong>已在本地完成提交</strong><dl><div><dt>{field.label || '名称'}</dt><dd>{submitted.name}</dd></div><div><dt>{ctx.config('select').label || '分类'}</dt><dd>{submitted.category}</dd></div><div><dt>{checkbox.label || '通知'}</dt><dd>{submitted.checked ? '开启' : '关闭'}</dd></div></dl><span>输入内容已保留，可修改后重新提交。</span></Result>}</div>;
}
function ConfirmModal({ ctx, open, onClose, title, description, onConfirm }) {
  return <R.ModalOverlay isOpen={open} onOpenChange={next => !next && onClose()} className="asset-modal-overlay" style={ctx.css('alert-dialog')}><R.Modal className="asset-modal"><R.Dialog role="alertdialog" className="ap-dialog"><R.Heading slot="title">{title}</R.Heading><p>{description}</p><div className="ap-actions"><Action ctx={ctx} secondary onPress={onClose}>取消</Action><Action ctx={ctx} danger onPress={onConfirm}>确认归档</Action></div></R.Dialog></R.Modal></R.ModalOverlay>;
}
function ConfirmFlow({ ctx }) {
  const [archived, setArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const action = ctx.config('alert-dialog');
  const report = text => { setMessage(text); ctx.report(text); };
  return <div className="fp-confirm-flow"><div className="fp-record"><div><strong>示例资源</strong><p>状态：{archived ? '已归档' : '正在使用'}</p></div>{archived ? <Action ctx={ctx} secondary onPress={() => { setArchived(false); report('资源已恢复为正在使用。'); }}>恢复资源</Action> : <Action ctx={ctx} danger disabled={action.disabled} onPress={() => setOpen(true)}>{sceneValue(ctx, 'alert-dialog', 'label', '归档资源')}</Action>}</div><Result>{message}</Result><ConfirmModal ctx={ctx} open={open} title="归档示例资源？" description="资源将从正在使用变为已归档，归档后可以恢复。此处仅改变本地试用状态。" onClose={() => { setOpen(false); report('已取消，资源状态保持不变。'); }} onConfirm={() => { setOpen(false); setArchived(true); report('示例资源已归档，可点击恢复资源撤销。'); }}/></div>;
}
function SettingsFlow({ ctx }) {
  const switchConfig = ctx.config('switch');
  const radio = ctx.config('radio-group');
  const tabOptions = sceneValue(ctx, 'tabs', 'options', ['通知偏好', '访问范围']).slice(0, 2);
  const initial = { enabled: !!switchConfig.value, visibility: String(radio.options?.[0] || '仅自己') };
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState('');
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  return <div className="fp-settings-flow"><Scope ctx={ctx} kind="tabs"><R.Tabs className="ap-tabs" isDisabled={!!ctx.config('tabs').disabled}><R.TabList aria-label={ctx.config('tabs').label || '设置分组'}>{tabOptions.map((name, index) => <R.Tab key={index} id={String(index)}>{String(name)}</R.Tab>)}</R.TabList>{tabOptions.map((name, index) => <R.TabPanel key={index} id={String(index)}><h4>{String(name)}</h4>{index === 0 ? <Scope ctx={ctx} kind="switch"><R.Switch className="ap-switch" isSelected={draft.enabled} isDisabled={!!switchConfig.disabled} onChange={enabled => { setDraft(old => ({ ...old, enabled })); setMessage(''); }}><span className="ap-switch-track" aria-hidden="true"><span/></span>{switchConfig.label || '启用通知'}</R.Switch>{tabOptions.length === 1 && <RadioField ctx={ctx} value={draft.visibility} onChange={visibility => setDraft(old => ({ ...old, visibility }))}/>}</Scope> : <RadioField ctx={ctx} value={draft.visibility} onChange={visibility => { setDraft(old => ({ ...old, visibility })); setMessage(''); }}/>}</R.TabPanel>)}</R.Tabs></Scope>
    <div className="fp-actions"><Action ctx={ctx} disabled={!dirty} onPress={() => { setSaved({ ...draft }); setMessage('本地设置已保存。'); ctx.report('设置已保存，两个分组的修改一并生效。'); }}>{ctx.config('button').label || '保存设置'}</Action><Action ctx={ctx} secondary disabled={!dirty} onPress={() => { setDraft({ ...saved }); setMessage('已取消未保存的修改。'); ctx.report('已恢复至上次保存的设置。'); }}>取消修改</Action><span className="fp-muted">{dirty ? '存在未保存修改' : '与已保存设置一致'}</span></div>
    <div className="fp-saved-values"><strong>已保存的设置</strong><p>{switchConfig.label || '通知'}：{saved.enabled ? '开启' : '关闭'} · {radio.label || '可见范围'}：{saved.visibility}</p></div><Result>{message}</Result></div>;
}
function SelectionFlow({ ctx }) {
  const [rows, setRows] = useState(() => records(ctx));
  const [selected, setSelected] = useState(new Set());
  const [undo, setUndo] = useState(null);
  const [message, setMessage] = useState('');
  const selectedIds = selected === 'all' ? rows.map(row => row.id) : [...selected];
  const archive = () => { setUndo(rows); setRows(old => old.map(row => selectedIds.includes(row.id) ? { ...row, status: '已归档' } : row)); setSelected(new Set()); const text = `已归档 ${selectedIds.length} 个本地条目。`; setMessage(text); ctx.report(text); };
  return <div className="fp-selection-flow"><div className="fp-selection-actions"><span>已选择 <strong>{selectedIds.length}</strong> 项</span><Action ctx={ctx} disabled={!selectedIds.length} onPress={archive}>批量归档</Action><Action ctx={ctx} secondary disabled={!selectedIds.length} onPress={() => { setSelected(new Set()); setMessage('已取消全部选择。'); }}>取消选择</Action><R.MenuTrigger><R.Button style={ctx.css('menu')} className="ap-button ap-secondary" isDisabled={!!ctx.config('menu').disabled}>{ctx.config('menu').label || '更多操作'} ⌄</R.Button><R.Popover className="asset-popover" style={ctx.css('menu')}><R.Menu className="ap-menu" aria-label="列表选择操作" onAction={key => { if (key === 'all') { setSelected(new Set(rows.map(row => row.id))); setMessage('已选择全部条目。'); } if (key === 'clear') { setSelected(new Set()); setMessage('已取消全部选择。'); } }}><R.MenuItem id="all" className="ap-option">选择全部</R.MenuItem><R.MenuItem id="clear" className="ap-option">取消选择</R.MenuItem></R.Menu></R.Popover></R.MenuTrigger></div><DataTable ctx={ctx} items={rows} selected={selected} setSelected={setSelected}/><Result>{message}</Result>{undo && <Action ctx={ctx} secondary onPress={() => { setRows(undo); setUndo(null); setMessage('已恢复到批量归档前的状态。'); ctx.report('已撤销上一次批量归档。'); }}>恢复上次操作</Action>}</div>;
}
function WizardFlow({ ctx }) {
  const field = ctx.config('text-field');
  const radio = ctx.config('radio-group');
  const [step, setStep] = useState(0);
  const [name, setName] = useState(String(field.value || ''));
  const [visibility, setVisibility] = useState(String(radio.options?.[0] || '仅自己'));
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const next = () => { if (step === 0 && !name.trim()) { setError(`请填写${field.label || '名称'}再继续。`); return; } setError(''); setStep(old => Math.min(old + 1, 2)); ctx.report('已进入下一步，输入内容保持。'); };
  return <div className="fp-wizard-flow"><Scope ctx={ctx} kind="progress-bar"><R.ProgressBar className="ap-progress" value={finished ? 100 : (step + 1) / 3 * 100}><div className="ap-slider-label"><R.Label>{sceneValue(ctx, 'progress-bar', 'label', '配置进度')}</R.Label><span>{finished ? '已完成' : `第 ${step + 1} / 3 步`}</span></div><div className="ap-progress-track"><div style={{ width: `${finished ? 100 : (step + 1) / 3 * 100}%` }}/></div></R.ProgressBar></Scope>
    {!finished && <ol className="fp-wizard-steps">{['填写信息', '选择范围', '核对提交'].map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined}>{index + 1}. {label}</li>)}</ol>}
    {finished ? <Result><strong>配置已在本地完成</strong><p>{field.label || '名称'}：{name} · {radio.label || '可见范围'}：{visibility}</p><Action ctx={ctx} secondary onPress={() => { setFinished(false); setStep(0); }}>返回修改</Action></Result> : <>
      {step === 0 && <TextField ctx={ctx} value={name} onChange={nextValue => { setName(nextValue); setError(''); }} required error={error}/>} {step === 1 && <RadioField ctx={ctx} value={visibility} onChange={setVisibility}/>} {step === 2 && <div className="fp-summary"><h4>确认以下内容</h4><dl><div><dt>{field.label || '名称'}</dt><dd>{name}</dd></div><div><dt>{radio.label || '可见范围'}</dt><dd>{visibility}</dd></div></dl><p>可以返回任一步修改，已填写的内容会保留。</p></div>}
      <div className="fp-actions"><Action ctx={ctx} secondary disabled={step === 0} onPress={() => { setStep(old => Math.max(0, old - 1)); setError(''); }}>上一步</Action>{step < 2 ? <Action ctx={ctx} onPress={next}>下一步</Action> : <Action ctx={ctx} onPress={() => { setFinished(true); ctx.report(`分步配置已完成：${name}，${visibility}。`); }}>确认并完成</Action>}</div>
    </>}</div>;
}

export function FlowPreview({ pattern, source, theme = 'light', onEvent, withSelection, withConfirm }) {
  const type = flowType(pattern);
  const ctx = useMemo(() => context(pattern, source, theme, onEvent), [pattern, source, theme, onEvent]);
  if (!canRunFlow(pattern, source)) return null;
  const Flow = { search: SearchFlow, form: FormFlow, confirm: ConfirmFlow, settings: SettingsFlow, selection: SelectionFlow, wizard: WizardFlow }[type];
  return <div className={`asset-preview fp-root fp-kind-${type}`} style={tokenCSS(source, {}, theme)}><Flow ctx={ctx} withSelection={withSelection} withConfirm={withConfirm}/><p className="fp-local-note">本地交互试用 · 操作仅作用于当前预览。默认文案随场景调整，自定义文案优先保留。</p></div>;
}

/** A template selects a primary task flow and assigns secondary content to explicit page regions. */
export function TemplateFlowPreview({ template, source, theme = 'light', onEvent }) {
  const patterns = (template.patternIds || []).map(id => source.patterns.find(pattern => pattern.id === id)).filter(Boolean);
  const findFlow = type => patterns.find(pattern => flowType(pattern) === type && canRunFlow(pattern, source));
  const preferred = { list: 'search', form: 'form', settings: 'settings', detail: 'confirm', dashboard: 'search', wizard: 'wizard' }[template.layout];
  const primary = findFlow(preferred) || patterns.find(pattern => canRunFlow(pattern, source));
  const [view, setView] = useState('content');
  if (!primary) return null;
  const componentIds = [...new Set([...patterns.flatMap(pattern => pattern.componentIds || []), ...(template.componentIds || [])])];
  const breadcrumbs = componentIds.map(id => byId(source, id)).find(component => component?.kind === 'breadcrumbs');
  const breadcrumbConfig = breadcrumbs ? { ...breadcrumbs.config, options: JSON.stringify(breadcrumbs.config?.options) === JSON.stringify(catalogConfig('breadcrumbs').options) ? ['工作区', template.name] : breadcrumbs.config?.options } : null;
  const includedInFlows = new Set(patterns.flatMap(pattern => pattern.componentIds || []));
  const supplements = (template.componentIds || []).filter(id => !includedInFlows.has(id)).map(id => byId(source, id)).filter(asset => asset && asset.id !== breadcrumbs?.id);
  const flowSource = { ...primary, componentIds }; // Every style/config remains a real template dependency.
  return <div className={`fp-template-layout fp-template-${template.layout}`}>
    {breadcrumbs && <div className="fp-template-breadcrumb" style={tokenCSS(source, breadcrumbs.bindings, theme)}><ComponentPreview kind="breadcrumbs" config={breadcrumbConfig} compact onEvent={onEvent}/></div>}
    <header className="fp-template-heading"><div><h3>{template.name}</h3><p>{template.description}</p></div><span>{({ list: '查找 → 选择 → 操作', form: '填写 → 验证 → 提交', settings: '修改 → 保存 / 取消', detail: '查看 → 操作 → 恢复', dashboard: '检索与状态', wizard: '填写 → 返回修改 → 核对' })[template.layout] || '组合流程'}</span></header>
    {template.layout === 'detail' && <div className="fp-detail-object"><strong>示例资源</strong><dl><div><dt>名称</dt><dd>通用资源样本</dd></div><div><dt>用途</dt><dd>检验查看、确认、取消与恢复路径</dd></div></dl></div>}
    {template.layout === 'dashboard' && <p className="fp-template-context">概览页使用下方真实本地结果作为内容来源；不展示虚构业务指标。</p>}
    <div className="fp-template-main"><FlowPreview key={`${primary.id}-${template.id}`} pattern={flowSource} source={source} theme={theme} onEvent={onEvent} withSelection={!!findFlow('selection')} withConfirm={!!findFlow('confirm')}/></div>
    {!!supplements.length && <section className="cv-composition" aria-label="页面补充组件">{supplements.map(component => <div key={component.id} className="cv-component-slot" style={tokenCSS(source,component.bindings,theme)}><span className="cv-slot-label">{component.name}</span><ComponentPreview kind={component.kind} config={component.config} onEvent={onEvent}/></div>)}</section>}
    <div className="fp-template-footer"><button type="button" className="cv-text-link" onClick={() => setView(old => old === 'content' ? 'flows' : 'content')}>{view === 'content' ? '查看页面的其他交互流程' : '收起其他流程'}</button>{view === 'flows' && <div className="fp-secondary-flows">{patterns.filter(pattern => pattern.id !== primary.id).map(pattern => <details key={pattern.id}><summary>{pattern.name}</summary>{canRunFlow(pattern, source) ? <FlowPreview pattern={pattern} source={source} theme={theme} onEvent={onEvent}/> : <p>此自定义模式维护了组件组合与步骤，尚未绑定跨组件行为。</p>}</details>)}{patterns.length <= 1 && <p>此模板只有一个主流程。</p>}</div>}</div>
  </div>;
}
export function canRunTemplate(template, source) { return (template.patternIds || []).some(id => { const pattern = source.patterns.find(item => item.id === id); return pattern && canRunFlow(pattern, source); }); }
