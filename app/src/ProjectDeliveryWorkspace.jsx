import React, { useEffect, useMemo, useState } from 'react';
import { ProjectDeliveryPanel } from './ProjectAcceptancePanel.jsx';
import { getProjectAcceptance, getCheckStatus } from './projectAcceptance.js';
import { compareProjectDelivery } from './projectDelivery.js';
import { applyProjectTheme } from './projectTheme.js';
import { resolvePageTemplate } from './templateBlueprint.js';
import './project-delivery.css';

const modeLabel = mode => mode === 'reviewed' ? '人工验收交付' : '协作草稿';
const statusLabel = {passed:'人工通过',failed:'需要修复',pending:'待检查',stale:'需复验'};
const categoryLabel = {pages:'页面配置',theme:'项目主题',assets:'引用资产',checks:'检查与证据',metadata:'项目信息'};
const dateLabel = value => new Date(value).toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

function ArchiveForm({project,onSave,onCancel}) {
  const ready=getProjectAcceptance(project).ready;
  const [title,setTitle]=useState(`${project.name} · d${project.designRevision ?? 1}`);
  const [note,setNote]=useState('');
  const [mode,setMode]=useState(ready ? 'reviewed' : 'draft');
  const [error,setError]=useState('');
  const submit=event=>{event.preventDefault();try{onSave({title:title.trim(),note:note.trim(),mode});}catch(reason){setError(reason.message);}};
  return <form className="dl-form" onSubmit={submit} aria-label="保存交付记录">
    <h4>保存当前版本</h4><p className="cv-field-help">记录将保留此刻的页面、资产和验收依据。后续编辑不会覆盖，重新交付时另存一条记录。</p>
    <div className="dl-form-fields"><label>交付名称<input autoFocus required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} /></label><label>记录类型<select value={mode} onChange={e=>setMode(e.target.value)}><option value="draft">协作草稿</option><option value="reviewed" disabled={!ready}>人工验收交付{!ready ? '（检查未齐备）' : ''}</option></select></label></div>
    <label>交付说明<textarea rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="说明本次交付的范围、用途或待确认事项" /></label>
    {error && <p role="alert" className="cv-form-error">{error}</p>}
    <div className="cv-inline-actions"><button type="submit" className="button primary">保存交付记录</button><button type="button" className="button" onClick={onCancel}>取消</button></div>
  </form>;
}

