import React, { useMemo, useState } from 'react';
import { getProjectUpgradeReview, applyProjectUpgradeReview } from './model.js';
import { applyProjectTheme } from './projectTheme.js';
import { resolvePageTemplate } from './templateBlueprint.js';
import './project-upgrade.css';

const labels = { none:'无导航', side:'侧边导航', top:'顶部导航', table:'表格', cards:'卡片', standard:'单页', wizard:'分步', summary:'摘要', sections:'分区', intro:'页面说明', filters:'筛选', actions:'操作', content:'内容', text:'文本', number:'数字', select:'选择', textarea:'多行文本' };
function Value({ state, entry }) {
  if (!state.present) return <span className="ur-absent">未配置 / 已移除</span>;
  const value=state.value;
  if (typeof value === 'boolean') return <span>{value ? '允许' : '不允许'}</span>;
  if (typeof value !== 'object' || value === null) return <span className="ur-value">{value === '' ? '（空文本）' : (entry.group === '页面结构' ? labels[value] || String(value) : String(value))}</span>;
  if (Array.isArray(value)) return <span className="ur-value">{value.length ? value.map(v=>labels[v] || v).join(' → ') : '（无条目）'}</span>;
  if (entry.group === '字段') return <div className="ur-value"><strong>{value.label}</strong><span>{labels[value.type] || value.type} · {value.required ? '必填' : '选填'}</span>{value.options?.length > 0 && <span>选项：{value.options.join('、')}</span>}</div>;
  if (entry.group === '示例数据') return <dl className="ur-data">{Object.entries(value.values || {}).map(([key,v])=><div key={key}><dt>{key}</dt><dd>{String(v) || '（空）'}</dd></div>)}</dl>;
  return <div className="ur-value"><span>{value.regions?.length ?? 0} 个区域</span>{value.regions?.map(region=><span key={region.id}>{region.title || '未命名区域'} · {region.columns} 列 · {region.items.length} 个实例</span>)}<details><summary>查看完整配置</summary><pre>{JSON.stringify(value,null,2)}</pre></details></div>;
}

