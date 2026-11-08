import React, { useEffect, useMemo, useState } from 'react';
import { applyProjectTheme, resetProjectThemeValue } from './projectTheme.js';
import { resolveToken, tokenCSS, validateDoc, SCHEMA_VERSION } from './model.js';
import { ComponentPreview } from './ComponentPreview.jsx';
import './project-theme.css';

const clone = value => JSON.parse(JSON.stringify(value));
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const format = (token, value) => `${typeof value === 'boolean' ? (value ? '开启' : '关闭') : value}${token.unit || ''}`;
const typeNames = { color: '颜色', number: '数字', string: '文本', boolean: '布尔', duration: '时长', cubicBezier: '缓动', shadow: '阴影' };

export default function ProjectThemeEditor({ project, onSave, theme = 'light' }) {
  const [draft, setDraft] = useState(() => clone(project.themeOverrides || {}));
  const [group, setGroup] = useState('语义颜色');
  const [query, setQuery] = useState('');
  const [onlyOverrides, setOnlyOverrides] = useState(false);
  const [mode, setMode] = useState(theme);
  const [saveError, setSaveError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  useEffect(() => { setDraft(clone(project.themeOverrides || {})); setSaveError(''); setSavedMessage(''); }, [project.id, project.themeOverrides, project.snapshot]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(project.themeOverrides || {});
  const candidate = useMemo(() => {
    try {
      const snapshot = applyProjectTheme({ ...project, themeOverrides: draft });
      validateDoc({ schemaVersion: SCHEMA_VERSION, ...snapshot, projects: [], history: [] });
      return { snapshot, error: '' };
    } catch (error) { return { snapshot: applyProjectTheme(project), error: error.message }; }
  }, [project, draft]);
  const groups = [...new Set(project.snapshot.tokens.map(token => token.group))];
  const rows = project.snapshot.tokens.filter(token => (!group || token.group === group) && (!onlyOverrides || draft[token.id]) && (!query.trim() || `${token.id} ${token.name} ${token.description || ''}`.toLowerCase().includes(query.trim().toLowerCase())));
  const field = mode === 'dark' ? 'darkValue' : 'value';
  const patch = (id, value) => { setDraft(old => ({ ...old, [id]: { ...old[id], [field]: value } })); setSaveError(''); setSavedMessage(''); };
  const reset = (id, targetField) => { setDraft(old => resetProjectThemeValue(old, id, targetField)); setSaveError(''); setSavedMessage(''); };
  const previewComponents = ['button', 'text-field'].map(kind => candidate.snapshot.components.find(component => component.kind === kind)).filter(Boolean);
  const save = () => { try { if (candidate.error) throw new Error(candidate.error); onSave(clone(draft)); setSavedMessage('项目规范已保存；共享库与其他项目保持原样。'); setSaveError(''); } catch (error) { setSaveError(error.message); } };
  return <section className="project-theme-editor">
    <div className="cv-section-heading"><div><h3>项目专属规范</h3><p className="muted cv-compact-copy">继承锁定的共享规范 r{project.snapshot.revision}，按需覆盖本项目的品牌、密度与表现。</p></div><span className="pt-override-count">{Object.keys(draft).length} 个变量已自定义</span></div>
    <div className="pt-preview" data-preview-theme={mode} style={tokenCSS(candidate.snapshot, {}, mode)}><div className="pt-preview-label"><strong>本项目效果</strong><span>{candidate.error ? '输入待修正 · 暂显示已保存效果' : dirty ? '草稿预览' : '已保存规范'}</span></div><div className="pt-preview-components">{previewComponents.map(component => <div className="asset-preview" key={component.id} style={tokenCSS(candidate.snapshot, component.bindings, mode)}><ComponentPreview kind={component.kind} config={component.config} compact /></div>)}</div><p>示例沿用项目锁定的组件及变量绑定。保存后，同一项目引用这些变量的页面会一起更新。</p></div>
    <div className="pt-toolbar"><label className="field">查找项目变量<input type="search" value={query} onChange={event => { setQuery(event.target.value); if (event.target.value) setGroup(''); }} placeholder="名称、标识或用途" /></label><label className="field">变量分类<select value={group} onChange={event => setGroup(event.target.value)}><option value="">全部分类</option>{groups.map(value => <option key={value}>{value}</option>)}</select></label><div className="pt-mode" role="group" aria-label="编辑项目规范主题">{[['light', '浅色值'], ['dark', '深色值']].map(([value, label]) => <button type="button" key={value} className={mode === value ? 'selected' : ''} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}</div></div>
    <div className="pt-list-heading"><span>{rows.length} 个变量</span><label><input type="checkbox" checked={onlyOverrides} onChange={event => setOnlyOverrides(event.target.checked)} />仅看自定义</label></div>
    <div className="pt-token-list">{rows.map(token => {
      const customized = own(draft[token.id] || {}, field);
      const inherited = resolveToken(project.snapshot, token.id, mode);
      const current = customized ? draft[token.id][field] : resolveToken(candidate.snapshot, token.id, mode);
      const inputId = `project-theme-${project.id}-${token.id}-${field}`;
      return <div className="pt-token-row" key={token.id}><div className="pt-token-description"><label htmlFor={inputId}>{token.type === 'color' && <span className="pt-swatch" style={{ background: String(resolveToken(candidate.snapshot, token.id, mode)) }} />}{token.name}</label><code>{token.id}</code><small>{typeNames[token.type]}{token.description ? ` · ${token.description}` : ''}</small></div><div className="pt-token-editor">{token.type === 'boolean' ? <select id={inputId} value={String(current)} onChange={event => patch(token.id, event.target.value === 'true')}><option value="true">开启</option><option value="false">关闭</option></select> : <div className="pt-value-input"><input id={inputId} type={['number', 'duration'].includes(token.type) ? 'number' : 'text'} value={current ?? ''} min={token.min ?? (token.type === 'duration' ? 0 : undefined)} max={token.max} step="any" onChange={event => patch(token.id, ['number', 'duration'].includes(token.type) && event.target.value !== '' ? Number(event.target.value) : event.target.value)} />{token.unit && <span>{token.unit}</span>}</div>}<small>基线：{format(token, inherited)}{token.alias && ` · 引用 ${token.alias}`}</small></div><div className="pt-token-origin"><span className={customized ? 'pt-local' : ''}>{customized ? '项目自定义' : '继承共享规范'}</span><button type="button" className="cv-text-link" disabled={!customized} onClick={() => reset(token.id, field)}>恢复继承</button></div></div>;
    })}{!rows.length && <div className="empty-state">没有匹配的变量。<button type="button" className="cv-text-link" onClick={() => { setGroup(''); setQuery(''); setOnlyOverrides(false); }}>查看全部</button></div>}</div>
    {(candidate.error || saveError) && <p className="cv-form-error" role="alert">{saveError || candidate.error}</p>}
    <div className="pt-save-row"><button type="button" className="button primary" disabled={!dirty || !!candidate.error} onClick={save}>保存项目规范</button><button type="button" className="button" disabled={!dirty} onClick={() => { setDraft(clone(project.themeOverrides || {})); setSaveError(''); setSavedMessage(''); }}>放弃草稿</button><span className="muted">{dirty ? '修改尚未保存；保存后相关验收需重新检查。' : '共享基线与项目自定义分别保存，可逐项恢复继承。'}</span></div>
    {savedMessage && <p className="cv-interaction" role="status">{savedMessage}</p>}
  </section>;
}
