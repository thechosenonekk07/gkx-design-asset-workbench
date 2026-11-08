import React, { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as R from 'react-aria-components';
import { ArrowDown, ArrowUp, Check, LayoutDashboard, Plus, Search, Trash2, X } from 'lucide-react';
import { tokenCSS } from './model.js';
import { BLUEPRINT_VARIANTS as VARIANTS, BLUEPRINT_SHELLS as SHELLS, BLUEPRINT_LIMITS } from './templateBlueprint.js';
import { requiredBlueprintKinds, validateBlueprintDependencies } from './blueprintDependencies.js';
import './template-blueprint.css';

const SECTIONS = { intro: '标题与说明', filters: '检索条件', content: '主要内容', actions: '页面操作' };
const TYPES = { text: '文本', number: '数字', select: '单选', textarea: '多行文本' };
const STATES = { normal: '正常', loading: '加载中', empty: '空内容', error: '加载失败', denied: '无权限' };
const newId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const copy = value => JSON.parse(JSON.stringify(value));
const nonblank = value => value !== undefined && value !== null && String(value).trim() !== '';
const BlueprintStyles = createContext({});

function Button({ children, primary = false, danger = false, className = '', ...props }) {
  const styles = useContext(BlueprintStyles);
  return <R.Button type="button" style={styles.button} className={`tb-button${primary ? ' tb-primary' : ''}${danger ? ' tb-danger' : ''} ${className}`} {...props}>{children}</R.Button>;
}
function Select({ label, value, options, onChange, ...props }) {
  return <label className="tb-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)} {...props}>{Object.entries(options).map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></label>;
}
function Text({ label, value, onChange, multiline = false, ...props }) {
  return <R.TextField className="tb-field" value={String(value ?? '')} onChange={onChange}><R.Label>{label}</R.Label>{multiline ? <R.TextArea {...props} /> : <R.Input {...props}/>}</R.TextField>;
}
function Checkbox({ children, ...props }) {
  const styles = useContext(BlueprintStyles);
  return <R.Checkbox className="tb-checkbox" style={styles.checkbox} {...props}>{({ isSelected }) => <><span className="tb-check" aria-hidden="true">{isSelected && <Check size={12}/>}</span><span>{children}</span></>}</R.Checkbox>;
}
function OptionEditor({ field, onCommit }) {
  const [text, setText] = useState((field.options || []).join('\n'));
  const stored = (field.options || []).join('\n');
  useEffect(() => setText(stored), [stored]);
  return <Text label={`${field.label}的可选项（每行一项，离开输入框后应用）`} multiline value={text} onChange={setText} onBlur={() => onCommit([...new Set(text.split('\n').map(item => item.trim()).filter(Boolean))])}/>;
}
function SampleNumberEditor({ field, value, onCommit }) {
  const stored = String(value ?? '');
  const [text, setText] = useState(stored);
  useEffect(() => setText(stored), [stored]);
  return <Text label={field.label} type="number" step="any" value={text} onChange={setText} onBlur={() => onCommit(text)} onKeyDown={event => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    // Confirm this input before the surrounding asset form can submit stale data.
    event.preventDefault();
    onCommit(event.currentTarget.value);
  }}/>;
}
function normalValue(field, value) {
  if (!nonblank(value)) return undefined;
  if (field.type === 'number') return Number.isFinite(Number(value)) ? Number(value) : undefined;
  if (field.type === 'select') return field.options?.includes(String(value)) ? String(value) : undefined;
  return String(value);
}
function normalizedValues(fields, values) {
  return Object.fromEntries(fields.map(field => [field.id, normalValue(field, values[field.id])]).filter(([, value]) => value !== undefined));
}
function move(values, index, offset) {
  const next = [...values];
  [next[index], next[index + offset]] = [next[index + offset], next[index]];
  return next;
}

