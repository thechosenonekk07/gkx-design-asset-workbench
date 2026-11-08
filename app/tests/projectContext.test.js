import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDoc, createProject, upsertAsset, setProjectTheme, recordProjectCheck, upgradeProject, removeAsset, importDoc, validateDoc, upgradeTemplateLibrary } from '../src/model.js';
import { COMPONENT_CATALOG } from '../src/componentRegistry.js';
import { createProjectContext, projectContextMarkdown } from '../src/projectContext.js';
import { createProjectCheckPlan } from '../src/model.js';

const projectDoc = () => createProject(createInitialDoc(COMPONENT_CATALOG), { name: '通用体验', templateId: 't-create-form' });
test('design context reports page coverage and preserves previous evidence after revalidation', () => {
  let doc=projectDoc();const id=doc.projects[0].id;
  doc=recordProjectCheck(doc,id,{name:'旧自定义核对',status:'passed',evidence:'已人工核对'});
  assert.equal(createProjectContext(doc,id).verification.complete,false,'one custom success cannot claim page coverage');
  doc=createProjectCheckPlan(doc,id);
  for(const check of doc.projects[0].checks.filter(item=>item.dimension)) doc=recordProjectCheck(doc,id,{id:check.id,status:'passed',evidence:`单元测试证据：${check.dimension}`});
  assert.equal(createProjectContext(doc,id).verification.complete,true);
  doc=setProjectTheme(doc,id,{'radius.md':{value:8}});
  assert.equal(createProjectContext(doc,id).verification.complete,false);
  const check=doc.projects[0].checks.find(item=>item.dimension==='content');
  doc=recordProjectCheck(doc,id,{id:check.id,status:'passed',evidence:'单元测试复验依据：新修订内容'});
  const bundle=createProjectContext(importDoc(JSON.stringify(doc)),id);
  assert.ok(bundle.verification.checks.find(item=>item.id===check.id).history.some(item=>item.evidence==='单元测试证据：content'));
  assert.equal(bundle.verification.coverage.totals.stale,4);
});
test('context uses locked dependency closure and explicitly separates unlinked requirements', () => {
  const original = projectDoc();
  const doc = upsertAsset(original, 'components', { ...original.components[0], name: '后来改名' });
  const bundle = createProjectContext(doc, doc.projects[0].id);
  assert.equal(bundle.requirementSnapshot.status, 'not-linked');
  assert.equal(bundle.designSnapshot.effectiveAssets.components.find(x => x.kind === 'button').name, '按钮');
  assert.ok(bundle.designSnapshot.effectiveAssets.components.length < doc.components.length);
  assert.equal(bundle.implementation.executablePackage, null);
  assert.match(projectContextMarkdown(bundle), /尚未绑定经过确认的需求快照/);
});
test('project theme changes isolate baseline and invalidate previous acceptance even without shared revision change', () => {
  let doc = projectDoc(); const id = doc.projects[0].id;
  doc = recordProjectCheck(doc, id, { name: '布局检查', status: 'passed', evidence: '人工核对首屏' });
  const baseline = JSON.stringify(doc.projects[0].snapshot); const revision = doc.revision;
  doc = setProjectTheme(doc, id, { 'color.action': { value: '#176B54' } });
  assert.equal(doc.revision, revision);
  assert.equal(doc.projects[0].designRevision, 2);
  assert.equal(doc.projects[0].checks[0].status, 'stale');
  assert.equal(JSON.stringify(doc.projects[0].snapshot), baseline);
  assert.equal(createProjectContext(doc,id).designSnapshot.effectiveAssets.tokens.find(x=>x.id==='color.action').value, '#176B54');
  assert.notEqual(doc.tokens.find(x=>x.id==='color.action').value, '#176B54');
});
test('page changes invalidate checks and theme survives compatible baseline upgrades', () => {
  let doc = projectDoc(); const id = doc.projects[0].id;
  doc = setProjectTheme(doc,id,{'radius.md':{value:18}});
  doc = recordProjectCheck(doc,id,{name:'页面检查',status:'passed',evidence:'有截图'});
  const project = doc.projects[0];
  doc = upsertAsset(doc,'projects',{...project,pages:project.pages.map(x=>({...x,name:'新页面名称'}))});
  assert.equal(doc.projects[0].checks[0].status,'stale');
  doc = upsertAsset(doc,'tokens',{...doc.tokens.find(x=>x.id==='radius.md'),value:6});
  doc = upgradeProject(doc,id);
  const bundle=createProjectContext(doc,id);
  assert.equal(bundle.designSnapshot.effectiveAssets.tokens.find(x=>x.id==='radius.md').value,18);
  assert.equal(bundle.designSnapshot.baselineAssets.tokens.find(x=>x.id==='radius.md').value,6);
});
test('generic edits cannot silently remove project theme and retain passed acceptance', () => {
  let doc=projectDoc(); const id=doc.projects[0].id;
  doc=setProjectTheme(doc,id,{'radius.md':{value:16}});
  doc=recordProjectCheck(doc,id,{name:'已检查',status:'passed',evidence:'人工对照'});
  assert.throws(()=>upsertAsset(doc,'projects',{...doc.projects[0],themeOverrides:undefined}),/项目主题/);
  assert.equal(doc.projects[0].checks[0].status,'passed');
});
test('context excludes unused project overrides and blocks incompatible theme upgrades', () => {
  let doc=projectDoc(); const id=doc.projects[0].id;
  doc=setProjectTheme(doc,id,{'content.empty':{value:'本项目为空'},'radius.md':{value:16}});
  const bundle=createProjectContext(doc,id);
  assert.equal(bundle.designSnapshot.themeOverrides['content.empty'],undefined);
  const shared=upsertAsset(doc,'tokens',{...doc.tokens.find(x=>x.id==='radius.md'),unit:'rem'});
  assert.throws(()=>upgradeProject(shared,id),/类型\/单位改变/);
  assert.equal(doc.projects[0].snapshot.tokens.find(x=>x.id==='radius.md').unit,'px');
});
test('repeated template instances remain frozen in projects while live references prevent deletion', () => {
  let doc=createInitialDoc(COMPONENT_CATALOG);
  const composition={version:1,regions:[{id:'r-1',title:'操作',columns:2,items:[{id:'i-1',layer:'components',assetId:'c-button',label:'保存'},{id:'i-2',layer:'components',assetId:'c-button',label:'继续'}]}]};
  doc=upsertAsset(doc,'templates',{id:'t-flex',name:'灵活组合',layout:'list',componentIds:[],patternIds:[],composition});
  assert.deepEqual(doc.templates.find(x=>x.id==='t-flex').componentIds,['c-button']);
  assert.throws(()=>removeAsset(doc,'components','c-button'),/引用/);
  doc=createProject(doc,{name:'采用区域的项目',templateId:'t-flex'});
  const id=doc.projects[0].id;
  const modified=JSON.parse(JSON.stringify(composition)); modified.regions[0].items[0].label='保存新值';
  doc=upsertAsset(doc,'templates',{...doc.templates.find(x=>x.id==='t-flex'),composition:modified});
  const frozen=createProjectContext(importDoc(JSON.stringify(doc)),id).designSnapshot.effectiveAssets.templates[0];
  assert.equal(frozen.composition.regions[0].items[0].label,'保存');
  assert.equal(frozen.composition.regions[0].items.length,2);
  const malformed=JSON.parse(JSON.stringify(doc)); malformed.templates.find(x=>x.id==='t-flex').componentIds=[];
  assert.throws(()=>importDoc(malformed),/区域与引用清单不一致/);
});
test('stale acceptance still requires a valid historical design revision', () => {
  let doc=projectDoc(); const id=doc.projects[0].id;
  doc=recordProjectCheck(doc,id,{name:'旧检查',status:'pending'});
  doc=setProjectTheme(doc,id,{'radius.md':{value:10}});
  doc.projects[0].checks[0].designRevision=999;
  assert.throws(()=>validateDoc(doc),/设计修订无效/);
});


