import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialDoc, upgradeTemplateLibrary, createProject, upsertAsset,
  recordProjectCheck, setProjectTheme, removeAsset, getProjectUpgradeReview,
  applyProjectUpgradeReview, serializeDoc, importDoc, validateDoc,
} from '../src/model.js';
import { createProjectContext } from '../src/projectContext.js';
import { resolvePageTemplate } from '../src/templateBlueprint.js';

const kinds = ['button', 'text-field', 'text-area', 'select', 'table', 'search-field', 'checkbox', 'alert-dialog', 'progress-bar', 'number-field', 'disclosure', 'switch', 'tabs', 'radio-group', 'breadcrumbs', 'menu', 'meter'];
const clone = value => JSON.parse(JSON.stringify(value));
const listId = 't-flex-list-table';
const ready = () => upgradeTemplateLibrary(createInitialDoc(kinds.map(kind => ({ kind, name: kind, config: {} }))));
const sharedTemplate = doc => doc.templates.find(template => template.id === listId);
const project = doc => doc.projects.find(item => item.id === 'review-project');
const start = () => createProject(ready(), { id: 'review-project', name: '升级审阅项目', templateId: listId });
const changeShared = (doc, patch) => upsertAsset(doc, 'templates', { ...sharedTemplate(doc), blueprint: { ...clone(sharedTemplate(doc).blueprint), ...patch } });
const changePage = (doc, patch) => upsertAsset(doc, 'projects', { id: project(doc).id, pages: [{ ...project(doc).pages[0], overrides: { blueprint: { ...clone(sharedTemplate(doc).blueprint), ...patch } } }] });
const resolved = doc => resolvePageTemplate(project(doc).snapshot.templates.find(item => item.id === listId), project(doc).pages[0]);

test('review merges incoming-only fields into a customized page, preserving project isolation and evidence', () => {
  let doc = start();
  doc = createProject(doc, { id: 'other-project', name: '另一项目', templateId: listId });
  doc = changePage(doc, { title: '项目自己的标题', variant: 'cards' });
  doc = recordProjectCheck(doc, project(doc).id, { pageId: 'page-1', name: '原页面通过验收', status: 'passed', evidence: '人工核对截图 evidence-before-upgrade.png' });
  doc = changeShared(doc, { shell: 'side', description: '共享版新的使用说明' });
  const before = serializeDoc(doc), beforeProject = clone(project(doc));
  const review = getProjectUpgradeReview(doc, project(doc).id);
  assert.equal(review.unresolvedCount, 0);
  assert.deepEqual(review.errors, []);
  assert.ok(review.candidateProject);
  assert.equal(review.designRevision, beforeProject.designRevision);
  assert.equal(serializeDoc(doc), before);
  const upgraded = applyProjectUpgradeReview(doc, project(doc).id, { reviewKey: review.reviewKey });
  assert.equal(resolved(upgraded).blueprint.title, '项目自己的标题');
  assert.equal(resolved(upgraded).blueprint.variant, 'cards');
  assert.equal(resolved(upgraded).blueprint.shell, 'side');
  assert.equal(resolved(upgraded).blueprint.description, '共享版新的使用说明');
  assert.deepEqual(upgraded.projects[1], doc.projects[1]);
  assert.deepEqual(upgraded.templates, doc.templates);
  assert.equal(upgraded.revision, doc.revision);
  assert.equal(project(upgraded).designRevision, beforeProject.designRevision + 1);
  assert.equal(project(upgraded).checks[0].status, 'stale');
  assert.equal(project(upgraded).checks[0].previousStatus, 'passed');
  assert.equal(project(upgraded).checks[0].evidence, beforeProject.checks[0].evidence);
  assert.equal(project(upgraded).checks[0].baselineRevision, beforeProject.snapshot.revision);
  assert.equal(project(upgraded).checks[0].designRevision, beforeProject.designRevision);
  assert.equal(upgraded.history.length, doc.history.length + 1);
  assert.equal(upgraded.history.at(-1).action, 'upgrade-reviewed');
  assert.deepEqual(importDoc(serializeDoc(upgraded)), upgraded);
});