/** Controlled configuration; field identities survive label, type, and view changes. */
export function BlueprintEditor({ value, onChange }) {
  const patch = next => onChange({ ...value, ...next });
  const patchActions = next => patch({ actions: { ...value.actions, ...next } });
  const setFields = fields => patch({ fields, records: value.records.map(record => ({ ...record, values: normalizedValues(fields, record.values) })) });
  const changeField = (id, next) => setFields(value.fields.map(field => field.id === id ? { ...field, ...next } : field));
  const setRecordValue = (recordId, field, input) => patch({ records: value.records.map(record => {
    if (record.id !== recordId) return record;
    const values = { ...record.values };
    const next = normalValue(field, input);
    if (next === undefined) delete values[field.id]; else values[field.id] = next;
    return { ...record, values };
  }) });
  return <div className="tb-editor">
    <section className="tb-editor-section"><h4>页面内容与框架</h4><p className="tb-help">框架与结构变体共用同一份字段和样本数据，切换后继续保留。</p><div className="tb-editor-grid">
      <Text label="页面标题" value={value.title} onChange={title => patch({ title })} maxLength={120}/>
      <Select label="结构变体" value={value.variant} options={VARIANTS[value.family]} onChange={variant => patch({ variant })}/>
      <Select label="布局框架" value={value.shell} options={SHELLS} onChange={shell => patch({ shell })}/>
      <Text label="页面说明" value={value.description} onChange={description => patch({ description })} maxLength={1000}/>
    </div></section>
    <section className="tb-editor-section"><div className="tb-section-heading"><h4>字段结构</h4><Button isDisabled={value.fields.length >= BLUEPRINT_LIMITS.fields} onPress={() => setFields([...value.fields, { id: newId('field'), label: '新字段', type: 'text', required: false }])}><Plus size={14}/>添加字段</Button></div><p className="tb-help">字段决定列表列、表单输入与详情内容。删除字段也会移除其样本值；更改类型时清理不兼容的值。</p>
      <div className="tb-field-list">{value.fields.map((field, index) => <div className="tb-field-editor" key={field.id}>
        <Text label={`字段 ${index + 1} 名称`} value={field.label} onChange={label => changeField(field.id, { label })} maxLength={80}/>
        <Select label="输入类型" value={field.type} options={TYPES} onChange={type => { const next = { ...field, type }; if (type === 'select') next.options = field.options?.length ? field.options : ['选项一', '选项二']; else delete next.options; setFields(value.fields.map(item => item.id === field.id ? next : item)); }}/>
        <Checkbox isSelected={field.required} onChange={required => changeField(field.id, { required })}>提交时必填</Checkbox>
        <div className="tb-icon-actions"><Button aria-label={`上移字段 ${field.label}`} isDisabled={index === 0} onPress={() => setFields(move(value.fields, index, -1))}><ArrowUp size={14}/></Button><Button aria-label={`下移字段 ${field.label}`} isDisabled={index === value.fields.length - 1} onPress={() => setFields(move(value.fields, index, 1))}><ArrowDown size={14}/></Button><Button danger aria-label={`删除字段 ${field.label}`} isDisabled={value.fields.length <= 1} onPress={() => setFields(value.fields.filter(item => item.id !== field.id))}><Trash2 size={14}/></Button></div>
        {field.type === 'select' && <OptionEditor field={field} onCommit={options => changeField(field.id, { options })}/>}
      </div>)}</div>
    </section>
    <section className="tb-editor-section"><h4>操作与区域顺序</h4><div className="tb-editor-grid"><Text label="主要操作文案" value={value.actions.primaryLabel} onChange={primaryLabel => patchActions({ primaryLabel })} maxLength={40}/><Text label="次要操作文案" value={value.actions.secondaryLabel} onChange={secondaryLabel => patchActions({ secondaryLabel })} maxLength={40}/></div>
      {value.family === 'list' && <div className="tb-inline-checks"><Checkbox isSelected={value.actions.allowCreate} onChange={allowCreate => patchActions({ allowCreate })}>允许新增记录</Checkbox><Checkbox isSelected={value.actions.allowDelete} onChange={allowDelete => patchActions({ allowDelete })}>允许选择与删除</Checkbox></div>}
      <div className="tb-section-order">{value.sections.map((section, index) => <div key={section}><span>{SECTIONS[section]}</span><div className="tb-icon-actions"><Button aria-label={`上移${SECTIONS[section]}`} isDisabled={index === 0} onPress={() => patch({ sections: move(value.sections, index, -1) })}><ArrowUp size={14}/></Button><Button aria-label={`下移${SECTIONS[section]}`} isDisabled={index === value.sections.length - 1} onPress={() => patch({ sections: move(value.sections, index, 1) })}><ArrowDown size={14}/></Button>{section !== 'content' && <Button aria-label={`隐藏${SECTIONS[section]}`} onPress={() => patch({ sections: value.sections.filter(item => item !== section) })}><X size={14}/></Button>}</div></div>)}</div>
      {Object.keys(SECTIONS).some(key => !value.sections.includes(key)) && <div className="tb-inline-actions">{Object.keys(SECTIONS).filter(key => !value.sections.includes(key)).map(key => <Button key={key} onPress={() => patch({ sections: [...value.sections, key] })}><Plus size={13}/>{SECTIONS[key]}</Button>)}</div>}
    </section>
    <details className="tb-sample-editor"><summary>样本数据 · {value.records.length} 条</summary><p className="tb-help">样本用于本地演示，项目页面可独立更换。表单从空值开始，详情默认读取第一条。</p>
      {value.records.map((record, index) => <section className="tb-sample-record" key={record.id}><div className="tb-section-heading"><strong>样本 {index + 1}</strong><Button danger aria-label={`删除样本 ${index + 1}`} onPress={() => patch({ records: value.records.filter(item => item.id !== record.id) })}><Trash2 size={14}/></Button></div><div className="tb-editor-grid">{value.fields.map(field => field.type === 'select' ? <Select key={field.id} label={field.label} value={String(record.values[field.id] ?? '')} options={{ '': '未填写', ...Object.fromEntries((field.options || []).map(option => [option, option])) }} onChange={next => setRecordValue(record.id, field, next)}/> : field.type === 'number' ? <SampleNumberEditor key={field.id} field={field} value={record.values[field.id]} onCommit={next => setRecordValue(record.id, field, next)}/> : <Text key={field.id} label={field.label} multiline={field.type === 'textarea'} value={record.values[field.id] ?? ''} onChange={next => setRecordValue(record.id, field, next)}/>)}</div></section>)}
      <Button isDisabled={value.records.length >= BLUEPRINT_LIMITS.records} onPress={() => patch({ records: [...value.records, { id: newId('record'), values: {} }] })}><Plus size={14}/>添加样本</Button>
    </details>
  </div>;
}

