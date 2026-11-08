import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialDoc, upgradeTemplateLibrary, createProject, createProjectCheckPlan,
  recordProjectCheck, removeProjectCheck, createProjectDeliveryRecord,
  prepareProjectDelivery, setProjectTheme, upsertAsset, duplicateAsset,
  validateDoc, serializeDoc, importDoc, MAX_PROJECT_DELIVERIES,
} from '../src/model.js';
import { getProjectAcceptance } from '../src/projectAcceptance.js';

const kinds = ['button', 'text-field', 'number-field', 'select', 'table', 'search-field', 'checkbox', 'alert-dialog', 'progress-bar', 'disclosure', 'switch', 'tabs', 'radio-group', 'breadcrumbs', 'menu', 'meter'];
const clone = value => JSON.parse(JSON.stringify(value));
const project = doc => doc.projects[0];
const start = () => createProject(upgradeTemplateLibrary(createInitialDoc(kinds.map(kind => ({ kind, name: kind, config: {} })))), { id: 'delivery-project', name: '设计交付项目', templateId: 't-flex-list-table' });
const ready = () => {
  const doc = createProjectCheckPlan(start(), 'delivery-project');
  return project(doc).checks.reduce((next, check) => recordProjectCheck(next, 'delivery-project', { id: check.id, status: 'passed', evidence: `实际人工检查 ${check.dimension}，见 ${check.id}.png。` }), doc);
};
const archive = (doc, extra = {}) => createProjectDeliveryRecord(doc, 'delivery-project', { title: ' 第一轮设计交付 ', note: ' 核对范围为本项目页面。 ', ...extra });
const last = doc => project(doc).deliveries.at(-1);

test('saving an archive appends an independent snapshot without changing design or shared versions', () => {
  const doc = start(), before = serializeDoc(doc);
  const saved = archive(doc);
  const record = last(saved);
  assert.equal(record.id, 'delivery-1');
  assert.equal(record.title, '第一轮设计交付');
  assert.equal(record.note, '核对范围为本项目页面。');
  assert.equal(record.createdAt, record.package.exportedAt);
  assert.equal(record.package.mode, 'draft');
  assert.equal(record.package.acceptance.ready, false);
  assert.equal(record.package.acceptance.totals.missing, 4);
  assert.equal(record.package.scope.method, 'manual-evidence');
  assert.equal(saved.revision, doc.revision);
  assert.equal(project(saved).designRevision, project(doc).designRevision);
  assert.equal(saved.history.at(-1).action, 'delivery');
  assert.equal(serializeDoc(doc), before);
  record.package.project.pages[0].name = '只改返回副本';
  record.package.project.snapshot.tokens[0].value = '#000000';
  assert.notEqual(project(saved).pages[0].name, '只改返回副本');
  assert.notEqual(project(doc).snapshot.tokens[0].value, '#000000');
});

test('reviewed archives preserve old approval and evidence when pages, theme, checks and shared tokens change', () => {
  let doc = archive(ready(), { mode: 'reviewed' });
  const frozen = clone(last(doc));
  const page = project(doc).pages[0];
  const blueprint = clone(project(doc).snapshot.templates.find(template => template.id === page.templateId).blueprint);
  blueprint.title = '后续项目标题';
  doc = upsertAsset(doc, 'projects', { id: 'delivery-project', name: '项目后续名称', pages: [{ ...page, name: '后续页面名称', overrides: { blueprint } }] });
  doc = setProjectTheme(doc, 'delivery-project', { 'radius.md': { value: 16 } });
  doc = recordProjectCheck(doc, 'delivery-project', { id: project(doc).checks[0].id, status: 'failed', evidence: '新修订有遮挡，需要处理。' });
  doc = removeProjectCheck(doc, 'delivery-project', project(doc).checks[1].id);
  doc = upsertAsset(doc, 'tokens', { id: 'radius.md', value: 20 });
  assert.equal(getProjectAcceptance(project(doc)).ready, false);
  assert.deepEqual(last(doc), frozen);
  assert.equal(last(doc).package.acceptance.ready, true);
  assert.ok(last(doc).package.project.checks.every(check => check.status === 'passed'));
  assert.equal(last(doc).package.project.name, '设计交付项目');
  assert.deepEqual(importDoc(serializeDoc(doc)), doc);
});

test('repeated archive and current-package exports never nest prior archives', () => {
  let doc = archive(start());
  const first = clone(last(doc));
  doc = archive(doc, { title: '第二次协作草稿' });
  assert.equal(project(doc).deliveries.length, 2);
  assert.equal(last(doc).id, 'delivery-2');
  assert.deepEqual(project(doc).deliveries[0], first);
  for (const record of project(doc).deliveries) assert.equal(Object.hasOwn(record.package.project, 'deliveries'), false);
  const current = prepareProjectDelivery(doc, 'delivery-project');
  assert.equal(Object.hasOwn(current.project, 'deliveries'), false);
  assert.equal(importDoc(serializeDoc(doc)).projects[0].deliveries.length, 2);
});

test('reviewed archive creation requires current complete evidence and never mutates on failure', () => {
  const draft = start(), before = serializeDoc(draft);
  assert.throws(() => archive(draft, { mode: 'reviewed' }), /尚未完成/);
  assert.equal(serializeDoc(draft), before);
  const approved = archive(ready(), { mode: 'reviewed' });
  const changed = setProjectTheme(approved, 'delivery-project', { 'radius.md': { value: 10 } });
  assert.throws(() => archive(changed, { mode: 'reviewed' }), /尚未完成/);
  assert.equal(last(changed).package.acceptance.ready, true);
  assert.equal(archive(changed).projects[0].deliveries.length, 2);
  assert.equal(last(archive(changed)).package.mode, 'draft');
});

