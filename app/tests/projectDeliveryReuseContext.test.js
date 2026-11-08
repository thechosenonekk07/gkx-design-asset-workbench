import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialDoc, upgradeTemplateLibrary, createProject, createProjectCheckPlan,
  recordProjectCheck, createProjectDeliveryRecord, createProjectFromDelivery,
  setProjectTheme, upsertAsset,
} from '../src/model.js';
import { COMPONENT_CATALOG } from '../src/componentRegistry.js';
import { createProjectContext, createArchivedProjectContext, projectContextMarkdown } from '../src/projectContext.js';

const SOURCE_ID = 'source-project';
const DERIVED_ID = 'derived-project';
const sourceProject = doc => doc.projects.find(project => project.id === SOURCE_ID);
const derivedProject = doc => doc.projects.find(project => project.id === DERIVED_ID);

function sourceDelivery() {
  let doc = createProject(upgradeTemplateLibrary(createInitialDoc(COMPONENT_CATALOG)), {
    id: SOURCE_ID, name: '来源设计项目', pages: [
      { id: 'source-list', name: '来源客户清单', templateId: 't-flex-list-table' },
      { id: 'source-form', name: '不复用的表单', templateId: 't-create-form' },
    ],
  });
  const project = sourceProject(doc);
  const blueprint = structuredClone(project.snapshot.templates.find(template => template.id === 't-flex-list-table').blueprint);
  blueprint.title = '归档时的客户清单';
  blueprint.fields[0].label = '客户名称';
  doc = upsertAsset(doc, 'projects', {
    id: SOURCE_ID, pages: project.pages.map(page => page.id === 'source-list' ? { ...page, overrides: { blueprint } } : page),
  });
  doc = setProjectTheme(doc, SOURCE_ID, { 'color.action': { value: '#176B54' } });
  doc = createProjectCheckPlan(doc, SOURCE_ID);
  for (const check of sourceProject(doc).checks) {
    doc = recordProjectCheck(doc, SOURCE_ID, { id: check.id, status: 'passed', evidence: `来源人工证据 ${check.pageId} / ${check.dimension}` });
  }
  doc = createProjectDeliveryRecord(doc, SOURCE_ID, { title: '可复用设计交付', mode: 'reviewed' });
  const record = structuredClone(sourceProject(doc).deliveries[0]);
  doc = upsertAsset(doc, 'projects', { id: SOURCE_ID, name: '原项目后续名称' });
  doc = setProjectTheme(doc, SOURCE_ID, { 'color.action': { value: '#7250BC' } });
  doc = upsertAsset(doc, 'tokens', { id: 'radius.md', value: 18 });
  return { doc, record };
}

function derivedDelivery(copyCheckStandards = true) {
  const fixture = sourceDelivery();
  const doc = createProjectFromDelivery(fixture.doc, SOURCE_ID, fixture.record.id, {
    id: DERIVED_ID, name: '新的客户设计项目', description: '独立编辑与重新验收。',
    pageIds: ['source-list'], copyCheckStandards,
  });
  return { doc, record: fixture.record };
}

test('reused context resolves selected frozen pages with a new identity and pending acceptance', () => {
  const { doc, record } = derivedDelivery();
  const context = createProjectContext(doc, DERIVED_ID);
  assert.equal(context.project.id, DERIVED_ID);
  assert.equal(context.project.name, '新的客户设计项目');
  assert.equal(context.project.baselineRevision, record.package.project.snapshot.revision);
  assert.notEqual(context.project.baselineRevision, doc.revision);
  assert.equal(context.project.designRevision, 1);
  assert.equal(context.pages.length, 1);
  assert.equal(context.pages[0].name, '来源客户清单');
  assert.equal(context.resolvedPages[0].template.blueprint.title, '归档时的客户清单');
  assert.equal(context.resolvedPages[0].template.blueprint.fields[0].label, '客户名称');
  assert.deepEqual(context.designSnapshot.effectiveAssets.templates.map(template => template.id), ['t-flex-list-table']);
  assert.ok(context.designSnapshot.effectiveAssets.components.length < COMPONENT_CATALOG.length);
  assert.equal(context.designSnapshot.effectiveAssets.tokens.find(token => token.id === 'color.action').value, '#176B54');
  assert.equal(context.verification.complete, false);
  assert.equal(context.verification.checks.length, 4);
  assert.equal(context.verification.coverage.totals.pending, 4);
  assert.ok(context.verification.checks.every(check => check.status === 'pending' && !check.evidence && check.pageId === context.pages[0].id));
  assert.ok(!JSON.stringify(context).includes('来源人工证据'));
  assert.ok(!JSON.stringify(context).includes('不复用的表单'));
  assert.equal(context.requirementSnapshot.status, 'not-linked');
  assert.equal(context.implementation.modelConnection, null);
  assert.equal(context.implementation.figmaBinding, null);
});