export default function ProjectUpgradeReview({ doc, project, onApply, onClose, renderPreview }) {
  const [choicesByPage,setChoices]=useState({});
  // Capture the reviewed baseline once; later edits require opening a fresh review.
  const [initialKey]=useState(()=>getProjectUpgradeReview(doc,project.id).reviewKey);
  const [pageId,setPageId]=useState(project.pages[0]?.id);
  const [filter,setFilter]=useState('all');
  const [view,setView]=useState('changes');
  const [error,setError]=useState('');
  const review=useMemo(()=>getProjectUpgradeReview(doc,project.id,{choicesByPage}),[doc,project.id,choicesByPage]);
  const stale=review.reviewKey !== initialKey;
  const page=review.pages.find(p=>p.pageId === pageId) || review.pages[0];
  const entries=page?.entries.filter(entry=>filter !== 'conflicts' || entry.status === 'conflict') || [];
  const changes=review.pages.reduce((sum,p)=>sum+p.entries.length,0);
  const conflictTotal=review.pages.reduce((sum,p)=>sum+p.entries.filter(e=>e.status === 'conflict').length,0);
  const candidate=review.candidateProject;
  const source=useMemo(()=>candidate ? applyProjectTheme(candidate) : null,[candidate]);
  const candidatePage=candidate?.pages.find(p=>p.id === page?.pageId);
  const template=candidatePage && source ? resolvePageTemplate(source.templates.find(t=>t.id === candidatePage.templateId),candidatePage) : null;
  const choose=(entry,value)=>{setChoices(old=>({...old,[page.pageId]:{...old[page.pageId],[entry.id]:value}}));setError('');};
  const apply=()=>{try {onApply(applyProjectUpgradeReview(doc,project.id,{choicesByPage,reviewKey:initialKey}));} catch(reason){setError(reason.message);}};
  return <div className="ur-review">
    <div className="ur-intro"><div><p className="ur-eyebrow">{project.name}</p><h3>保留项目调整，核对共享更新</h3><p>基线 r{review.fromRevision} → r{review.toRevision} · 当前设计 d{review.designRevision}</p></div><div className="ur-progress" role="status"><strong>{review.errors.length ? '配置需修正' : review.unresolvedCount ? `${review.unresolvedCount} 项待选择` : '选择已就绪'}</strong><span>{changes} 项配置变化 · {conflictTotal} 项双方修改</span></div></div>
    <p className="ur-help">只在共享模板变化的地方采用更新；本页独立修改默认保留。双方改了同一项时，由你决定使用哪一版。基础规范、组件和模式随新基线更新。</p>
    {stale && <p className="cv-form-error" role="alert">审阅期间资产或项目已变化。请关闭后重新查看，避免按旧内容提交。</p>}
    <div className="ur-toolbar"><label>项目页面<select value={page?.pageId || ''} onChange={e=>{setPageId(e.target.value);setError('');}}>{review.pages.map(p=><option key={p.pageId} value={p.pageId}>{p.name} · {p.entries.length} 项变化{p.unresolved.length ? ` · ${p.unresolved.length} 项待选` : ''}</option>)}</select></label><div className="ur-views"><button type="button" aria-pressed={view==='changes'} onClick={()=>setView('changes')}>逐项核对</button><button type="button" aria-pressed={view==='preview'} onClick={()=>setView('preview')}>升级后预览</button></div></div>
    {view === 'changes' ? <>
      <div className="ur-filter"><button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>全部变化 {page?.entries.length || 0}</button><button type="button" aria-pressed={filter==='conflicts'} onClick={()=>setFilter('conflicts')}>双方修改 {page?.entries.filter(e=>e.status==='conflict').length || 0}</button></div>
      <div className="ur-entries">{entries.map(entry=><article key={entry.id} className={`ur-entry ${entry.status==='conflict' && !entry.choice ? 'ur-unresolved' : ''}`}><div className="ur-entry-heading"><h4>{entry.group} / {entry.label}</h4><span>{entry.choice ? (entry.choice === 'local' ? '保留本页' : '采用共享新版') : '需要选择'}</span></div>{entry.reason && <p className="ur-help">{entry.reason}</p>}<fieldset className="ur-choices"><legend className="cv-sr-only">{entry.group} / {entry.label}：选择保留内容</legend>{[['local','保留本页'],['incoming','采用共享新版']].map(([value,label])=><label key={value} className={entry.choice===value ? 'ur-chosen' : ''}><span className="ur-choice-head"><input type="radio" name={`${page.pageId}-${entry.id}`} value={value} checked={entry.choice===value} onChange={()=>choose(entry,value)}/>{label}</span><Value state={entry[value]} entry={entry}/></label>)}</fieldset><details className="ur-base"><summary>原采用版本 r{review.fromRevision}</summary><Value state={entry.base} entry={entry}/></details></article>)}</div>
      {!entries.length && <p className="notice">{filter==='conflicts' ? '此页面没有双方同时修改的配置。可在全部变化中核对自动选择。' : '此页面的配置没有变化。新基线中的规范、组件和模式仍会更新。'}</p>}
    </> : <div className="ur-preview">{template ? renderPreview(template,source) : <p className="notice">先处理全部页面的待选项和配置问题，再查看最终组合预览。</p>}</div>}
    {!!review.errors.length && <div className="cv-form-error" role="alert"><strong>以下问题需要先处理</strong><ul>{review.errors.map((message,i)=><li key={i}>{message}</li>)}</ul></div>}
    {error && <p className="cv-form-error" role="alert">{error}</p>}
    <div className="cv-dialog-actions ur-footer"><p>{project.checks.length} 项已有检查将标记为需复验，原证据保留。</p><button type="button" className="button" onClick={onClose}>暂不升级</button><button type="button" className="button primary" disabled={stale || !candidate || review.unresolvedCount>0 || review.fromRevision===review.toRevision} onClick={apply}>确认采用 r{review.toRevision}</button></div>
  </div>;
}
