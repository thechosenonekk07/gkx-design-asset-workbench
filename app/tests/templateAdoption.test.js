import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialDoc, upgradeTemplateLibrary, TEMPLATE_CATALOG_RELEASE,
  createProject, adoptTemplateToProject, upsertAsset, removeAsset,
  recordProjectCheck, upgradeProject, getProjectUpgrade,
  validateDoc, serializeDoc, importDoc,
} from '../src/model.js';
import { createTemplatePresets } from '../src/templatePresets.js';
import { resolvePageTemplate } from '../src/templateBlueprint.js';

const kinds = ['button', 'text-field', 'text-area', 'select', 'table', 'search-field', 'checkbox', 'alert-dialog', 'progress-bar', 'number-field', 'disclosure', 'switch', 'tabs', 'radio-group', 'breadcrumbs', 'menu', 'meter'];
const initial = () => createInitialDoc(kinds.map(kind => ({ kind, name: kind, config: {} })));
const ready = () => upgradeTemplateLibrary(initial());
const clone = value => JSON.parse(JSON.stringify(value));
const listId = 't-flex-list-table';
const template = doc => doc.templates.find(entry => entry.id === listId);
const composition = (assetId = 'c-button') => ({ version: 1, regions: [{ id: 'notes', title: '相关操作', columns: 2, items: [{ id: 'save', layer: 'components', assetId, label: '保存草稿' }, { id: 'publish', layer: 'components', assetId, label: '发布方案' }] }] });

test('catalogue migration appends six assets once and preserves locked projects and authored assets', () => {
  let doc = initial();
  doc = upsertAsset(doc, 'templates', { ...doc.templates[0], name: '我整理的资源列表', description: '用户维护的说明' });
  doc = createProject(doc, { name: '迁移前项目', templateId: 't-resource-list' });
  doc = recordProjectCheck(doc, doc.projects[0].id, { name: '原页面检查', status: 'passed', evidence: '原版本人工验证完成。' });
  const before = serializeDoc(doc);
  const migrated = upgradeTemplateLibrary(doc);
  assert.equal(migrated.templates.length, 12);
  assert.equal(migrated.revision, doc.revision + 1);
  assert.equal(migrated.templateCatalogRelease, TEMPLATE_CATALOG_RELEASE);
  assert.deepEqual(migrated.templates.slice(0, 6), doc.templates);
  assert.equal(JSON.stringify(migrated.projects), JSON.stringify(doc.projects));
  assert.equal(serializeDoc(doc), before);
  assert.deepEqual(upgradeTemplateLibrary(migrated), migrated);
  const deleted = removeAsset(migrated, 'templates', listId);
  assert.deepEqual(upgradeTemplateLibrary(deleted), deleted);
  assert.ok(!upgradeTemplateLibrary(deleted).templates.some(entry => entry.id === listId));
});

test('migration never replaces ID or name conflicts and leaves incomplete libraries untouched', () => {
  let doc = initial();
  const preset = createTemplatePresets(doc)[0];
  doc = upsertAsset(doc, 'templates', { ...preset, name: '自建列表', custom: true, blueprint: { ...preset.blueprint, title: '我的自建内容' } });
  const existing = clone(doc.templates.find(entry => entry.id === listId));
  const migrated = upgradeTemplateLibrary(doc);
  assert.deepEqual(template(migrated), existing);
  assert.equal(migrated.templates.length, 12);
  const partial = createInitialDoc([{ kind: 'button', name: '按钮', config: {} }]);
  assert.deepEqual(upgradeTemplateLibrary(partial), partial);
  assert.ok(!upgradeTemplateLibrary(partial).templateCatalogRelease);
});

