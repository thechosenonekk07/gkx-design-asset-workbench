import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialDoc, upgradeTemplateLibrary, createProject, adoptTemplateToProject,
  createProjectCheckPlan, recordProjectCheck, createProjectDeliveryRecord,
  createProjectFromDelivery, upsertAsset, setProjectTheme, duplicateAsset,
  removeAsset, removeProjectCheck, serializeDoc, importDoc, validateDoc,
} from '../src/model.js';
import { buildProjectCheckPlan, getProjectAcceptance } from '../src/projectAcceptance.js';

const clone = value => JSON.parse(JSON.stringify(value));
const kinds = ['button', 'text-field', 'number-field', 'select', 'table', 'search-field', 'checkbox', 'alert-dialog', 'progress-bar', 'disclosure', 'switch', 'tabs', 'radio-group', 'breadcrumbs', 'menu', 'meter'];
const source = doc => doc.projects.find(project => project.id === 'source-project');
const reused = doc => doc.projects.find(project => project.id === 'reused-project');
const options = extras => ({ id: 'reused-project', name: '独立复用项目', description: '从归档继续设计', ...extras });
const useDelivery = (doc, extras) => createProjectFromDelivery(doc, 'source-project', 'delivery-1', options(extras));
function fixture() {
  let doc = createProject(upgradeTemplateLibrary(createInitialDoc(kinds.map(kind => ({ kind, name: kind, config: {} })))), {
    id: 'source-project', name: '归档时项目名称', templateId: 't-flex-list-table',
  });
  doc = adoptTemplateToProject(doc, { projectId: 'source-project', templateId: 't-flex-list-table', pageName: '第二个资源页' });
  doc = setProjectTheme(doc, 'source-project', { 'radius.md': { value: 14 } });
  doc = createProjectCheckPlan(doc, 'source-project');
  const content = source(doc).checks.find(check => check.pageId === 'page-1' && check.dimension === 'content');
  doc = recordProjectCheck(doc, 'source-project', { id: content.id, name: '定制内容标准', description: '核对业务字段的语义、长文本和空值。', status: 'passed', evidence: '旧项目内容已检查，证据 old-content.png。' });
  doc = recordProjectCheck(doc, 'source-project', { name: '全局命名约定', description: '核对项目页面命名。', status: 'passed', evidence: '旧项目命名检查截图 old-naming.png。' });
  doc = recordProjectCheck(doc, 'source-project', { pageId: 'page-2', name: '第二页附加标准', description: '检查第二页的特殊状态。', status: 'failed', evidence: '旧项目第二页问题截图 old-failed.png。' });
  // The archive intentionally contains a changed page with outdated automatic check definitions.
  const blueprint = clone(source(doc).snapshot.templates.find(template => template.id === 't-flex-list-table').blueprint);
  blueprint.title = '归档中的客户资料';
  blueprint.fields[0].label = '归档中的客户名称';
  const pages = source(doc).pages.map(page => page.id === 'page-1' ? { ...page, name: '客户资料页', overrides: { blueprint } } : page);
  doc = upsertAsset(doc, 'projects', { id: 'source-project', pages });
  return createProjectDeliveryRecord(doc, 'source-project', { title: '已留档的设计草稿', note: '本次复用从这个版本开始。' });
}