test('conflicts block partial application and explicit decisions appear in resolved export and audit history', () => {
  let doc = changePage(start(), { title: '项目标题', description: '项目说明' });
  doc = changeShared(doc, { title: '共享新标题', description: '共享新说明', shell: 'top' });
  const before = serializeDoc(doc);
  const review = getProjectUpgradeReview(doc, project(doc).id);
  assert.equal(review.unresolvedCount, 2);
  assert.equal(review.candidateProject, null);
  assert.throws(() => applyProjectUpgradeReview(doc, project(doc).id, { reviewKey: review.reviewKey }), /冲突未处理/);
  const title = review.pages[0].entries.find(entry => entry.id === JSON.stringify(['blueprint', 'title']));
  const description = review.pages[0].entries.find(entry => entry.id === JSON.stringify(['blueprint', 'description']));
  assert.ok(title && description);
  const partial = { 'page-1': { [title.id]: 'local' } };
  assert.throws(() => applyProjectUpgradeReview(doc, project(doc).id, { reviewKey: review.reviewKey, choicesByPage: partial }), /冲突未处理/);
  assert.equal(serializeDoc(doc), before);
  const choicesByPage = { 'page-1': { [title.id]: 'local', [description.id]: 'incoming' } };
  const decided = getProjectUpgradeReview(doc, project(doc).id, { choicesByPage });
  assert.equal(decided.unresolvedCount, 0);
  assert.equal(decided.reviewKey, review.reviewKey);
  const upgraded = applyProjectUpgradeReview(doc, project(doc).id, { reviewKey: review.reviewKey, choicesByPage });
  const context = createProjectContext(upgraded, project(doc).id);
  assert.equal(context.resolvedPages[0].template.blueprint.title, '项目标题');
  assert.equal(context.resolvedPages[0].template.blueprint.description, '共享新说明');
  assert.equal(context.resolvedPages[0].template.blueprint.shell, 'top');
  const history = project(upgraded).upgradeReviews.at(-1);
  assert.equal(history.fromRevision, project(doc).snapshot.revision);
  assert.equal(history.toRevision, doc.revision);
  assert.equal(history.decisions.find(entry => entry.entryId === title.id).choice, 'local');
  assert.equal(history.decisions.find(entry => entry.entryId === title.id).label, title.label);
  assert.equal(history.decisions.find(entry => entry.entryId === title.id).group, title.group);
  assert.equal(history.decisions.find(entry => entry.entryId === description.id).choice, 'incoming');
  assert.equal(history.decisions.find(entry => entry.entryId === title.id).resolution, 'reviewed');
  assert.throws(() => upsertAsset(upgraded, 'projects', { id: project(doc).id, upgradeReviews: [] }), /升级审阅记录/);
});

test('review keys reject project or library edits even when their revision number is unchanged', () => {
  const doc = changeShared(start(), { shell: 'side' });
  const review = getProjectUpgradeReview(doc, project(doc).id);
  const renamed = upsertAsset(doc, 'projects', { id: project(doc).id, name: '审阅期间改过项目名' });
  assert.equal(project(renamed).designRevision, project(doc).designRevision);
  assert.throws(() => applyProjectUpgradeReview(renamed, project(doc).id, { reviewKey: review.reviewKey }), /审阅已过期/);
  const edited = clone(doc);
  edited.templates.find(item => item.id === listId).blueprint.title = '导入包相同版本但内容不同';
  validateDoc(edited);
  assert.throws(() => applyProjectUpgradeReview(edited, project(doc).id, { reviewKey: review.reviewKey }), /审阅已过期/);
  assert.throws(() => applyProjectUpgradeReview(doc, project(doc).id), /审阅已过期/);
  const checked = recordProjectCheck(doc, project(doc).id, { name: '审阅期间新增检查', status: 'pending' });
  assert.throws(() => applyProjectUpgradeReview(checked, project(doc).id, { reviewKey: review.reviewKey }), /审阅已过期/);
});

test('unknown or invalid decisions cannot be accepted and failures preserve input state', () => {
  const doc = changeShared(start(), { shell: 'side' });
  const before = serializeDoc(doc);
  const invalidPage = { 'not-a-page': {} };
  const review = getProjectUpgradeReview(doc, project(doc).id, { choicesByPage: invalidPage });
  assert.match(review.errors.join(' '), /不存在的项目页面/);
  assert.equal(review.candidateProject, null);
  assert.throws(() => applyProjectUpgradeReview(doc, project(doc).id, { choicesByPage: invalidPage, reviewKey: review.reviewKey }), /审阅未通过/);
  const invalidEntry = { 'page-1': { missing: 'incoming' } };
  const invalid = getProjectUpgradeReview(doc, project(doc).id, { choicesByPage: invalidEntry });
  assert.ok(invalid.errors.length);
  assert.throws(() => applyProjectUpgradeReview(doc, project(doc).id, { choicesByPage: invalidEntry, reviewKey: invalid.reviewKey }));
  const invalidGroup = getProjectUpgradeReview(doc, project(doc).id, { choicesByPage: { 'page-1': null } });
  assert.ok(invalidGroup.errors.length);
  assert.equal(invalidGroup.candidateProject, null);
  assert.equal(serializeDoc(doc), before);
});

