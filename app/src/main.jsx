import React,{useState,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from 'react-aria-components';
import {Undo2,Sun,Moon,Download,Upload,ArrowLeft,ChevronDown,CheckCircle2} from 'lucide-react';
import {createInitialDoc,validateDoc,serializeDoc,importDoc,upgradeTemplateLibrary} from './model.js';
import {COMPONENT_CATALOG} from './componentRegistry.js';
import {upgradeComponentLibrary,CATALOG_RELEASE} from './componentLibrary.js';
import Foundations from './Foundations.jsx';
import Components from './Components.jsx';
import ChainViews from './ChainViews.jsx';
import {DraftContext,downloadFile} from './ui.jsx';
import {createLibraryStorage,readLibraryRaw} from './libraryStorage.js';
import {parseWorkbenchHash,workbenchHash} from './workbenchRoute.js';
import './styles.css';
import './component-preview.css';
import './chain-views.css';

const LAYERS={tokens:['基础规范','变量、主题与规则'],components:['组件资产','交互、样式与配置'],patterns:['交互模式','任务、反馈与恢复'],templates:['页面模板','布局与资产组合'],projects:['项目工作区','采用、走查与交付']};
const STORAGE=(import.meta.env.MODE==='github'?'gkx-design-asset-workbench-v1':'gkx-universal-assets-v1')+(location.search.includes('qa')?'-qa':'');
function readRoute(){return parseWorkbenchHash(location.hash)}
function checkKinds(doc){const all=[...doc.components,...doc.projects.flatMap(p=>p.snapshot.components)];const unknown=all.filter(c=>!COMPONENT_CATALOG.some(i=>i.kind===c.kind));if(unknown.length)throw new Error(`包含未接入的组件行为：${[...new Set(unknown.map(c=>c.kind))].join('、')}`);return doc}
function initialLibrary(){return upgradeTemplateLibrary({...createInitialDoc(COMPONENT_CATALOG),catalogRelease:CATALOG_RELEASE})}
function load(){
 let doc,storage=null;
 try {const raw=readLibraryRaw({storage:localStorage,key:STORAGE});storage=createLibraryStorage({storage:localStorage,key:STORAGE,expectedRaw:raw});if(!raw)return {doc:initialLibrary(),error:'',storage};doc=checkKinds(importDoc(raw));}
 catch(e){return {doc:initialLibrary(),storage,error:`本机记录读取失败：${e.message}。当前展示初始库，保存已暂停，原始记录未覆盖。`};}
 try {const next=upgradeTemplateLibrary(upgradeComponentLibrary(doc,COMPONENT_CATALOG));if(next!==doc){storage.save(serializeDoc(next));return {doc:next,error:'',storage,catalogNotice:`通用库已更新：新增 ${next.components.length-doc.components.length} 类组件、${next.templates.length-doc.templates.length} 个可配置模板。已有配置与项目版本保留。`};}}
 catch(e){return {doc,error:'',storage,catalogNotice:`通用资产暂未补充：${e.message}。已有资产可继续使用。`};}
 return {doc,error:'',storage};
}
class AppBoundary extends React.Component{state={error:null};static getDerivedStateFromError(error){return {error}}render(){return this.state.error?<div className="app-error"><h1>当前界面遇到了错误</h1><p>{this.state.error.message}</p><p>已保存的本机资产仍保留，请刷新后重试。</p><button onClick={()=>location.reload()}>重新加载</button></div>:this.props.children}}
function App(){
 const initial=useRef(null);if(!initial.current)initial.current=load();
 const [doc,setDoc]=useState(initial.current.doc),[storageError,setStorageError]=useState(initial.current.error),[route,setRoute]=useState(readRoute),[trail,setTrail]=useState([]),[theme,setTheme]=useState('light'),[toast,setToast]=useState(''),[undo,setUndo]=useState([]),[drafts,setDrafts]=useState({}),[catalogNotice,setCatalogNotice]=useState(initial.current.catalogNotice||'');
 const uploadRef=useRef(null);const timer=useRef(null);
 useEffect(()=>{const onHash=()=>setRoute(readRoute());window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash)},[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme},[theme]);
 function notify(message){setToast(message);clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(''),6000)}
 function persist(next){try{if(!initial.current.storage)throw new Error('无法访问本机存储，请先备份当前内容后重新加载。');initial.current.storage.save(serializeDoc(next));setStorageError('');return true}catch(e){setStorageError(e.message);throw e}}
 function change(next){if(initial.current.error)throw new Error('请先在提示中备份原始记录，再启用当前资产库。');validateDoc(next);persist(next);setUndo(prev=>[...prev.slice(-19),doc]);setDoc(next)}
 function navigate(layer,id='',options={}){if(!LAYERS[layer])return;if(id&&options.reference!==false){const label=route.id==='~new'?'新建组件草稿':doc[route.layer]?.find(x=>x.id===route.id)?.name;setTrail(prev=>[...prev.slice(-7),{...route,label:label?`${LAYERS[route.layer][0]} / ${label}`:LAYERS[route.layer][0]}])}else if(!options.keepTrail)setTrail([]);const next={layer,id,...(layer==='projects'&&options.deliveryId?{deliveryId:options.deliveryId}:{})};setRoute(next);location.hash=workbenchHash(next)}
 function goBack(){const previous=trail.at(-1);if(!previous)return;setTrail(trail.slice(0,-1));navigate(previous.layer,previous.id,{reference:false,keepTrail:true,deliveryId:previous.deliveryId})}
 function undoLast(){if(!undo.length)return;try{const previous=undo.at(-1);persist(previous);setUndo(undo.slice(0,-1));setDoc(previous);setDrafts({});notify('已恢复上一次修改前的资产。')}catch(e){notify(e.message)}}
 async function importFile(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;try{const next=upgradeTemplateLibrary(upgradeComponentLibrary(checkKinds(importDoc(await file.text())),COMPONENT_CATALOG));change(next);setDrafts({});notify('资产库已载入，可撤销恢复原记录。')}catch(err){notify(`未载入：${err.message}`)}}
 function recovery(){try{const raw=readLibraryRaw({storage:localStorage,key:STORAGE});downloadFile('original-workspace-record.json',raw||'{}');initial.current.storage=createLibraryStorage({storage:localStorage,key:STORAGE,expectedRaw:raw});initial.current.error='';setStorageError('');notify('原始记录已请求下载，当前通用库现在可以编辑保存。')}catch(e){setStorageError(e.message)}}
 const source=trail.at(-1);
 return <DraftContext.Provider value={{drafts,setDrafts}}><I18nProvider locale="zh-CN"><div className="workbench">
  <header className="app-header"><div className="brand"><span className="wordmark">gkx.</span><strong>设计资产工作台</strong><span className="edition">通用资产库</span></div><div className="header-tools"><span className="storage-state">{!storageError&&<CheckCircle2 size={14}/>} {storageError?'保存异常':'本机资产库'} · v{doc.revision}</span><button className="icon-button" title="撤销上次修改" aria-label="撤销上次修改" disabled={!undo.length} onClick={undoLast}><Undo2 size={17}/></button><button className="icon-button" aria-label={theme==='light'?'切换深色界面':'切换浅色界面'} onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?<Moon size={17}/>:<Sun size={17}/>}</button><details className="library-menu"><summary>资产库<ChevronDown size={14}/></summary><div className="menu-content"><button onClick={()=>downloadFile('gkx-universal-library.json',serializeDoc(doc))}><Download size={15}/>导出完整资产库</button><button onClick={()=>uploadRef.current?.click()}><Upload size={15}/>载入资产库 JSON</button><p>包含规范、组件、模式、模板及项目；本机存储，可导出备份。</p></div></details><input ref={uploadRef} type="file" accept="application/json,.json" hidden onChange={importFile}/></div></header>
  <nav className="chain-navigation" aria-label="设计资产全链路">{Object.entries(LAYERS).map(([key,[name,description]])=><a href={`#${key}`} key={key} aria-current={route.layer===key?'page':undefined} onClick={e=>{e.preventDefault();navigate(key)}}><strong>{name}</strong><span>{description}</span></a>)}</nav>
  <main className="app-main"><div className="context-line">{source?<button className="back-link" onClick={goBack}><ArrowLeft size={14}/>返回 {source.label}</button>:<span>共享资产{route.layer==='projects'?' / 项目采用与交付':` / ${LAYERS[route.layer][0]}`}</span>}<span>{route.layer==='projects'?'项目按采用版本独立管理':'编辑共享内容，项目版本按需升级'}</span></div>
  {catalogNotice&&['components','templates'].includes(route.layer)&&<div className="notice catalog-update-notice" role="status">{catalogNotice}<button className="text-button" onClick={()=>setCatalogNotice('')}>知道了</button></div>}
  {storageError&&<div className="notice error" role="alert">{storageError}{initial.current.error&&<button className="button" onClick={recovery}>备份原始记录并启用当前库</button>}</div>}
  {route.id&&!(route.layer==='components'&&route.id==='~new')&&!doc[route.layer]?.some(a=>a.id===route.id)&&<div className="notice">该资产不存在或已被删除，已显示当前层级内容。</div>}
  {route.layer==='tokens'?<Foundations doc={doc} onChange={change} navigate={navigate} selectedId={route.id} notify={notify}/>:route.layer==='components'?<Components doc={doc} onChange={change} navigate={navigate} selectedId={route.id} notify={notify} theme={theme}/>:<ChainViews layer={route.layer} deliveryId={route.deliveryId} doc={doc} onChange={change} navigate={navigate} selectedId={route.id} notify={notify} theme={theme}/>}
  </main><footer className="app-footer"><span>通用规范 · 可配置组件资产</span><span>引用可追溯 · 项目版本锁定 · 检查需证据</span></footer>{toast&&<div className="toast" role="status">{toast}</div>}
 </div></I18nProvider></DraftContext.Provider>
}
createRoot(document.getElementById('root')).render(<AppBoundary><App/></AppBoundary>);
