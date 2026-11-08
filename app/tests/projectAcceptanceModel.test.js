import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialDoc, upgradeTemplateLibrary, createProject, adoptTemplateToProject,
  createProjectCheckPlan, recordProjectCheck, prepareProjectDelivery, upsertAsset,
  setProjectTheme, validateDoc, serializeDoc, importDoc,
} from '../src/model.js';
import { buildProjectCheckPlan, getProjectAcceptance } from '../src/projectAcceptance.js';

const kinds = ['button', 'text-field', 'number-field', 'select', 'table', 'search-field', 'checkbox', 'alert-dialog', 'progress-bar', 'disclosure', 'switch', 'tabs', 'radio-group', 'breadcrumbs', 'menu', 'meter'];
const clone = value => JSON.parse(JSON.stringify(value));
const start = () => createProject(upgradeTemplateLibrary(createInitialDoc(kinds.map(kind => ({ kind, name: kind, config: {} })))), { id: 'review-project', name: '复验与交付项目', templateId: 't-flex-list-table' });
const project = doc => doc.projects[0];
const planned = () => createProjectCheckPlan(start(), 'review-project');
const passAll = doc => project(doc).checks.reduce((current, check) => recordProjectCheck(current, 'review-project', { id: check.id, status: 'passed', evidence: `实际逐项检查 ${check.dimension}，证据文件 ${check.id}.png。` }), doc);

test('check plan adds four pending dimensions per selected page without replacing older custom evidence', () => {
  let doc = adoptTemplateToProject(start(), { projectId: 'review-project', templateId: 't-flex-list-table', pageName: '第二个页面' });
  doc = recordProjectCheck(doc, 'review-project', { name: '旧项目人工检查', status: 'passed', evidence: '原检查截图 old.png' });
  const originalCheck = clone(project(doc).checks[0]), before = serializeDoc(doc);
  const scoped = createProjectCheckPlan(doc, 'review-project', { pageId: 'page-2' });
  assert.equal(project(scoped).checks.length, 5);
  assert.deepEqual(project(scoped).checks[0], originalCheck);
  assert.ok(project(scoped).checks.slice(1).every(check => check.pageId === 'page-2' && check.status === 'pending' && !check.evidence));
  assert.equal(scoped.history.length, doc.history.length + 1);
  assert.equal(project(scoped).designRevision, project(doc).designRevision);
  const all = createProjectCheckPlan(scoped, 'review-project');
  assert.equal(project(all).checks.length, 9);
  assert.deepEqual(createProjectCheckPlan(all, 'review-project'), all);
  assert.equal(serializeDoc(doc), before);
  assert.throws(() => createProjectCheckPlan(doc, 'review-project', { pageId: 'missing' }), /页面不存在/);
});

test('generated criteria update from the actual page contract, retaining evidence and historical conclusions', () => {
  let doc = passAll(planned());
  const old = clone(project(doc).checks.find(check => check.dimension === 'content'));
  const page = project(doc).pages[0];
  const blueprint = clone(project(doc).snapshot.templates.find(template => template.id === page.templateId).blueprint);
  blueprint.title = '更新后的页面标题';
  blueprint.fields[0].label = '重新命名的字段';
  doc = upsertAsset(doc, 'projects', { id: 'review-project', pages: [{ ...page, overrides: { blueprint } }] });
  const refreshed = createProjectCheckPlan(doc, 'review-project');
  const check = project(refreshed).checks.find(item => item.id === old.id);
  assert.equal(check.status, 'pending');
  assert.match(check.description, /更新后的页面标题.*重新命名的字段/);
  assert.equal(check.evidence, old.evidence);
  assert.equal(check.designRevision, project(refreshed).designRevision);
  assert.equal(check.history.at(-1).status, 'stale');
  assert.equal(check.history.at(-1).previousStatus, 'passed');
  assert.equal(check.history.at(-1).description, old.description);
  assert.equal(check.history.at(-1).evidence, old.evidence);
  assert.equal(check.history.at(-1).designRevision, old.designRevision);
  assert.equal(getProjectAcceptance(project(refreshed)).ready, false);
  assert.deepEqual(createProjectCheckPlan(refreshed, 'review-project'), refreshed);
});