test('all-page reuse copies the archived baseline and settings into independent identities without touching the source', () => {
  let doc = fixture();
  const archived = clone(source(doc).deliveries[0].package.project);
  doc = upsertAsset(doc, 'projects', { id: 'source-project', name: '当前已改名项目', description: '归档以后才写的说明' });
  doc = setProjectTheme(doc, 'source-project', { 'radius.md': { value: 24 } });
  doc = upsertAsset(doc, 'tokens', { id: 'radius.md', value: 18 });
  const before = serializeDoc(doc);
  const result = useDelivery(doc);
  const project = reused(result);
  assert.equal(serializeDoc(doc), before);
  assert.deepEqual(source(result), source(doc));
  assert.equal(result.revision, doc.revision);
  assert.equal(result.history.length, doc.history.length + 1);
  assert.equal(result.history.at(-1).action, 'reuse-delivery');
  assert.equal(project.designRevision, 1);
  assert.deepEqual(project.snapshot, archived.snapshot);
  assert.deepEqual(project.themeOverrides, archived.themeOverrides);
  assert.equal(project.pages.length, 2);
  project.pages.forEach((page, index) => {
    assert.ok(!archived.pages.some(original => original.id === page.id));
    assert.deepEqual({ ...page, id: archived.pages[index].id }, archived.pages[index]);
  });
  assert.equal(project.name, '独立复用项目');
  assert.equal(project.description, '从归档继续设计');
  assert.equal(project.deliveries, undefined);
  assert.equal(project.upgradeReviews, undefined);
  assert.equal(project.derivedFrom.projectName, '归档时项目名称');
  assert.equal(project.derivedFrom.deliveryTitle, '已留档的设计草稿');
  assert.equal(project.derivedFrom.baselineRevision, archived.snapshot.revision);
  assert.equal(project.derivedFrom.designRevision, archived.designRevision);
  assert.equal(project.derivedFrom.deliveryCreatedAt, source(doc).deliveries[0].createdAt);
  assert.ok(Number.isFinite(Date.parse(project.derivedFrom.createdAt)));
  project.snapshot.tokens[0].name = '仅修改副本';
  project.pages[0].overrides.blueprint.title = '仅修改副本标题';
  assert.deepEqual(source(result), source(doc));
});

test('selected-page reuse retains only selected and global custom standards and remaps all check scopes', () => {
  const result = useDelivery(fixture(), { pageIds: ['page-1'] });
  const project = reused(result), page = project.pages[0];
  assert.equal(project.pages.length, 1);
  assert.deepEqual(project.derivedFrom.pages, [{ sourcePageId: 'page-1', pageId: page.id, sourceName: '客户资料页' }]);
  assert.equal(project.checks.length, 5);
  assert.ok(project.checks.some(check => check.name === '全局命名约定' && !check.pageId));
  assert.ok(!project.checks.some(check => check.name === '第二页附加标准'));
  const custom = project.checks.find(check => check.dimension === 'content');
  assert.equal(custom.name, '定制内容标准');
  assert.equal(custom.description, '核对业务字段的语义、长文本和空值。');
  assert.equal(custom.customCriterion, true);
  assert.equal(custom.pageId, page.id);
  assert.ok(project.checks.every(check => !check.pageId || check.pageId === page.id));
  assert.deepEqual(project.checks.filter(check => check.dimension).map(check => check.dimension).sort(), ['accessibility', 'content', 'interaction', 'responsive']);
});

test('new pending checks never inherit conclusions, evidence, history, previous status or timestamps', () => {
  const doc = fixture(), result = useDelivery(doc), project = reused(result);
  const oldCheckIds = source(doc).checks.map(check => check.id);
  assert.ok(project.checks.every(check => check.status === 'pending' && check.baselineRevision === project.snapshot.revision && check.designRevision === 1));
  project.checks.forEach(check => {
    assert.equal(check.evidence, undefined);
    assert.equal(check.history, undefined);
    assert.equal(check.previousStatus, undefined);
    assert.ok(!oldCheckIds.includes(check.id));
    assert.ok(Number.isFinite(Date.parse(check.updatedAt)));
  });
  assert.equal(getProjectAcceptance(project).ready, false);
  assert.equal(getProjectAcceptance(project).totals.passed, 0);
  assert.equal(getProjectAcceptance(project).totals.missing, 0);
});