test('adoption uses a locked older template and does not upgrade the project implicitly', () => {
  let doc = createProject(ready(), { name: '旧基线项目' });
  const baseline = clone(doc.projects[0].snapshot);
  doc = upsertAsset(doc, 'templates', { ...template(doc), blueprint: { ...template(doc).blueprint, title: '共享的新标题' } });
  const adopted = adoptTemplateToProject(doc, { projectId: doc.projects[0].id, templateId: listId, pageName: '项目资源' });
  const project = adopted.projects[0];
  assert.deepEqual(project.snapshot, baseline);
  assert.equal(project.pages[0].name, '项目资源');
  assert.equal(resolvePageTemplate(project.snapshot.templates.find(entry => entry.id === listId), project.pages[0]).blueprint.title, '资源管理');
  assert.equal(project.designRevision, 2);
  assert.throws(() => adoptTemplateToProject(adopted, { projectId: project.id, templateId: listId, pageName: '重复标识', id: project.pages[0].id }), /ID 已存在/);
});

test('adoption rejects a template absent from the baseline and explains explicit catalogue upgrade', () => {
  const old = createProject(initial(), { name: '尚未升级项目', templateId: 't-resource-list' });
  const doc = upgradeTemplateLibrary(old);
  const before = serializeDoc(doc);
  assert.throws(() => adoptTemplateToProject(doc, { projectId: doc.projects[0].id, templateId: listId }), /版本与影响.*主动升级/);
  assert.equal(serializeDoc(doc), before);
  const impact = getProjectUpgrade(doc, doc.projects[0].id);
  assert.equal(impact.hasChanges, false);
  assert.equal(impact.hasCatalogChanges, true);
  assert.equal(impact.availableTemplateIds.length, 6);
  const upgraded = upgradeProject(doc, doc.projects[0].id);
  assert.equal(adoptTemplateToProject(upgraded, { projectId: upgraded.projects[0].id, templateId: listId }).projects[0].pages.length, 2);
});

test('three projects configure different schemas without mutating shared assets or other projects', () => {
  let doc = ready();
  const shared = clone(template(doc));
  const schemas = [
    { id: 'assetName', label: '资产名称', type: 'text', required: true },
    { id: 'budget', label: '预算', type: 'number', required: true },
    { id: 'team', label: '团队', type: 'select', options: ['设计', '研发'], required: false },
  ];
  const values = ['交付资产', 1200, '研发'];
  schemas.forEach((field, index) => {
    doc = createProject(doc, { id: `project-${index}`, name: `项目 ${index + 1}`, templateId: listId });
    doc = recordProjectCheck(doc, `project-${index}`, { name: '原配置验收', status: 'passed', evidence: `项目 ${index + 1} 的原配置检查`, pageId: 'page-1' });
    const project = doc.projects.find(entry => entry.id === `project-${index}`);
    const blueprint = { ...clone(shared.blueprint), fields: [field], records: [{ id: 'sample-1', values: { [field.id]: values[index] } }], title: `项目 ${index + 1} 的资源`, shell: index === 0 ? 'none' : index === 1 ? 'side' : 'top' };
    doc = upsertAsset(doc, 'projects', { id: project.id, pages: [{ ...project.pages[0], overrides: { blueprint } }] });
  });
  assert.deepEqual(template(doc), shared);
  doc.projects.forEach((project, index) => {
    const resolved = resolvePageTemplate(project.snapshot.templates.find(entry => entry.id === listId), project.pages[0]);
    assert.equal(resolved.blueprint.fields[0].id, schemas[index].id);
    assert.equal(resolved.blueprint.records[0].values[schemas[index].id], values[index]);
    assert.equal(project.designRevision, 2);
    assert.equal(project.checks[0].status, 'stale');
    assert.equal(project.checks[0].previousStatus, 'passed');
    assert.equal(project.checks[0].designRevision, 1);
    assert.deepEqual(project.snapshot.templates.find(entry => entry.id === listId), shared);
  });
  assert.equal(validateDoc(doc), true);
  assert.deepEqual(importDoc(serializeDoc(doc)), doc);
});

