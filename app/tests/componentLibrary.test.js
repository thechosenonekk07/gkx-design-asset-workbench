import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPONENT_CATALOG} from '../src/componentRegistry.js';
import {createInitialDoc,createProject,removeAsset,validateDoc} from '../src/model.js';
import {upgradeComponentLibrary,CATALOG_RELEASE} from '../src/componentLibrary.js';
import {COMPONENT_GROUPS,componentTaxonomy,matchesComponent} from '../src/componentTaxonomy.js';

test('every executable component belongs to one user-facing category and family',()=>{
  const names=new Set(COMPONENT_GROUPS.map(g=>g.name));
  for(const item of COMPONENT_CATALOG){
    const taxonomy=componentTaxonomy(item);
    assert.ok(names.has(taxonomy.category),item.kind);
    assert.notEqual(taxonomy.family,'其他',item.kind);
  }
  assert.equal(componentTaxonomy({kind:'date-picker',category:'日期时间'}).category,'输入');
  assert.equal(componentTaxonomy({kind:'color-area',category:'颜色编辑'}).family,'颜色编辑');
  assert.equal(matchesComponent(COMPONENT_CATALOG.find(c=>c.kind==='text-field'),'Input'),true);
  assert.equal(matchesComponent(COMPONENT_CATALOG.find(c=>c.kind==='separator'),'Divider'),true);
});

test('new release appends assets without overwriting edits or locked project snapshots',()=>{
  const legacy=COMPONENT_CATALOG.filter(c=>!c.addedIn);
  let doc=createInitialDoc(legacy);
  doc.components.find(c=>c.kind==='button').name='团队自己的按钮';
  doc.components.find(c=>c.kind==='button').config.label='保留我的文案';
  doc=createProject(doc,{name:'既有交付',templateId:'t-resource-list'});
  const original=JSON.stringify(doc);
  const oldProject=JSON.stringify(doc.projects);
  const upgraded=upgradeComponentLibrary(doc,COMPONENT_CATALOG);
  assert.equal(JSON.stringify(doc),original,'must not mutate caller state');
  assert.equal(JSON.stringify(upgraded.projects),oldProject,'adopted baselines must be byte-identical');
  assert.equal(upgraded.components.find(c=>c.kind==='button').name,'团队自己的按钮');
  assert.equal(upgraded.components.find(c=>c.kind==='button').config.label,'保留我的文案');
  assert.equal(upgraded.components.length,COMPONENT_CATALOG.length);
  assert.equal(upgraded.catalogRelease,CATALOG_RELEASE);
  assert.equal(validateDoc(upgraded),true);
  assert.equal(upgradeComponentLibrary(upgraded,COMPONENT_CATALOG),upgraded,'no repeated upgrade');
});

test('catalog upgrade respects removed original assets and does not resurrect deletions',()=>{
  let doc=createInitialDoc(COMPONENT_CATALOG.filter(c=>!c.addedIn));
  doc=removeAsset(doc,'components','c-color-area');
  doc=upgradeComponentLibrary(doc,COMPONENT_CATALOG);
  assert.equal(doc.components.some(c=>c.kind==='color-area'),false);
  if(doc.components.some(c=>c.id==='c-avatar')){
    doc=removeAsset(doc,'components','c-avatar');
    assert.equal(upgradeComponentLibrary(doc,COMPONENT_CATALOG).components.some(c=>c.id==='c-avatar'),false);
  }
});