test('automatic standards refresh from the archived page configuration instead of its stale check text', () => {
  const doc = fixture();
  assert.ok(source(doc).checks.some(check => check.pageId === 'page-1' && check.dimension === 'interaction' && !check.description.includes('归档中的客户资料')));
  const project = reused(useDelivery(doc, { pageIds: ['page-1'] }));
  const plan = buildProjectCheckPlan(project);
  for (const dimension of ['interaction', 'accessibility', 'responsive']) {
    const check = project.checks.find(item => item.dimension === dimension);
    const expected = plan.find(item => item.dimension === dimension);
    assert.equal(check.description, expected.description);
    assert.equal(check.name, expected.name);
    assert.equal(check.criterionKey, expected.criterionKey);
  }
  assert.match(project.checks.find(check => check.dimension === 'interaction').description, /归档中的客户资料/);
});

test('opting out of custom standards creates exactly four fresh basic checks per selected page', () => {
  const project = reused(useDelivery(fixture(), { pageIds: ['page-1'], copyCheckStandards: false }));
  assert.equal(project.checks.length, 4);
  assert.ok(project.checks.every(check => check.dimension && !check.customCriterion && check.pageId === project.pages[0].id));
  const content = project.checks.find(check => check.dimension === 'content');
  assert.match(content.description, /归档中的客户资料.*归档中的客户名称/);
  assert.notEqual(content.name, '定制内容标准');
});

test('reuse validates selections, identities, names, options and empty archived projects atomically', () => {
  const doc = fixture(), before = serializeDoc(doc);
  for (const extras of [
    { pageIds: [] }, { pageIds: ['page-1', 'page-1'] }, { pageIds: ['missing'] },
    { pageIds: 'page-1' }, { name: ' ' }, { id: 'source-project' }, { id: 'invalid id' },
    { copyCheckStandards: 'yes' }, { description: 1 }, { name: '长'.repeat(121) }, { description: '长'.repeat(2001) },
  ]) assert.throws(() => useDelivery(doc, extras));
  assert.throws(() => createProjectFromDelivery(doc, 'missing', 'delivery-1', options()), /来源项目不存在/);
  assert.throws(() => createProjectFromDelivery(doc, 'source-project', 'missing', options()), /交付归档不存在/);
  assert.throws(() => createProjectFromDelivery(doc, 'source-project', 'delivery-1'), /提供新项目名称/);
  assert.throws(() => useDelivery(doc, { name: '归档时项目名称' }), /名称.*重复/);
  assert.equal(serializeDoc(doc), before);
  let empty = createProject(createInitialDoc(), { id: 'empty', name: '没有页面的草稿' });
  empty = createProjectDeliveryRecord(empty, 'empty', { title: '空项目归档' });
  assert.throws(() => createProjectFromDelivery(empty, 'empty', 'delivery-1', { name: '新项目' }), /至少选择一个/);
});

test('provenance survives round trips and later leaf archives but is protected from generic edits and injection', () => {
  const doc = useDelivery(fixture()), project = reused(doc), origin = clone(project.derivedFrom);
  assert.deepEqual(importDoc(serializeDoc(doc)), doc);
  for (const derivedFrom of [undefined, null, { ...origin, deliveryTitle: '伪造来源' }]) {
    assert.throws(() => upsertAsset(doc, 'projects', { id: project.id, derivedFrom }), /复用来源为只读/);
  }
  assert.throws(() => upsertAsset(doc, 'projects', { ...project, id: 'injected-project', name: '注入来源' }), /复用来源为只读/);
  assert.equal(upsertAsset(doc, 'projects', { id: project.id, derivedFrom: clone(origin), description: '允许维护项目说明' }).projects.at(-1).description, '允许维护项目说明');
  const archived = createProjectDeliveryRecord(doc, project.id, { title: '复用后的首次交付' });
  const payload = reused(archived).deliveries[0].package.project;
  assert.deepEqual(payload.derivedFrom, origin);
  assert.equal(payload.deliveries, undefined);
  assert.deepEqual(importDoc(serializeDoc(archived)), archived);
});

