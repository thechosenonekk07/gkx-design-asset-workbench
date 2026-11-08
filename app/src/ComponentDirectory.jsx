import React,{useRef} from 'react';
import {Plus,LayoutGrid,List,ArrowUpRight,SearchX} from 'lucide-react';
import {COMPONENT_CATALOG} from './componentRegistry.js';
import {ComponentPreview} from './ComponentPreview.jsx';
import {COMPONENT_GROUPS,componentTaxonomy,matchesComponent} from './componentTaxonomy.js';
import {SearchBox} from './ui.jsx';
import {tokenCSS} from './model.js';
import './component-directory.css';

export default function ComponentDirectory({doc,onCreate,onOpen,theme,state,setState}) {
  const {query='',category='全部',family='全部',view='grid',source='all'}=state;
  const resultsRef=useRef(null);
  const update=patch=>setState(old=>({...old,...patch}));
  const scoped=doc.components.filter(c=>source==='all'||(source==='custom'?c.custom:!c.custom));
  const selectedGroup=COMPONENT_GROUPS.find(g=>g.name===category);
  const categoryItems=scoped.filter(c=>category==='全部'||componentTaxonomy(c).category===category);
  const families=[...new Set(categoryItems.map(c=>componentTaxonomy(c).family))];
  const rows=categoryItems.filter(c=>(family==='全部'||componentTaxonomy(c).family===family)&&matchesComponent(c,query));
  const sectionNames=category==='全部'?COMPONENT_GROUPS.map(g=>g.name):[category];
  const builtinTypes=new Set(doc.components.filter(c=>!c.custom).map(c=>c.kind)).size;
  function selectCategory(name){update({category:name,family:'全部'});resultsRef.current?.scrollIntoView({block:'start'});}
  function info(c){return COMPONENT_CATALOG.find(item=>item.kind===c.kind)||c;}
  return <section className="component-library" aria-label="组件资产库">
    <div className="page-head"><div><h1>组件资产</h1><p>按用途找到组件，在真实示例中理解规范，再创建适合你的配置。</p></div><button className="button primary" onClick={onCreate}><Plus size={16}/>创建组件</button></div>
    <div className="library-catalog-layout">
      <aside className="component-directory"><nav aria-label="组件用途分类">
        <button className={category==='全部'?'selected':''} aria-pressed={category==='全部'} onClick={()=>selectCategory('全部')}><span><strong>全部组件</strong><small>通用底座与自定义配置</small></span><span className="directory-count">{scoped.length}</span></button>
        {COMPONENT_GROUPS.map(group=><button key={group.name} className={category===group.name?'selected':''} aria-pressed={category===group.name} onClick={()=>selectCategory(group.name)}><span><strong>{group.name}</strong><small>{group.description}</small></span><span className="directory-count">{scoped.filter(c=>componentTaxonomy(c).category===group.name).length}</span></button>)}
      </nav><div className="component-directory-note"><strong>{builtinTypes} 类通用底座</strong><p>同类的自定义配置独立保存，项目继续采用已锁定的版本。</p><a href="https://tdesign.tencent.com/vue-next/components/button" target="_blank" rel="noreferrer">分类与规范参考<ArrowUpRight size={13}/></a></div></aside>
      <div className="component-results" ref={resultsRef}>
        <div className="component-findbar"><SearchBox value={query} onChange={query=>update({query})} placeholder="搜索名称、用途或别名，如 Input、分页"/><label className="catalog-source"><span className="sr-only">资产范围</span><select value={source} onChange={e=>update({source:e.target.value,family:'全部'})}><option value="all">全部资产</option><option value="builtin">通用底座</option><option value="custom">自定义配置</option></select></label><div className="catalog-view-toggle" aria-label="目录视图"><button aria-label="卡片视图" aria-pressed={view==='grid'} className={view==='grid'?'selected':''} onClick={()=>update({view:'grid'})}><LayoutGrid size={17}/></button><button aria-label="列表视图" aria-pressed={view==='list'} className={view==='list'?'selected':''} onClick={()=>update({view:'list'})}><List size={18}/></button></div></div>
        <div className="catalog-result-summary" role="status"><span>{selectedGroup?selectedGroup.guide:'基础、布局、导航、输入、展示、反馈，按使用任务归纳。'}</span><span>{rows.length} 项{query?'匹配结果':''}</span></div>
        {category!=='全部'&&families.length>1&&<nav className="catalog-family-filter" aria-label="组件细分类">{['全部',...families].map(name=><button key={name} aria-pressed={family===name} className={family===name?'selected':''} onClick={()=>update({family:name})}>{name}</button>)}</nav>}
        {rows.length===0?<div className="catalog-empty"><SearchX size={28}/><h2>没有找到匹配的组件</h2><p>试试组件别名，或扩大分类和资产范围。</p><button className="button" onClick={()=>update({query:'',category:'全部',family:'全部',source:'all'})}>重置筛选</button></div>:sectionNames.map(name=>{
          const entries=rows.filter(c=>componentTaxonomy(c).category===name);
          if(!entries.length)return null;
          return <section className="catalog-group" key={name} aria-label={`${name}组件`}><div className="catalog-group-heading"><h2>{name}<span>{entries.length}</span></h2><p>{COMPONENT_GROUPS.find(g=>g.name===name)?.description}</p></div>
            {view==='grid'?<div className="component-grid">{entries.map(c=>{const entry=info(c);return <article className="component-card" key={c.id}><div className="component-card-preview"><div className="asset-preview" style={tokenCSS(doc,c.bindings,theme)}><ComponentPreview kind={c.kind} config={c.config} compact/></div></div><div className="component-card-info"><button className="component-title" onClick={()=>onOpen(c.id)}>{c.name}<span>{c.en||entry.en||c.kind}</span></button><p>{c.description}</p><div className="component-card-foot"><span>{c.custom?'自定义 · ':''}{entry.spec?.examples?.length||1} 个示例</span><button className="text-button" aria-label={`查看${c.name}规范与配置`} onClick={()=>onOpen(c.id)}>规范与配置<ArrowUpRight size={13}/></button></div></div></article>})}</div>:<div className="catalog-list">{entries.map(c=>{const entry=info(c);return <button className="catalog-list-row" key={c.id} onClick={()=>onOpen(c.id)}><span className="catalog-list-name"><strong>{c.name}</strong><small>{c.en||entry.en||c.kind}</small></span><span className="catalog-list-description">{c.description}</span><span className="catalog-list-meta">{c.custom?'自定义 · ':''}{entry.spec?.examples?.length||1} 个示例 · {entry.capabilities?.length||0} 项配置</span><ArrowUpRight size={15}/></button>})}</div>}
          </section>;
        })}
      </div>
    </div>
  </section>;
}
