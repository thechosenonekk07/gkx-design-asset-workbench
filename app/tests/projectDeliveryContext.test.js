import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDoc, createProject, upgradeTemplateLibrary, upsertAsset, setProjectTheme, createProjectCheckPlan, recordProjectCheck, prepareProjectDelivery } from '../src/model.js';
import { COMPONENT_CATALOG } from '../src/componentRegistry.js';
import { createProjectContext, createArchivedProjectContext, projectContextMarkdown } from '../src/projectContext.js';

function projectDoc() {
  let doc = upgradeTemplateLibrary(createInitialDoc(COMPONENT_CATALOG));
  doc = createProject(doc, { name: '交付上下文验证', templateId: 't-flex-list-table' });
  const project = doc.projects[0];
  const blueprint = structuredClone(project.snapshot.templates.find(template => template.id === 't-flex-list-table').blueprint);
  blueprint.title = '交付时的客户清单';
  return upsertAsset(doc, 'projects', { id: project.id, pages: project.pages.map(page => ({ ...page, overrides: { blueprint } })) });
}

function recordFor(doc, mode = 'draft') {
  return {
    id: 'delivery-context-1', title: '第一次设计交付', note: '供开发核对已采用页面。',
    createdAt: '2026-10-04T02:00:00.000Z',
    package: prepareProjectDelivery(doc, doc.projects[0].id, { mode }),
  };
}

test('archived context stays on delivered title, token values and acceptance after live edits', () => {
  let doc = projectDoc();
  const id = doc.projects[0].id;
  doc = setProjectTheme(doc, id, { 'color.action': { value: '#176B54' } });
  doc = createProjectCheckPlan(doc, id);
  for (const check of doc.projects[0].checks) {
    doc = recordProjectCheck(doc, id, { id: check.id, status: 'passed', evidence: `交付前人工记录：${check.dimension}` });
  }
  const record = recordFor(doc, 'reviewed');
  const originalContext = createArchivedProjectContext(record);
  assert.equal(originalContext.verification.complete, true);

  doc = setProjectTheme(doc, id, { 'color.action': { value: '#7250BC' } });
  const project = doc.projects[0];
  const blueprint = structuredClone(project.pages[0].overrides.blueprint);
  blueprint.title = '交付之后的客户清单';
  doc = upsertAsset(doc, 'projects', { id, pages: project.pages.map(page => ({ ...page, overrides: { blueprint } })) });
  doc = upsertAsset(doc, 'tokens', { ...doc.tokens.find(token => token.id === 'color.action'), value: '#DD4455', alias: undefined });

  const live = createProjectContext(doc, id);
  const archived = createArchivedProjectContext(record);
  assert.equal(live.resolvedPages[0].template.blueprint.title, '交付之后的客户清单');
  assert.equal(live.verification.complete, false);
  assert.equal(archived.resolvedPages[0].template.blueprint.title, '交付时的客户清单');
  assert.equal(archived.designSnapshot.effectiveAssets.tokens.find(token => token.id === 'color.action').value, '#176B54');
  assert.equal(archived.verification.complete, true);
  assert.deepEqual(archived, originalContext);
});

test('archived context is detached, scoped to its project and includes readable delivery metadata', () => {
  let doc = projectDoc();
  const firstId = doc.projects[0].id;
  doc = createProject(doc, { name: '不应进入交付的项目', templateId: 't-create-form' });
  const record = { ...recordFor(doc), note: '设计交付说明' };
  assert.equal(record.package.project.id, firstId);
  const frozen = JSON.stringify(record);
  const context = createArchivedProjectContext(record);
  assert.deepEqual(context.delivery, {
    id: record.id, title: record.title, note: record.note, createdAt: record.createdAt, mode: 'draft',
  });
  assert.equal(context.project.id, firstId);
  assert.equal(context.deliveries, undefined);
  assert.equal(context.project.deliveries, undefined);
  assert.equal(context.history, undefined);
  assert.ok(!JSON.stringify(context).includes('不应进入交付的项目'));
  assert.match(projectContextMarkdown(context), /第一次设计交付/);
  context.pages[0].name = '修改导出副本';
  context.designSnapshot.effectiveAssets.tokens[0].value = '仅改副本';
  assert.equal(JSON.stringify(record), frozen);
});

test('live context API remains compatible and legacy project defaults can be archived', () => {
  const doc = createProject(createInitialDoc(COMPONENT_CATALOG), { name: '早期项目', templateId: 't-create-form' });
  const record = recordFor(doc);
  delete record.package.project.designRevision;
  const live = createProjectContext(doc, doc.projects[0].id);
  const archived = createArchivedProjectContext(record);
  assert.equal(live.format, 'design-context/1');
  assert.equal(live.delivery, undefined);
  const { delivery, ...context } = archived;
  assert.equal(delivery.mode, 'draft');
  assert.deepEqual(context, live);
});

test('archived context refuses invalid packages, recursive delivery history and broken frozen dependencies', () => {
  assert.throws(() => createArchivedProjectContext(null), /有效的项目交付包/);
  const record = recordFor(projectDoc());
  const wrongFormat = structuredClone(record);
  wrongFormat.package.schemaVersion = 999;
  assert.throws(() => createArchivedProjectContext(wrongFormat), /有效的项目交付包/);
  const forgedReviewed = structuredClone(record);
  forgedReviewed.package.mode = 'reviewed';
  forgedReviewed.package.acceptance.ready = true;
  assert.throws(() => createArchivedProjectContext(forgedReviewed), /缺少完整的当前版本验收证据/);
  const nested = structuredClone(record);
  nested.package.project.deliveries = [];
  assert.throws(() => createArchivedProjectContext(nested), /不能嵌套交付历史/);
  const missing = structuredClone(record);
  missing.package.project.snapshot.templates = [];
  assert.throws(() => createArchivedProjectContext(missing), /模板不在其基线快照/);
});