test('provenance is readable, scoped to selected pages and detached from model storage', () => {
  const { doc, record } = derivedDelivery();
  const context = createProjectContext(doc, DERIVED_ID);
  const frozen = JSON.stringify(doc);
  assert.deepEqual(context.origin, derivedProject(doc).derivedFrom);
  assert.equal(context.origin.projectName, '来源设计项目');
  assert.equal(context.origin.deliveryTitle, '可复用设计交付');
  assert.equal(context.origin.deliveryId, record.id);
  assert.equal(context.origin.baselineRevision, record.package.project.snapshot.revision);
  assert.equal(context.origin.designRevision, record.package.project.designRevision);
  assert.deepEqual(context.origin.pages, [{ sourcePageId: 'source-list', pageId: context.pages[0].id, sourceName: '来源客户清单' }]);
  const markdown = projectContextMarkdown(context);
  assert.match(markdown, /复用来源：来源设计项目 \/ 可复用设计交付/);
  assert.ok(markdown.includes(`来源基线 r${context.origin.baselineRevision}、设计修订 d${context.origin.designRevision}`));
  assert.match(markdown, /来源验收证据不作为本项目的验收结论/);
  context.origin.projectName = '只改导出副本';
  context.origin.pages[0].sourceName = '只改来源映射副本';
  assert.equal(JSON.stringify(doc), frozen);
});

test('new delivery archives retain provenance without borrowing old review results', () => {
  const fixture = derivedDelivery();
  let doc = createProjectDeliveryRecord(fixture.doc, DERIVED_ID, { title: '新项目首次草稿' });
  const record = structuredClone(derivedProject(doc).deliveries[0]);
  const archived = createArchivedProjectContext(record);
  assert.equal(archived.delivery.title, '新项目首次草稿');
  assert.equal(archived.delivery.mode, 'draft');
  assert.equal(archived.project.id, DERIVED_ID);
  assert.equal(archived.project.designRevision, 1);
  assert.equal(archived.origin.deliveryTitle, '可复用设计交付');
  assert.equal(archived.origin.projectId, SOURCE_ID);
  assert.equal(archived.verification.complete, false);
  assert.equal(archived.verification.coverage.totals.pending, 4);
  assert.match(projectContextMarkdown(archived), /交付记录：新项目首次草稿/);
  assert.match(projectContextMarkdown(archived), /复用来源：来源设计项目/);
  doc = setProjectTheme(doc, DERIVED_ID, { 'color.action': { value: '#B14A34' } });
  doc = upsertAsset(doc, 'projects', { id: DERIVED_ID, name: '新项目后续名称' });
  assert.equal(createProjectContext(doc, DERIVED_ID).project.designRevision, 2);
  assert.deepEqual(createArchivedProjectContext(record), archived);
  const cloned = createArchivedProjectContext(record);
  cloned.origin.pages[0].sourceName = '修改归档导出副本';
  assert.equal(record.package.project.derivedFrom.pages[0].sourceName, '来源客户清单');
});

test('omitting source standards leaves fresh default checks pending in derived context', () => {
  const { doc } = derivedDelivery(false);
  const context = createProjectContext(doc, DERIVED_ID);
  assert.equal(context.verification.checks.length, 4);
  assert.equal(context.verification.coverage.totals.pending, 4);
  assert.ok(context.verification.checks.every(check => !check.evidence && check.status === 'pending'));
  assert.equal(context.verification.complete, false);
  assert.equal(context.origin.kind, 'delivery');
});

test('ordinary projects and archives omit origin and retain their existing context contract', () => {
  let doc = createProject(createInitialDoc(COMPONENT_CATALOG), { id: 'plain-project', name: '直接创建的项目', templateId: 't-create-form' });
  const live = createProjectContext(doc, 'plain-project');
  assert.equal(Object.hasOwn(live, 'origin'), false);
  assert.doesNotMatch(projectContextMarkdown(live), /复用来源：/);
  doc = createProjectDeliveryRecord(doc, 'plain-project', { title: '普通项目草稿' });
  const context = createArchivedProjectContext(doc.projects[0].deliveries[0]);
  const { delivery, ...archived } = context;
  assert.equal(Object.hasOwn(context, 'origin'), false);
  assert.equal(delivery.title, '普通项目草稿');
  assert.deepEqual(archived, live);
});
