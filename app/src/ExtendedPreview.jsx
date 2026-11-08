import React,{useRef,useState} from 'react';
import * as R from 'react-aria-components';
import {Check,ChevronLeft,ChevronRight,X,Inbox,Info,CheckCircle2,AlertTriangle,AlertCircle} from 'lucide-react';
import {EXTENDED_KINDS,normalizeExtendedConfig} from './extendedCatalog.js';
import './extended-preview.css';
export {EXTENDED_KINDS};
const TOKENS=['primary','primary-hover','primary-pressed','on-primary','surface','text','muted','border','border-width','radius','height','font-family','font-size','font-weight','line-height','gap','focus','focus-width','focus-offset','disabled-opacity','duration','easing','danger','success','warning','shadow'];
function Control({children,primary=false,...props}){return <R.Button className={`ex-control${primary?' ex-control-primary':''}`} {...props}>{children}</R.Button>;}
function Drawer({config:c,report}){
  const root=useRef(null);const [style,setStyle]=useState({});
  const opened=next=>{if(next&&root.current){const css=getComputedStyle(root.current);setStyle(Object.fromEntries(TOKENS.map(key=>[`--asset-${key}`,css.getPropertyValue(`--asset-${key}`).trim()]).filter(([,value])=>value)));}report(next?'已打开抽屉':'已关闭抽屉');};
  return <div ref={root}><R.DialogTrigger onOpenChange={opened}><Control>{c.label}</Control><R.ModalOverlay className={`ex-drawer-overlay ex-side-${c.placement}`} style={style} isDismissable><R.Modal className="ex-drawer" style={{width:c.width}}><R.Dialog className="ex-drawer-dialog">{({close})=><><div className="ex-drawer-heading"><R.Heading slot="title">{c.label}</R.Heading><Control aria-label="关闭抽屉" onPress={close}><X size={18}/></Control></div><div className="ex-drawer-content"><p>{c.description}</p><dl><dt>内容类型</dt><dd>共享组件说明</dd><dt>交互方式</dt><dd>查看后关闭，返回原位置</dd></dl></div><div className="ex-drawer-actions"><Control onPress={close}>{c.cancelLabel||'关闭'}</Control><Control primary onPress={()=>{close();report('已完成查看，返回原位置');}}>{c.confirmLabel||'完成查看'}</Control></div></>}</R.Dialog></R.Modal></R.ModalOverlay></R.DialogTrigger></div>;
}
function Pagination({config:c,report}){
  const [page,setPage]=useState(c.value);const pages=Math.max(1,Math.ceil(c.total/c.pageSize));
  const current=Math.min(page,pages);const items=[...new Set([1,current-1,current,current+1,pages].filter(value=>value>=1&&value<=pages))].sort((a,b)=>a-b);
  const go=next=>{const value=Math.max(1,Math.min(pages,next));setPage(value);report(`已切换到第 ${value} 页，显示第 ${(value-1)*c.pageSize+1}–${Math.min(c.total,value*c.pageSize)} 条`);};
  return <nav className="ex-pagination" aria-label={c.label}><p className="ex-caption">{c.total?`第 ${(current-1)*c.pageSize+1}–${Math.min(c.total,current*c.pageSize)} 条，共 ${c.total} 条`:'共 0 条'}</p><div className="ex-page-controls"><Control aria-label="上一页" isDisabled={c.disabled||current===1||!c.total} onPress={()=>go(current-1)}><ChevronLeft size={16}/></Control>{items.map((value,index)=><React.Fragment key={value}>{index>0&&value-items[index-1]>1&&<span aria-hidden="true">…</span>}<Control aria-label={`第 ${value} 页`} aria-current={value===current?'page':undefined} primary={value===current} isDisabled={c.disabled||!c.total} onPress={()=>go(value)}>{value}</Control></React.Fragment>)}<Control aria-label="下一页" isDisabled={c.disabled||current===pages||!c.total} onPress={()=>go(current+1)}><ChevronRight size={16}/></Control></div></nav>;
}
function Steps({config:c,compact,report}){
  const [step,setStep]=useState(c.value);const [complete,setComplete]=useState(false);
  const change=next=>{setStep(next);setComplete(false);report(`当前步骤：${c.options[next-1]}`);};
  return <section className={`ex-steps ex-${c.orientation}`} aria-label={c.label}><ol>{c.options.map((item,index)=><li key={`${index}-${item}`} data-done={complete||index+1<step} aria-current={!complete&&index+1===step?'step':undefined}><span className="ex-step-dot" aria-hidden="true">{complete||index+1<step?<Check size={13}/>:index+1}</span><span>{item}</span></li>)}</ol>{!compact&&<p className="ex-caption">{complete?'流程已完成':`第 ${step} 步：${c.options[step-1]}`}</p>}<div className="ex-step-actions">{complete?<Control onPress={()=>change(1)}>重新开始</Control>:<><Control isDisabled={step===1} onPress={()=>change(step-1)}>上一步</Control><Control primary onPress={()=>{if(step<c.options.length)change(step+1);else{setComplete(true);report('全部步骤已完成（本地演示）');}}}>{step===c.options.length?'完成':'下一步'}</Control></>}</div></section>;
}
function Textarea({config:c,compact,report}){
  const [value,setValue]=useState(c.value);
  return <R.TextField className="ex-textarea" value={value} onChange={next=>{setValue(next);report(`已输入 ${next.length} 字`);}} isDisabled={c.disabled} isRequired={c.required} isInvalid={c.invalid} validationBehavior="aria"><R.Label>{c.label}{c.required&&<span aria-hidden="true"> *</span>}</R.Label><R.TextArea rows={compact?2:c.rows} maxLength={c.maxLength} placeholder={c.placeholder}/><div className="ex-textarea-meta"><R.Text slot="description">{c.description}</R.Text><span>{value.length}/{c.maxLength}</span></div><R.FieldError>{c.errorMessage}</R.FieldError></R.TextField>;
}
function Removable({kind,config:c,report}){
  const [visible,setVisible]=useState(true);const alert=kind==='alert';
  if(!visible)return <Control onPress={()=>{setVisible(true);report(alert?'已重新显示提示':'已恢复标签');}}>{alert?'重新显示提示':'恢复标签'}</Control>;
  const Icon={success:CheckCircle2,warning:AlertTriangle,danger:AlertCircle}[c.theme]||Info;
  return alert?<div className={`ex-alert ex-tone-${c.theme}`} role={c.theme==='danger'?'alert':'status'}><Icon className="ex-alert-icon" size={19} aria-hidden="true"/><div><strong>{c.label}</strong>{c.description&&<p>{c.description}</p>}</div>{c.closable&&<Control aria-label="关闭提示" onPress={()=>{setVisible(false);report('已关闭提示');}}><X size={15}/></Control>}</div>:<span className={`ex-tag ex-tone-${c.theme}`}>{c.label}{c.closable&&<Control aria-label={`移除${c.label}`} onPress={()=>{setVisible(false);report(`已移除：${c.label}`);}}><X size={13}/></Control>}</span>;
}
/** Every stateful sample remounts when saved configuration changes. */
export function ExtendedPreview({kind,config={},compact=false,onEvent}){
  const c=normalizeExtendedConfig(kind,config);
  return <ExtendedSample key={`${kind}:${JSON.stringify(c)}`} kind={kind} config={c} compact={compact} onEvent={onEvent}/>;
}
function ExtendedSample({kind,config:c,compact,onEvent}){
  const [message,setMessage]=useState('');
  const report=text=>{setMessage(text);onEvent?.(text);};let sample;
  switch(kind){
    case 'typography':{const Text=c.level==='title'?'h3':'p';sample=<div className={`ex-typography ex-text-${c.level}`}><Text>{c.label}</Text>{c.description&&<p className="ex-description">{c.description}</p>}</div>;break;}
    case 'avatar':sample=<span className={`ex-avatar ex-size-${c.size} ex-shape-${c.shape}`} role="img" aria-label={c.label}>{String(c.label||'?').slice(0,2)}</span>;break;
    case 'badge':sample=<span className="ex-badge-container" aria-label={`${c.label}，${c.value} 条待处理`}><span>{c.label}</span>{c.value>0&&<span className={`ex-badge ${c.dot?'ex-badge-dot':''}`} aria-hidden="true">{c.dot?'':c.value>c.max?`${c.max}+`:c.value}</span>}</span>;break;
    case 'tag':case 'alert':sample=<Removable kind={kind} config={c} report={report}/>;break;
    case 'card':sample=<article className="ex-card" data-bordered={c.bordered}><h3>{c.label}</h3><p>{c.description}</p><ul>{c.options.map((text,index)=><li key={index}>{text}</li>)}</ul></article>;break;
    case 'descriptions':sample=<section className="ex-descriptions" aria-label={c.label}><h3>{c.label}</h3><dl data-bordered={c.bordered} style={{'--ex-columns':c.columns}}>{c.options.map((text,index)=>{const match=text.match(/^([^：:]+)[：:]([\s\S]*)$/);return <div key={index}><dt>{match?match[1]:text}</dt><dd>{match?(match[2].trim()||'—'):'—'}</dd></div>;})}</dl></section>;break;
    case 'empty':sample=<div className="ex-empty"><Inbox size={compact?28:38} aria-hidden="true"/><strong>{c.label}</strong><p>{c.description}</p>{c.confirmLabel&&<Control onPress={()=>report(`已触发「${c.confirmLabel}」（本地演示）`)}>{c.confirmLabel}</Control>}</div>;break;
    case 'skeleton':sample=<div className="ex-skeleton" role="status" aria-label={c.label} aria-busy="true" data-animated={c.animated}><div className="ex-skeleton-content" aria-hidden="true">{c.avatar&&<span className="ex-skeleton-avatar"/>}<div>{Array.from({length:c.rows},(_,index)=><span key={index} style={{width:index===c.rows-1?'65%':'100%'}}/>)}</div></div></div>;break;
    case 'loading':sample=<div className={`ex-loading ex-size-${c.size}`} role="status"><span className={`ex-indicator ex-${c.indicator}`} aria-hidden="true">{c.indicator==='dots'&&<><i/><i/><i/></>}</span><span>{c.label}</span></div>;break;
    case 'pagination':sample=<Pagination config={c} report={report}/>;break;
    case 'steps':sample=<Steps config={c} compact={compact} report={report}/>;break;
    case 'textarea':sample=<Textarea config={c} compact={compact} report={report}/>;break;
    case 'drawer':sample=<Drawer config={c} report={report}/>;break;
    case 'space':sample=<div className={`ex-space ex-${c.orientation}`} aria-label={c.label} style={{gap:c.gap}}>{c.options.map((text,index)=><span key={index}>{text}</span>)}</div>;break;
    case 'layout':sample=<section className="ex-layout" aria-label={`${c.label}布局示例`} style={{gap:c.gap}}><div className="ex-layout-header">{c.label}</div><div className="ex-layout-body" style={{gap:c.gap}}>{c.sidebar&&<aside>侧栏</aside>}<section aria-label="内容区域">{c.description}</section></div><div className="ex-layout-footer">页脚</div></section>;break;
    default:sample=<p role="alert">尚未接入的组件：{kind}</p>;
  }
  return <div className={`ex-example${compact?' ex-compact':''}`}><div className="ex-stage">{sample}</div>{!compact&&message&&<p className="ex-event" role="status">{message}</p>}</div>;
}
export default ExtendedPreview;