test('template behavior and supplementary composition keep their dependency union', () => {
  const doc = ready();
  const current = template(doc);
  const saved = upsertAsset(doc, 'templates', { ...current, composition: composition() });
  assert.deepEqual(template(saved).blueprint, current.blueprint);
  assert.deepEqual(template(saved).patternIds, current.patternIds);
  assert.ok(current.componentIds.every(id => template(saved).componentIds.includes(id)));
  assert.deepEqual(template(saved).composition, composition());
  const old = doc.templates.find(entry => entry.id === 't-resource-list');
  const legacyFlow = upsertAsset(doc, 'templates', { ...old, flowEnabled: true, composition: composition() }).templates.find(entry => entry.id === old.id);
  assert.deepEqual(legacyFlow.patternIds, old.patternIds);
  assert.ok(legacyFlow.componentIds.includes('c-table'));
  assert.ok(legacyFlow.componentIds.includes('c-button'));
  const hiddenFlow = upsertAsset(doc, 'templates', { ...legacyFlow, flowEnabled: false }).templates.find(entry => entry.id === old.id);
  assert.deepEqual(hiddenFlow.patternIds, legacyFlow.patternIds);
  assert.deepEqual(hiddenFlow.componentIds, legacyFlow.componentIds);
  assert.deepEqual(hiddenFlow.composition, legacyFlow.composition);
  const restoredFlow = upsertAsset(doc, 'templates', { ...hiddenFlow, flowEnabled: true }).templates.find(entry => entry.id === old.id);
  assert.deepEqual(restoredFlow, legacyFlow);
  assert.throws(() => upsertAsset(doc, 'templates', { ...old, flowEnabled: 'yes' }), /布尔值/);
});

test('page composition permits declared pattern components and rejects unrelated library assets atomically', () => {
  let doc = createProject(ready(), { name: '局部编排项目', templateId: listId });
  const project = doc.projects[0];
  const saved = upsertAsset(doc, 'projects', { id: project.id, pages: [{ ...project.pages[0], overrides: { composition: composition() } }] });
  assert.equal(saved.projects[0].pages[0].overrides.composition.regions[0].items.length, 2);
  const before = serializeDoc(doc);
  assert.throws(() => upsertAsset(doc, 'projects', { id: project.id, pages: [{ ...project.pages[0], overrides: { composition: composition('c-meter') } }] }), /依赖资产/);
  assert.equal(serializeDoc(doc), before);
});

test('project upgrade preserves compatible whole-page overrides, rejecting family or dependency conflicts atomically', () => {
  let doc = ready();
  // A valid shared upgrade may remove an optional asset even while all runtime roles remain.
  doc = upsertAsset(doc, 'templates', { ...template(doc), componentIds: [...template(doc).componentIds, 'c-meter'] });
  doc = createProject(doc, { name: '升级配置项目', templateId: listId });
  const projectId = doc.projects[0].id;
  const blueprint = { ...clone(template(doc).blueprint), title: '项目专属标题', variant: 'cards' };
  doc = upsertAsset(doc, 'projects', { id: projectId, pages: [{ ...doc.projects[0].pages[0], overrides: { blueprint, composition: composition('c-meter') } }] });
  const overrides = clone(doc.projects[0].pages[0].overrides);
  const changed = upsertAsset(doc, 'templates', { ...template(doc), blueprint: { ...template(doc).blueprint, title: '共享标题升级', shell: 'side' } });
  const upgraded = upgradeProject(changed, projectId);
  assert.deepEqual(upgraded.projects[0].pages[0].overrides, overrides);
  assert.equal(upgraded.projects[0].snapshot.revision, changed.revision);
  assert.equal(resolvePageTemplate(template(upgraded), upgraded.projects[0].pages[0]).blueprint.shell, 'none');
  const incompatible = upsertAsset(changed, 'templates', { ...template(changed), blueprint: { ...template(changed).blueprint, family: 'form', variant: 'standard' } });
  const before = serializeDoc(incompatible);
  assert.throws(() => upgradeProject(incompatible, projectId), /不兼容.*页面类型/);
  assert.equal(serializeDoc(incompatible), before);
  const missing = removeAsset(changed, 'templates', listId);
  assert.throws(() => upgradeProject(missing, projectId), /已删除/);
  const dependencyChanged = upsertAsset(changed, 'templates', { ...template(changed), componentIds: template(changed).componentIds.filter(id => id !== 'c-meter') });
  assert.throws(() => upgradeProject(dependencyChanged, projectId), /依赖资产/);
  assert.deepEqual(dependencyChanged.projects[0].pages[0].overrides, overrides);
});