test('customized dimension criteria remain flexible across standard-version refreshes', () => {
  let doc = planned();
  const original = project(doc).checks[0];
  doc = recordProjectCheck(doc, 'review-project', { id: original.id, name: '项目特定内容检查', description: '人工增加字段语义与长文本换行检查。', status: 'passed', evidence: '人工逐项复核通过 evidence-custom.png' });
  let check = project(doc).checks[0];
  assert.equal(check.customCriterion, true);
  const userDescription = check.description;
  const oldKey = 'list/content/v0';
  doc = clone(doc);
  doc.projects[0].checks[0].criterionKey = oldKey;
  validateDoc(doc);
  const refreshed = createProjectCheckPlan(doc, 'review-project');
  check = project(refreshed).checks[0];
  assert.equal(check.description, userDescription);
  assert.equal(check.name, '项目特定内容检查');
  assert.equal(check.customCriterion, true);
  assert.equal(check.status, 'pending');
  assert.equal(check.criterionKey, 'list/content/v1');
  assert.equal(check.history.at(-1).criterionKey, oldKey);
  assert.equal(check.history.at(-1).status, 'passed');
  assert.equal(check.evidence, '人工逐项复核通过 evidence-custom.png');
  assert.deepEqual(createProjectCheckPlan(refreshed, 'review-project'), refreshed);
});

test('record updates bind to current versions, preserve a bounded nonnested history, and skip identical saves', () => {
  let doc = planned();
  const id = project(doc).checks[0].id;
  doc = recordProjectCheck(doc, 'review-project', { id, status: 'failed', evidence: '第一次实际检查：长文本遮挡。', baselineRevision: 999, designRevision: 999, updatedAt: '2099-01-01T00:00:00.000Z' });
  let check = project(doc).checks[0];
  assert.equal(check.baselineRevision, project(doc).snapshot.revision);
  assert.equal(check.designRevision, project(doc).designRevision);
  assert.notEqual(check.updatedAt, '2099-01-01T00:00:00.000Z');
  const exact = clone(check);
  assert.deepEqual(recordProjectCheck(doc, 'review-project', exact), doc);
  doc = setProjectTheme(doc, 'review-project', { 'radius.md': { value: 12 } });
  doc = recordProjectCheck(doc, 'review-project', { id, status: 'passed', evidence: '修改后复验：长文本可完整阅读。' });
  check = project(doc).checks[0];
  assert.equal(check.history.at(-1).previousStatus, 'failed');
  assert.equal(check.history.at(-1).evidence, '第一次实际检查：长文本遮挡。');
  assert.equal(check.history.at(-1).designRevision, 1);
  assert.equal(check.designRevision, 2);
  for (let index = 0; index < 22; index += 1) doc = recordProjectCheck(doc, 'review-project', { id, status: 'passed', evidence: `第 ${index + 1} 次人工复核，有对应截图。` });
  check = project(doc).checks[0];
  assert.equal(check.history.length, 20);
  assert.ok(check.history.every(item => !Object.prototype.hasOwnProperty.call(item, 'history')));
  assert.deepEqual(importDoc(serializeDoc(doc)), doc);
});

test('important definition and scope changes reset implicit approval, while explicit evidence-backed review remains possible', () => {
  let doc = passAll(planned());
  const id = project(doc).checks[0].id;
  doc = recordProjectCheck(doc, 'review-project', { id, description: '新增人工标准，尚待复测。' });
  assert.equal(project(doc).checks[0].status, 'pending');
  assert.equal(project(doc).checks[0].history.at(-1).status, 'passed');
  doc = recordProjectCheck(doc, 'review-project', { id, description: '重新定义并完成实际复核。', status: 'passed', evidence: '已按新标准人工检查，见 updated-check.png' });
  assert.equal(project(doc).checks[0].status, 'passed');
  assert.equal(project(doc).checks[0].criterionKey, 'list/content/v1');
  doc = recordProjectCheck(doc, 'review-project', { id, dimension: 'custom', pageId: '' });
  assert.equal(project(doc).checks[0].status, 'pending');
  assert.equal(project(doc).checks[0].dimension, undefined);
  assert.equal(project(doc).checks[0].criterionKey, undefined);
  assert.equal(project(doc).checks[0].pageId, undefined);
  assert.throws(() => recordProjectCheck(doc, 'review-project', { id, status: 'passed', evidence: '' }), /验收依据/);
});