function ArchivedDelivery({record,project,onExport,onReuse,renderPreview,onOpenPage,onChecks}) {
  const [section,setSection]=useState('overview');
  const archived=record.package.project;
  const [pageId,setPageId]=useState(archived.pages[0]?.id);
  const [category,setCategory]=useState('all');
  const comparison=useMemo(()=>compareProjectDelivery(record,project),[record,project]);
  const source=useMemo(()=>applyProjectTheme(archived),[archived]);
  const page=archived.pages.find(item=>item.id === pageId) || archived.pages[0];
  const base=page && source.templates.find(item=>item.id === page.templateId);
  const template=base ? resolvePageTemplate(base,page) : null;
  const report=useMemo(()=>getProjectAcceptance(archived),[archived]);
  const visible=comparison.changes.filter(change=>category === 'all' || change.category === category);
  return <div className="dl-detail">
    <div className="dl-detail-heading"><div><h4>{record.title}</h4><p>{modeLabel(record.package.mode)} · {dateLabel(record.createdAt)} · r{archived.snapshot.revision} / d{archived.designRevision ?? 1}</p></div><div className="dl-detail-actions"><button className="button" type="button" disabled={!archived.pages.length} title={!archived.pages.length ? '此记录没有可复用的页面' : undefined} onClick={()=>onReuse(record)}>从此版本创建项目</button><button className="button" type="button" onClick={()=>onExport(record)}>下载此记录</button></div></div>
    {record.note && <p className="dl-note">{record.note}</p>}
    <div className="dl-detail-nav" aria-label="交付记录内容">{[['overview','交付概览'],['pages','当时的页面'],['checks','验收依据'],['compare',`与当前比较${comparison.changes.length ? ` ${comparison.changes.length}` : ''}`]].map(([id,label])=><button type="button" key={id} className={section === id ? 'active' : ''} aria-pressed={section === id} onClick={()=>setSection(id)}>{label}</button>)}</div>
    {section === 'overview' && <><dl className="cv-definition-list"><div><dt>交付项目</dt><dd>{archived.name}</dd></div><div><dt>页面范围</dt><dd>{archived.pages.map(item=>item.name).join('、') || '尚无页面'}</dd></div><div><dt>当时的验收</dt><dd>{report.totals.passed} / {report.totals.checks} 项人工通过{report.totals.missing > 0 && `，缺少 ${report.totals.missing} 项基础检查`}。{report.ready ? '当时的人工记录齐备。' : '此记录尚不满足人工验收交付条件。'}</dd></div><div><dt>后续变化</dt><dd>{comparison.changed ? <button className="cv-text-link" type="button" onClick={()=>setSection('compare')}>当前项目有 {comparison.changes.length} 项变化，查看明细</button> : '当前项目的设计内容与检查依据和此记录一致。'}</dd></div></dl><p className="cv-field-help">本机留档，用于回看和复用交付资料。人工记录不代表自动视觉验证或线上验收，历史预览使用当前工作台渲染器。</p></>}
    {section === 'pages' && <>{archived.pages.length ? <><label className="dl-page-select">查看留档页面<select value={page?.id || ''} onChange={e=>setPageId(e.target.value)}>{archived.pages.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="cv-field-help">这里使用留档的配置和资产；试用操作只影响预览，不会修改留档或当前项目。</p>{template && <div key={`${record.id}-${page.id}`} className="dl-preview">{renderPreview(template,source)}</div>}{project.pages.some(item=>item.id === page.id) && <button className="cv-text-link dl-current-page" type="button" onClick={()=>onOpenPage(page.id)}>查看当前项目中的「{page.name}」</button>}</> : <p className="dl-empty">此记录没有项目页面。</p>}</>}
    {section === 'checks' && <><p className="cv-field-help">以下为留档时的结论和证据，不代表当前项目已通过。当前问题请在人工验收中继续处理。</p><button className="cv-text-link" type="button" onClick={onChecks}>查看当前检查与复验</button>{archived.checks.map(check=><article className="dl-check" key={check.id}><div><strong>{check.name}</strong><span className={`cv-status cv-status-${getCheckStatus(archived,check)}`}>{statusLabel[getCheckStatus(archived,check)]}</span></div><p>{check.description || '未填写检查标准'}</p><p className="dl-evidence">{check.evidence || '尚未填写依据'}</p><small>记录版本 r{check.baselineRevision} / d{check.designRevision ?? 1}</small>{check.history?.length > 0 && <details><summary>历史证据 · {check.history.length}</summary>{[...check.history].reverse().map((previous,index)=><div className="dl-previous-check" key={index}><strong>{previous.name} · {statusLabel[previous.status]}</strong><small>r{previous.baselineRevision} / d{previous.designRevision ?? 1}</small><p>{previous.description}</p><p>{previous.evidence || '当时没有填写依据'}</p></div>)}</details>}</article>)}{!archived.checks.length && <p className="dl-empty">此记录尚未建立人工检查。</p>}</>}
    {section === 'compare' && <><p className="cv-field-help">从此交付记录到当前项目：对照页面配置、项目主题、实际引用资产及检查依据。留档 r{archived.snapshot.revision} / d{archived.designRevision ?? 1} → 当前 r{project.snapshot.revision} / d{project.designRevision ?? 1}。</p><div className="dl-filter" aria-label="变化分类"><button type="button" aria-pressed={category === 'all'} onClick={()=>setCategory('all')}>全部 {comparison.changes.length}</button>{Object.entries(categoryLabel).filter(([id])=>comparison.summary[id]>0).map(([id,label])=><button type="button" key={id} aria-pressed={category === id} onClick={()=>setCategory(id)}>{label} {comparison.summary[id]}</button>)}</div>{visible.length ? <div className="dl-changes">{visible.map(change=><article key={change.id}><h4>{change.label}</h4><div className="dl-before-after"><div><span>留档时</span><p>{change.before ?? '无'}</p>{change.fullBefore && <details><summary>查看完整内容</summary><p>{change.fullBefore}</p></details>}</div><div><span>当前项目</span><p>{change.after ?? '无'}</p>{change.fullAfter && <details><summary>查看完整内容</summary><p>{change.fullAfter}</p></details>}</div></div></article>)}</div> : <p className="dl-empty">{comparison.changed ? '此分类没有变化。' : '设计内容与检查依据没有变化。版本号变化本身不视为内容差异。'}</p>}</>}
  </div>;
}

export default function ProjectDeliveryWorkspace({project,initialRecordId,onSelectRecord,onReuse,onCreate,onExportRecord,renderPreview,onOpenPage,...currentProps}) {
  const [view,setView]=useState(initialRecordId ? 'history' : 'prepare');
  const [creating,setCreating]=useState(false);
  const [selectedId,setSelectedId]=useState(initialRecordId || null);
  useEffect(()=>{if(initialRecordId){setView('history');setSelectedId(initialRecordId);setQuery('');}},[initialRecordId]);
  const [query,setQuery]=useState('');
  const records=project.deliveries || [];
  const visible=[...records].reverse().filter(item=>`${item.title} ${item.note}`.toLowerCase().includes(query.toLowerCase().trim()));
  const selected=visible.find(item=>item.id === selectedId) || visible[0];
  const save=options=>{const id=onCreate(options);setSelectedId(id);setQuery('');setCreating(false);setView('history');onSelectRecord?.(id);};
  return <section className="dl-workspace">
    <div className="dl-toolbar"><div className="dl-segments" aria-label="设计交付"><button type="button" aria-pressed={view === 'prepare'} onClick={()=>setView('prepare')}>准备交付</button><button type="button" aria-pressed={view === 'history'} onClick={()=>{setView('history');if(selected?.id)onSelectRecord?.(selected.id);}}>交付记录 {records.length}</button></div><button className="button" type="button" disabled={creating} onClick={()=>setCreating(true)}>保存当前版本</button></div>
    {creating && <ArchiveForm project={project} onSave={save} onCancel={()=>setCreating(false)}/>}
    {view === 'prepare' ? <><p className="dl-intro">下载用于即时协作；需要在工作台回看时，先保存当前版本为交付记录。</p><ProjectDeliveryPanel project={project} {...currentProps}/></> : <div className="dl-history">{initialRecordId && !records.some(record=>record.id === initialRecordId) && <p className="notice" role="status">指定的交付记录不存在，下面显示本项目已有的记录。</p>}<div className="cv-section-heading"><div><h3>交付记录</h3><p className="cv-field-help">按交付时刻保存配置与证据，可回看、比较和重新下载。</p></div>{records.length>0 && <label className="dl-search">查找交付记录<input type="search" placeholder="按名称或说明查找" value={query} onChange={e=>setQuery(e.target.value)}/></label>}</div>{visible.length ? <><div className="dl-record-list" aria-label="已保存的交付记录">{visible.map(record=><button type="button" key={record.id} className={record.id === selected?.id ? 'active' : ''} aria-pressed={record.id === selected?.id} onClick={()=>{setSelectedId(record.id);onSelectRecord?.(record.id);}}><strong>{record.title}</strong><span>{modeLabel(record.package.mode)} · r{record.package.project.snapshot.revision} / d{record.package.project.designRevision ?? 1}</span><time dateTime={record.createdAt}>{dateLabel(record.createdAt)}</time></button>)}</div><ArchivedDelivery key={selected.id} record={selected} project={project} onExport={onExportRecord} onReuse={onReuse} renderPreview={renderPreview} onOpenPage={onOpenPage} onChecks={currentProps.onChecks}/></> : <div className="dl-empty"><p>{records.length ? '没有匹配的交付记录。试试缩短关键词。' : '还没有留档。保存当前版本后，就能回看当时的页面和验收依据。'}</p>{records.length ? <button className="cv-text-link" type="button" onClick={()=>setQuery('')}>清除搜索</button> : !creating && <button className="button" type="button" onClick={()=>setCreating(true)}>保存第一条交付记录</button>}</div>}</div>}
  </section>;
}