test('ordinary project writes cannot inject, replace, erase or append archives', () => {
  const unsaved = start(), saved = archive(unsaved), before = serializeDoc(saved);
  const deliveries = clone(project(saved).deliveries);
  assert.throws(() => upsertAsset(unsaved, 'projects', { id: 'delivery-project', deliveries }), /交付归档为只读/);
  assert.throws(() => upsertAsset(saved, 'projects', { id: 'delivery-project', deliveries: [] }), /交付归档为只读/);
  assert.throws(() => upsertAsset(saved, 'projects', { id: 'delivery-project', deliveries: undefined }), /交付归档为只读/);
  deliveries[0].title = '篡改历史';
  assert.throws(() => upsertAsset(saved, 'projects', { id: 'delivery-project', deliveries }), /交付归档为只读/);
  assert.throws(() => upsertAsset(saved, 'projects', { ...project(saved), id: 'different-project', name: '假冒项目' }), /交付归档为只读/);
  assert.deepEqual(upsertAsset(saved, 'projects', clone(project(saved))), saved);
  assert.equal(serializeDoc(saved), before);
  const duplicate = duplicateAsset(saved, 'projects', 'delivery-project');
  assert.equal(duplicate.projects[1].deliveries, undefined);
  assert.deepEqual(duplicate.projects[0].deliveries, project(saved).deliveries);
});

test('archive import validates identity, snapshot, checks, summary, timestamps and nonnested records', () => {
  const original = archive(ready(), { mode: 'reviewed' });
  const invalid = mutate => {
    const doc = clone(original);
    mutate(last(doc), doc);
    assert.throws(() => importDoc(JSON.stringify(doc)));
  };
  invalid(record => { record.package.project.id = 'wrong-project'; });
  invalid(record => { record.package.schemaVersion = 99; });
  invalid(record => { record.package.mode = 'published'; });
  invalid(record => { record.package.project.snapshot.templates = []; });
  invalid(record => { record.package.project.snapshot.components[0].bindings = {}; });
  invalid(record => { record.package.project.checks[0].evidence = ''; });
  invalid(record => { record.package.project.checks[0].updatedAt = 'tomorrow'; });
  invalid(record => { record.package.acceptance.totals.passed = 100; });
  invalid(record => { record.package.project.deliveries = []; });
  invalid(record => { record.createdAt = 'invalid'; });
  invalid(record => { record.package.exportedAt = '2000-01-01T00:00:00.000Z'; });
  invalid(record => { record.title = ' '; });
  invalid(record => { record.title = '字'.repeat(121); });
  invalid(record => { record.note = '字'.repeat(2001); });
  invalid(record => { record.package.scope.method = 'automatic'; });
  invalid((record, doc) => { project(doc).deliveries.push(clone(record)); });
  assert.deepEqual(importDoc(serializeDoc(original)), original);
  assert.equal(validateDoc(original), true);
});

test('a fabricated reviewed mode is rejected even with an internally honest incomplete summary', () => {
  const doc = archive(start());
  last(doc).package.mode = 'reviewed';
  assert.throws(() => importDoc(JSON.stringify(doc)), /必须完成当时版本/);
  last(doc).package.acceptance.ready = true;
  assert.throws(() => importDoc(JSON.stringify(doc)), /摘要.*不一致/);
});

test('legacy projects remain field-compatible and archive input limits are explicit', () => {
  const doc = start();
  assert.equal(Object.hasOwn(project(doc), 'deliveries'), false);
  assert.deepEqual(importDoc(serializeDoc(doc)), doc);
  assert.throws(() => archive(doc, { title: '' }), /归档名称/);
  assert.throws(() => archive(doc, { title: 'x'.repeat(121) }), /120/);
  assert.throws(() => archive(doc, { note: {} }), /说明必须是文字/);
  assert.throws(() => archive(doc, { note: 'x'.repeat(2001) }), /2000/);
  assert.throws(() => createProjectDeliveryRecord(doc, 'missing', { title: '未找到项目' }), /项目不存在/);
});

test('archive count limit rejects additional saves without silently dropping history', () => {
  const empty = { ...createInitialDoc([]), tokens: [], patterns: [], templates: [] };
  let doc = createProject(empty, { id: 'delivery-project', name: '小范围草稿' });
  for (let index = 0; index < MAX_PROJECT_DELIVERIES; index += 1) doc = archive(doc, { title: `草稿 ${index + 1}` });
  const before = serializeDoc(doc);
  assert.throws(() => archive(doc), /最多保留 50 份.*备份/);
  assert.equal(serializeDoc(doc), before);
  assert.equal(project(doc).deliveries[0].title, '草稿 1');
  assert.equal(project(doc).deliveries.length, MAX_PROJECT_DELIVERIES);
});

test('saving beyond the full-library import limit leaves the source document unchanged', () => {
  const empty = { ...createInitialDoc([]), tokens: [], patterns: [], templates: [] };
  const doc = createProject(empty, { id: 'delivery-project', name: '大范围草稿', description: 'x'.repeat(4 * 1024 * 1024) });
  const before = JSON.stringify(doc);
  assert.throws(() => archive(doc), /超过 8 MB.*原有归档未作修改/);
  assert.equal(JSON.stringify(doc), before);
  assert.equal(project(doc).deliveries, undefined);
});