test('history cannot be injected or erased and ordinary project writes cannot bypass check protections', () => {
  let doc = planned(), id = project(doc).checks[0].id;
  doc = recordProjectCheck(doc, 'review-project', { id, status: 'passed', evidence: '当前真实检查证据。' });
  const before = serializeDoc(doc);
  assert.throws(() => recordProjectCheck(doc, 'review-project', { id, history: [] }), /历史.*不能直接修改/);
  assert.throws(() => recordProjectCheck(doc, 'review-project', { name: '伪造历史检查', history: [project(doc).checks[0].history[0]] }), /历史.*不能直接修改/);
  assert.throws(() => upsertAsset(doc, 'projects', { id: 'review-project', checks: [] }), /验收结果/);
  assert.equal(serializeDoc(doc), before);
});

test('reviewed delivery requires complete current manual coverage and draft exports explicitly retain blockers', () => {
  let doc = start();
  const before = serializeDoc(doc), draft = prepareProjectDelivery(doc, 'review-project');
  assert.equal(draft.format, 'gkx-design-delivery');
  assert.equal(draft.schemaVersion, 2);
  assert.equal(draft.mode, 'draft');
  assert.equal(draft.acceptance.ready, false);
  assert.equal(draft.acceptance.totals.missing, 4);
  assert.match(draft.scope.note, /不代表线上生产环境认证/);
  assert.throws(() => prepareProjectDelivery(doc, 'review-project', { mode: 'reviewed' }), /尚未完成/);
  assert.equal(serializeDoc(doc), before);
  doc = passAll(createProjectCheckPlan(doc, 'review-project'));
  const reviewed = prepareProjectDelivery(doc, 'review-project', { mode: 'reviewed' });
  assert.equal(reviewed.mode, 'reviewed');
  assert.equal(reviewed.acceptance.ready, true);
  assert.deepEqual(reviewed.project, project(doc));
  reviewed.project.pages[0].name = '导出后的独立副本';
  reviewed.project.snapshot.tokens[0].value = '#000000';
  assert.notEqual(project(doc).pages[0].name, reviewed.project.pages[0].name);
  assert.notEqual(project(doc).snapshot.tokens[0].value, '#000000');
  const changed = setProjectTheme(doc, 'review-project', { 'radius.md': { value: 10 } });
  assert.throws(() => prepareProjectDelivery(changed, 'review-project', { mode: 'reviewed' }), /尚未完成/);
  assert.equal(prepareProjectDelivery(changed, 'review-project').acceptance.totals.stale, 4);
});

test('legacy unclassified checks are preserved but cannot substitute for page-dimension coverage', () => {
  let doc = createProject(createInitialDoc([]), { id: 'review-project', name: '旧模板项目', templateId: 't-resource-list' });
  doc = recordProjectCheck(doc, 'review-project', { name: '旧检查', status: 'passed', evidence: '旧人工检查依据。' });
  const legacy = clone(project(doc).checks[0]);
  assert.equal(getProjectAcceptance(project(doc)).ready, false);
  doc = createProjectCheckPlan(doc, 'review-project');
  assert.equal(project(doc).checks.length, 5);
  assert.deepEqual(project(doc).checks[0], legacy);
  assert.equal(buildProjectCheckPlan(project(doc)).length, 4);
  assert.deepEqual(importDoc(serializeDoc(doc)), doc);
  const empty = createProject(createInitialDoc([]), { name: '无页面项目' });
  assert.deepEqual(createProjectCheckPlan(empty, project(empty).id), empty);
  assert.throws(() => prepareProjectDelivery(empty, project(empty).id, { mode: 'reviewed' }), /尚未完成/);
});