test('provenance remains readable after source removal and adopted page removal without requiring live references', () => {
  let doc = useDelivery(fixture());
  const origin = clone(reused(doc).derivedFrom);
  doc = removeAsset(doc, 'projects', 'source-project');
  const removedPage = reused(doc).pages[0].id;
  for (const check of reused(doc).checks.filter(check => check.pageId === removedPage)) doc = removeProjectCheck(doc, 'reused-project', check.id);
  doc = upsertAsset(doc, 'projects', { id: 'reused-project', pages: reused(doc).pages.filter(page => page.id !== removedPage) });
  assert.deepEqual(reused(doc).derivedFrom, origin);
  assert.deepEqual(importDoc(serializeDoc(doc)), doc);
});

test('invalid imported origin metadata is rejected while legacy projects without an origin still import', () => {
  const doc = useDelivery(fixture());
  const invalid = [
    origin => { origin.kind = 'project'; }, origin => { origin.projectId = 'reused-project'; },
    origin => { origin.deliveryId = 'bad id'; }, origin => { origin.projectName = ''; },
    origin => { origin.deliveryCreatedAt = 'yesterday'; }, origin => { origin.createdAt = '2026-01-01'; },
    origin => { origin.baselineRevision = 999; }, origin => { origin.designRevision = 0; },
    origin => { origin.pages = []; }, origin => { origin.pages.push(clone(origin.pages[0])); },
    origin => { origin.pages[0].sourcePageId = origin.pages[0].pageId; }, origin => { origin.extra = 'unsupported'; },
  ];
  invalid.forEach(change => {
    const input = clone(doc); change(reused(input).derivedFrom);
    assert.throws(() => importDoc(input), /复用来源|复用页面来源/);
  });
  const legacy = clone(doc); delete reused(legacy).derivedFrom;
  assert.equal(validateDoc(importDoc(legacy)), true);
});

test('ordinary duplicate creates a new project without inherited provenance or delivery history', () => {
  let doc = useDelivery(fixture());
  doc = createProjectDeliveryRecord(doc, 'reused-project', { title: '复用项目归档' });
  const duplicated = duplicateAsset(doc, 'projects', 'reused-project', { id: 'ordinary-copy', name: '普通副本' });
  const project = duplicated.projects.find(item => item.id === 'ordinary-copy');
  assert.equal(project.derivedFrom, undefined);
  assert.equal(project.deliveries, undefined);
  assert.deepEqual(reused(duplicated), reused(doc));
});

test('an archive from a derived project can seed another project without recursive archives or source provenance', () => {
  let doc = useDelivery(fixture());
  doc = createProjectDeliveryRecord(doc, 'reused-project', { title: '复用项目归档' });
  const result = createProjectFromDelivery(doc, 'reused-project', 'delivery-1', { id: 'third-project', name: '再次复用项目', pageIds: [reused(doc).pages[0].id] });
  const project = result.projects.at(-1);
  assert.equal(project.derivedFrom.projectId, 'reused-project');
  assert.equal(project.derivedFrom.deliveryTitle, '复用项目归档');
  assert.equal(project.derivedFrom.designRevision, 1);
  assert.equal(project.derivedFrom.derivedFrom, undefined);
  assert.equal(project.deliveries, undefined);
  assert.deepEqual(importDoc(serializeDoc(result)), result);
});

test('reuse size guard rejects unimportable results without modifying original archive or project', () => {
  const doc = fixture();
  // Unknown descriptive asset metadata is import-compatible, but would multiply through project snapshots.
  const large = '样'.repeat(4 * 1024 * 1024);
  source(doc).deliveries[0].package.project.snapshot.tokens[0].notes = large;
  const before = serializeDoc(doc);
  assert.ok(before.length <= 8 * 1024 * 1024);
  assert.throws(() => useDelivery(doc), /超过 8 MB/);
  assert.equal(serializeDoc(doc), before);
});