function RuntimeField({ field, value, onChange, error, onEnter, inputRef }) {
  const styles = useContext(BlueprintStyles);
  const errorId = useId();
  if (field.type === 'select') return <label style={styles.select} className={`tb-field${error ? ' tb-invalid' : ''}`}><span>{field.label}{field.required && <span className="tb-required"> *</span>}</span><select ref={inputRef} value={String(value ?? '')} required={field.required} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} onChange={event => onChange(event.target.value)}><option value="">请选择</option>{(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}</select>{error && <span id={errorId} className="tb-field-error" role="alert">{error}</span>}</label>;
  return <R.TextField style={styles[field.type === 'number' ? 'number-field' : 'text-field']} className="tb-field" value={String(value ?? '')} onChange={onChange} isRequired={field.required} isInvalid={!!error} validationBehavior="aria"><R.Label>{field.label}{field.required && <span className="tb-required"> *</span>}</R.Label>{field.type === 'textarea' ? <R.TextArea ref={inputRef} rows={3}/> : <R.Input ref={inputRef} type={field.type === 'number' ? 'number' : 'text'} step={field.type === 'number' ? 'any' : undefined} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); onEnter?.(); } }}/>}<R.FieldError className="tb-field-error">{error}</R.FieldError></R.TextField>;
}
function FieldSummary({ fields, values, grouped = false }) {
  return <dl className={`tb-value-list${grouped ? ' tb-grouped-values' : ''}`}>{fields.map(field => <div key={field.id}><dt>{field.label}</dt><dd>{nonblank(values?.[field.id]) ? String(values[field.id]) : '未填写'}</dd></div>)}</dl>;
}
function BlueprintRuntime({ blueprint: bp, source, theme, onEvent }) {
  const css = useMemo(() => tokenCSS(source, {}, theme), [source, theme]);
  const styles = useMemo(() => Object.fromEntries(requiredBlueprintKinds(bp).map(kind => [kind, tokenCSS(source, source.components.find(item => item.kind === kind).bindings || {}, theme)])), [source, theme, bp.family]);
  const [shell, setShell] = useState(bp.shell);
  const [variant, setVariant] = useState(bp.variant);
  const [state, setState] = useState('normal');
  const [rows, setRows] = useState(() => copy(bp.records));
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [values, setValues] = useState(() => bp.family === 'detail' ? { ...bp.records[0]?.values } : {});
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removed, setRemoved] = useState([]);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(null);
  const [message, setMessage] = useState('');
  const [inspectedId, setInspectedId] = useState(null);
  const [focusAttempt, setFocusAttempt] = useState(0);
  const fieldRefs = useRef({});
  const fields = bp.fields;
  useEffect(() => { if (focusAttempt) { const first = fields.find(field => errors[field.id]); if (first) fieldRefs.current[first.id]?.focus(); } }, [focusAttempt]);
  const filtered = rows.filter(record => fields.some(field => String(record.values[field.id] ?? '').toLocaleLowerCase().includes(appliedQuery.trim().toLocaleLowerCase())));
  const visible = state === 'empty' ? [] : filtered;
  const activeFields = bp.family === 'form' && variant === 'wizard' ? fields.filter((_, index) => Math.min(index, 1) === step) : fields;
  const stepCount = fields.length > 1 ? 3 : 2;
  const reviewStep = stepCount - 1;
  const isReview = variant === 'wizard' && step === reviewStep;
  const detail = rows[0];
  const report = text => { setMessage(text); onEvent?.(text); };
  const updateValue = (id, next) => { setValues(old => ({ ...old, [id]: next })); setErrors(old => ({ ...old, [id]: undefined })); setSubmitted(null); };
  const validate = list => {
    const found = Object.fromEntries(list.map(field => [field.id, field.required && !nonblank(values[field.id]) ? `请填写${field.label}` : field.type === 'number' && nonblank(values[field.id]) && !Number.isFinite(Number(values[field.id])) ? `${field.label}需要有效数字` : field.type === 'select' && nonblank(values[field.id]) && !field.options?.includes(String(values[field.id])) ? `请重新选择${field.label}` : '']).filter(([, text]) => text));
    setErrors(found);
    if (Object.keys(found).length) { if (bp.family === 'form' && variant === 'wizard') setStep(Math.min(fields.findIndex(field => found[field.id]), 1)); setFocusAttempt(old => old + 1); report('有内容尚未完成或格式不正确，请检查标记的字段。'); return false; }
    return true;
  };
  const cancelInput = () => { setValues(bp.family === 'detail' ? { ...detail?.values } : {}); setErrors({}); setCreating(false); setEditing(false); setStep(0); setSubmitted(null); report('已恢复当前预览中的内容。'); };
  const save = () => {
    if (!validate(fields)) return;
    const next = normalizedValues(fields, values);
    if (bp.family === 'list') { setRows(old => [...old, { id: newId('preview'), values: next }]); setCreating(false); setValues({}); setQuery(''); setAppliedQuery(''); setState('normal'); report('已新增一条本地记录。'); }
    else if (bp.family === 'detail') { setRows(old => old.length ? old.map((record, index) => index === 0 ? { ...record, values: next } : record) : [{ id: newId('preview'), values: next }]); setEditing(false); report('已保存详情修改，仅作用于当前预览。'); }
    else { setSubmitted(next); report('表单已完成本地验证与提交。没有发送业务请求。'); }
  };
  const primary = () => {
    if (bp.family === 'list') { setCreating(true); setValues({}); setErrors({}); setState('normal'); }
    else if (bp.family === 'detail') { if (editing) save(); else { setEditing(true); setValues({ ...detail?.values }); setErrors({}); } }
    else if (variant === 'wizard' && !isReview) { if (validate(activeFields)) { setStep(old => Math.min(old + 1, reviewStep)); report('已进入下一步，输入内容继续保留。'); } }
    else save();
  };
  const applyQuery = () => { setAppliedQuery(query); setSelected(new Set()); report(query.trim() ? `已检索“${query.trim()}”。` : '已显示全部记录。'); };
  const resetQuery = () => { setQuery(''); setAppliedQuery(''); setSelected(new Set()); report('已清空检索条件。'); };
  const resetRuntime = () => { setRows(copy(bp.records)); setValues(bp.family === 'detail' ? { ...bp.records[0]?.values } : {}); setShell(bp.shell); setVariant(bp.variant); setState('normal'); setQuery(''); setAppliedQuery(''); setSelected(new Set()); setErrors({}); setEditing(false); setCreating(false); setRemoved([]); setStep(0); setSubmitted(null); setInspectedId(null); report('已恢复保存的模板样本，清空本地演示操作。'); };
  const toggleSelection = (id, checked) => setSelected(old => { const next = new Set(old); checked ? next.add(id) : next.delete(id); return next; });
  const renderFields = list => <div className="tb-form-fields">{list.map(field => <RuntimeField key={field.id} field={field} value={values[field.id]} onChange={next => updateValue(field.id, next)} error={errors[field.id]} onEnter={creating ? save : primary} inputRef={element => { fieldRefs.current[field.id] = element; }}/>)}</div>;
  const previewActions = () => <div className="tb-page-actions">
    {(bp.family !== 'list' || bp.actions.allowCreate) && <Button primary onPress={primary} isDisabled={state !== 'normal'}>{bp.family === 'detail' && editing ? '保存修改' : bp.family === 'form' && variant === 'wizard' && !isReview ? '下一步' : bp.actions.primaryLabel}</Button>}
    {bp.family === 'form' && variant === 'wizard' && step > 0 && <Button onPress={() => { setStep(old => old - 1); setErrors({}); setSubmitted(null); }}>上一步</Button>}
    {bp.family === 'list' ? !bp.sections.includes('filters') && <Button onPress={resetQuery} isDisabled={state !== 'normal'}>{bp.actions.secondaryLabel}</Button> : <Button onPress={cancelInput} isDisabled={state !== 'normal'}>{bp.actions.secondaryLabel}</Button>}
    {bp.family === 'list' && bp.actions.allowDelete && <><span className="tb-selection-count">已选择 {selected.size} 项</span><Button danger isDisabled={!selected.size || state !== 'normal'} onPress={() => setConfirmDelete(true)}>删除所选</Button>{removed.length > 0 && <Button onPress={() => { setRows(old => [...old, ...removed.filter(item => !old.some(row => row.id === item.id))]); setRemoved([]); report('已恢复上次删除的记录。'); }}>撤销删除</Button>}</>}
  </div>;
  const listContent = () => <>
    {creating && <section className="tb-local-editor" aria-label="新增本地记录"><div className="tb-section-heading"><h4>新增记录</h4><Button aria-label="取消新增记录" onPress={cancelInput}><X size={16}/></Button></div>{renderFields(fields)}<div className="tb-page-actions"><Button primary onPress={save}>保存记录</Button><Button onPress={cancelInput}>取消</Button></div></section>}
    <div className="tb-result-summary"><strong>{appliedQuery ? '检索结果' : '全部记录'}</strong><span>{visible.length} 条本地样本</span></div>
    {!visible.length ? <div className="tb-empty"><strong>{appliedQuery ? '没有匹配记录' : '还没有记录'}</strong><p>{appliedQuery ? '尝试其他关键词，或清空检索条件。' : '可新增一条记录，或恢复已有样本。'}</p><div className="tb-page-actions">{appliedQuery && <Button onPress={resetQuery}>清空条件</Button>}{state === 'empty' && <Button onPress={() => setState('normal')}>恢复正常预览</Button>}{bp.actions.allowCreate && <Button primary onPress={primary}>新增记录</Button>}</div></div> : variant === 'cards' ? <div className="tb-record-grid">{visible.map(record => <article key={record.id} className="tb-record"><div className="tb-record-title"><strong>{String(record.values[fields[0].id] ?? '未命名记录')}</strong>{bp.actions.allowDelete && <Checkbox aria-label={`选择记录 ${String(record.values[fields[0].id] ?? record.id)}`} isSelected={selected.has(record.id)} onChange={checked => toggleSelection(record.id, checked)}/>}</div><FieldSummary fields={fields.slice(1)} values={record.values}/><Button onPress={() => setInspectedId(record.id)}>查看记录</Button></article>)}</div> : <div style={styles.table} className="tb-table-scroll" tabIndex={0} aria-label="记录表格，可横向滚动"><table className="tb-table"><thead><tr>{bp.actions.allowDelete && <th className="tb-select-cell"><Checkbox aria-label="选择所有可见记录" isSelected={visible.every(row => selected.has(row.id))} isIndeterminate={visible.some(row => selected.has(row.id)) && !visible.every(row => selected.has(row.id))} onChange={checked => setSelected(old => { const next = new Set(old); visible.forEach(row => checked ? next.add(row.id) : next.delete(row.id)); return next; })}/></th>}{fields.map(field => <th key={field.id} scope="col">{field.label}</th>)}<th scope="col">操作</th></tr></thead><tbody>{visible.map(record => <tr key={record.id} data-selected={selected.has(record.id)}>{bp.actions.allowDelete && <td className="tb-select-cell"><Checkbox aria-label={`选择记录 ${String(record.values[fields[0].id] ?? record.id)}`} isSelected={selected.has(record.id)} onChange={checked => toggleSelection(record.id, checked)}/></td>}{fields.map(field => <td key={field.id}>{nonblank(record.values[field.id]) ? String(record.values[field.id]) : '—'}</td>)}<td><Button className="tb-quiet" onPress={() => setInspectedId(record.id)}>查看</Button></td></tr>)}</tbody></table></div>}
    {inspectedId && rows.some(row => row.id === inspectedId) && <section className="tb-inline-detail" aria-label="所选记录详情"><div className="tb-section-heading"><h4>记录详情</h4><Button onPress={() => setInspectedId(null)}>收起详情</Button></div><FieldSummary fields={fields} values={rows.find(row => row.id === inspectedId).values}/></section>}
  </>;
  const formContent = () => <div className="tb-form-content">{variant === 'wizard' && <ol className="tb-steps" aria-label="表单步骤">{(fields.length > 1 ? ['基本信息', '补充内容', '核对提交'] : ['填写内容', '核对提交']).map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>}{isReview ? <div><h4>核对填写内容</h4><FieldSummary fields={fields} values={values}/></div> : renderFields(activeFields)}{submitted && <section className="tb-submitted" aria-label="本地提交结果"><strong>本地提交已完成</strong><FieldSummary fields={fields} values={submitted}/><p className="tb-help">此结果仅保留在当前预览中。</p></section>}</div>;
  const detailContent = () => editing ? <div className="tb-form-content">{renderFields(fields)}</div> : detail ? <FieldSummary fields={fields} values={detail.values} grouped={variant === 'sections'}/> : <div className="tb-empty"><strong>还没有详情内容</strong><p>进入编辑后填写当前对象信息。</p><Button primary onPress={primary}>填写详情</Button></div>;
  const renderSection = section => {
    if (section === 'intro') return <header className="tb-page-heading"><h3>{bp.title}</h3>{bp.description && <p>{bp.description}</p>}</header>;
    if (section === 'filters') return bp.family === 'list' ? <div className="tb-query"><R.TextField style={styles['search-field']} className="tb-field" value={query} onChange={setQuery}><R.Label>检索记录</R.Label><R.Input placeholder="搜索当前字段内容" onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); applyQuery(); } }}/></R.TextField><Button onPress={applyQuery}><Search size={15}/>查询</Button><Button onPress={resetQuery}>{bp.actions.secondaryLabel}</Button></div> : null;
    if (section === 'actions') return previewActions();
    return <div className="tb-main-content">{bp.family === 'list' ? listContent() : bp.family === 'form' ? formContent() : detailContent()}{!bp.sections.includes('actions') && previewActions()}</div>;
  };
  const stateContent = state === 'loading' ? ['正在载入样本', '加载状态示意。完成载入后恢复当前预览的数据。', '完成载入'] : state === 'error' ? ['内容加载失败', '错误状态示意。重试将恢复当前本地数据。', '重试加载'] : state === 'denied' ? ['暂时无法访问', '权限状态示意，当前没有接入账号或权限服务。', '返回可访问状态'] : ['暂无页面内容', '空内容状态示意，恢复后继续保留已填写的内容。', '恢复正常预览'];
  return <BlueprintStyles.Provider value={styles}><div className="tb-preview" data-theme={theme} style={css}>
    <div className="tb-preview-toolbar"><div className="tb-preview-selects"><Select label="预览框架" value={shell} options={SHELLS} onChange={setShell}/><Select label="预览变体" value={variant} options={VARIANTS[bp.family]} onChange={next => { setVariant(next); setErrors({}); }}/><Select label="页面状态" value={state} options={STATES} onChange={setState}/></div><Button onPress={resetRuntime}>重置演示</Button></div>
    <div className={`tb-shell tb-shell-${shell}`}>
      {shell !== 'none' && <aside className="tb-shell-nav" aria-label="页面框架示意"><strong><LayoutDashboard size={16}/>项目空间</strong><span className="tb-nav-item" aria-current="page">{bp.title}</span><small>当前页面</small></aside>}
      <div className="tb-page">{state === 'normal' || (state === 'empty' && bp.family === 'list') ? bp.sections.map(section => <React.Fragment key={section}>{renderSection(section)}</React.Fragment>) : <div className="tb-state" aria-live="polite"><span className="tb-state-indicator" data-state={state} aria-hidden="true"/><h3>{stateContent[0]}</h3><p>{stateContent[1]}</p><Button primary onPress={() => setState('normal')}>{stateContent[2]}</Button></div>}
        {message && <p className="tb-runtime-message" role="status">{message}</p>}
      </div>
    </div>
    <p className="tb-local-note">本地交互演示 · 数据操作只作用于当前预览，未连接业务接口。切换框架、变体或页面状态会保留当前输入。</p>
    {bp.family === 'list' && <R.ModalOverlay className="tb-modal-overlay" style={styles['alert-dialog']} isOpen={confirmDelete} onOpenChange={setConfirmDelete} isDismissable><R.Modal className="tb-modal"><R.Dialog className="tb-dialog" role="alertdialog"><R.Heading slot="title">删除所选 {selected.size} 条记录？</R.Heading><p>仅删除当前预览中的记录，可以撤销。模板和项目中保存的样本不会改变。</p><div className="tb-page-actions"><Button autoFocus onPress={() => setConfirmDelete(false)}>取消</Button><Button danger onPress={() => { const deleted = rows.filter(row => selected.has(row.id)); setRemoved(deleted); setRows(old => old.filter(row => !selected.has(row.id))); setSelected(new Set()); setConfirmDelete(false); report(`已删除 ${deleted.length} 条本地记录，可撤销。`); }}>确认删除</Button></div></R.Dialog></R.Modal></R.ModalOverlay>}
  </div></BlueprintStyles.Provider>;
}

/** Blueprint edits reset the sandbox; theme and parent renders do not. */
export function BlueprintPreview({ blueprint, source, template, theme = 'light', onEvent }) {
  const declared = template ? { ...template, blueprint } : { blueprint, componentIds: (source.components || []).map(component => component.id), patternIds: [] };
  const errors = validateBlueprintDependencies(declared, source);
  if (errors.length) return <section className="notice" role="alert"><strong>页面配置尚未就绪，暂不能运行预览。</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul><p>请在模板的“引用的交互模式与组件”中补齐所需角色。项目页面需使用依赖完整的锁定模板。</p></section>;
  const ids = [...new Set([...(declared.componentIds || []), ...(declared.patternIds || []).flatMap(id => source.patterns?.find(pattern => pattern.id === id)?.componentIds || [])])];
  const boundSource = { ...source, components: ids.map(id => source.components.find(component => component.id === id)).filter(Boolean) };
  return <BlueprintRuntime key={JSON.stringify(blueprint)} blueprint={blueprint} source={boundSource} theme={theme} onEvent={onEvent}/>;
}