test('delivery keeps adopted baseline and exports independently resolved page contracts', () => {
  let doc = upgradeTemplateLibrary(createInitialDoc(COMPONENT_CATALOG));
  doc = createProject(doc, { name: '独立交付验证', templateId:'t-flex-list-table' });
  const project = doc.projects[0];
  const baseline = project.snapshot.templates.find(t => t.id === 't-flex-list-table').blueprint;
  const local = structuredClone(baseline);
  local.title = '客户清单'; local.fields[0].label = '客户名称'; local.actions.primaryLabel = '新增客户'; local.shell = 'top';
  doc = upsertAsset(doc,'projects',{id:project.id,pages:project.pages.map(p=>({...p,overrides:{blueprint:local}}))});
  const roundtrip = importDoc(JSON.stringify(doc));
  const bundle = createProjectContext(roundtrip,project.id);
  assert.equal(bundle.resolvedPages[0].template.blueprint.title,'客户清单');
  assert.equal(bundle.resolvedPages[0].template.blueprint.actions.primaryLabel,'新增客户');
  assert.equal(bundle.designSnapshot.baselineAssets.templates[0].blueprint.title,baseline.title);
  assert.equal(bundle.pages[0].overrides.blueprint.shell,'top');
  bundle.resolvedPages[0].template.blueprint.fields[0].label='独立导出副本';
  assert.equal(doc.projects[0].pages[0].overrides.blueprint.fields[0].label,'客户名称');
  assert.equal(upgradeTemplateLibrary(doc),doc, 'same catalogue is a no-op, so refresh does not report an update');
});
