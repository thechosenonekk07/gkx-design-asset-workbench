import React, {createContext, useContext} from 'react';
import {Download, Search, X, ArrowUpRight} from 'lucide-react';
export const DraftContext=createContext(null);
export function useDraft(key,initial){const {drafts,setDrafts}=useContext(DraftContext);return [drafts[key]??initial,value=>setDrafts(prev=>({...prev,[key]:typeof value==='function'?value(prev[key]??initial):value})),()=>setDrafts(prev=>{const next={...prev};delete next[key];return next;})];}
export function SearchBox({value,onChange,placeholder='搜索名称、用途或标识'}){return <label className="search"><Search size={16}/><input aria-label={placeholder} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{value&&<button type="button" aria-label="清空搜索" onClick={()=>onChange('')}><X size={14}/></button>}</label>}
export function Field({label,children,hint}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
export function downloadFile(name,contents,type='application/json'){const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function ExportButton({name,contents,label='导出 JSON'}){return <button type="button" className="button" onClick={()=>downloadFile(name,typeof contents==='function'?contents():contents)}><Download size={15}/>{label}</button>}
export function ReferenceLink({layer,id,name,navigate}){return <button type="button" className="reference-link" onClick={()=>navigate(layer,id)}>{name}<ArrowUpRight size={13}/></button>}
export function Empty({children}){return <div className="empty-state">{children}</div>}