test('one unresolved page blocks other conflict-free page upgrades without losing their candidate preview', () => {
  let doc = changePage(start(), { title: '本地页面标题' });
  doc = upsertAsset(doc, 'projects', { id: 'review-project', pages: [project(doc).pages[0], { id: 'page-2', name: '第二页', templateId: listId }] });
  doc = changeShared(doc, { title: '共享新标题', shell: 'side' });
  const before = serializeDoc(doc);
  const review = getProjectUpgradeReview(doc, 'review-project');
  assert.equal(review.pages.length, 2);
  assert.equal(review.unresolvedCount, 1);
  assert.equal(review.pages[1].unresolved.length, 0);
  assert.ok(review.pages[1].candidatePage);
  assert.equal(review.candidateProject, null);
  assert.throws(() => applyProjectUpgradeReview(doc, 'review-project', { reviewKey: review.reviewKey }), /冲突未处理/);
  assert.equal(serializeDoc(doc), before);
  const choice = review.pages[0].unresolved[0].id;
  const upgraded = applyProjectUpgradeReview(doc, 'review-project', { reviewKey: review.reviewKey, choicesByPage: { 'page-1': { [choice]: 'local' } } });
  const context = createProjectContext(upgraded, 'review-project');
  assert.equal(context.resolvedPages[0].template.blueprint.title, '本地页面标题');
  assert.equal(context.resolvedPages[1].template.blueprint.title, '共享新标题');
  assert.ok(context.resolvedPages.every(page => page.template.blueprint.shell === 'side'));
});

test('incompatible theme units and changed value bounds block the entire reviewed upgrade', () => {
  let doc = setProjectTheme(start(), 'review-project', { 'radius.md': { value: 12 } });
  const radius = doc.tokens.find(token => token.id === 'radius.md');
  const changedUnit = upsertAsset(doc, 'tokens', { ...radius, unit: 'rem' });
  const unitReview = getProjectUpgradeReview(changedUnit, 'review-project');
  assert.match(unitReview.errors.join(' '), /类型\/单位改变/);
  assert.equal(unitReview.candidateProject, null);
  assert.throws(() => applyProjectUpgradeReview(changedUnit, 'review-project', { reviewKey: unitReview.reviewKey }), /审阅未通过/);
  const changedBounds = upsertAsset(doc, 'tokens', { ...radius, max: 10 });
  const boundReview = getProjectUpgradeReview(changedBounds, 'review-project');
  assert.match(boundReview.errors.join(' '), /不能大于 10/);
  assert.equal(boundReview.candidateProject, null);
  assert.equal(project(changedBounds).themeOverrides['radius.md'].value, 12);
});

test('legacy pages and missing templates are handled without forcing schema migration', () => {
  let doc = createProject(ready(), { id: 'legacy-project', name: '旧模板项目', templateId: 't-resource-list' });
  const current = doc.templates.find(template => template.id === 't-resource-list');
  doc = upsertAsset(doc, 'templates', { ...current, description: '共享旧模板的新说明' });
  const review = getProjectUpgradeReview(doc, 'legacy-project');
  assert.equal(review.unresolvedCount, 0);
  assert.deepEqual(review.errors, []);
  const upgraded = applyProjectUpgradeReview(doc, 'legacy-project', { reviewKey: review.reviewKey });
  assert.deepEqual(upgraded.projects[0].pages, doc.projects[0].pages);
  assert.equal(upgraded.projects[0].snapshot.templates.find(template => template.id === current.id).description, '共享旧模板的新说明');
  const missing = removeAsset(doc, 'templates', current.id);
  const missingReview = getProjectUpgradeReview(missing, 'legacy-project');
  assert.ok(missingReview.errors.length);
  assert.equal(missingReview.candidateProject, null);
  const before = serializeDoc(missing);
  assert.throws(() => applyProjectUpgradeReview(missing, 'legacy-project', { reviewKey: missingReview.reviewKey }), /审阅未通过/);
  assert.equal(serializeDoc(missing), before);
});

test('reviewing the current baseline is a no-op and replayed successful reviews are stale', () => {
  const doc = start(), review = getProjectUpgradeReview(doc, project(doc).id);
  assert.deepEqual(applyProjectUpgradeReview(doc, project(doc).id, { reviewKey: review.reviewKey }), doc);
  const changed = changeShared(doc, { shell: 'side' });
  const nextReview = getProjectUpgradeReview(changed, project(doc).id);
  const upgraded = applyProjectUpgradeReview(changed, project(doc).id, { reviewKey: nextReview.reviewKey });
  assert.throws(() => applyProjectUpgradeReview(upgraded, project(doc).id, { reviewKey: nextReview.reviewKey }), /审阅已过期/);
  const currentReview = getProjectUpgradeReview(upgraded, project(doc).id);
  assert.deepEqual(applyProjectUpgradeReview(upgraded, project(doc).id, { reviewKey: currentReview.reviewKey }), upgraded);
});
