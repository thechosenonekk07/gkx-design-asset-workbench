import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDoc, createProject, upgradeTemplateLibrary, upsertAsset, validateDoc, importDoc, serializeDoc } from '../src/model.js';

const kinds = ['button', 'text-field', 'number-field', 'select', 'table', 'search-field', 'checkbox', 'alert-dialog', 'progress-bar', 'disclosure', 'switch', 'tabs', 'radio-group', 'breadcrumbs', 'menu', 'meter'];
const initial = (available = kinds) => createInitialDoc(available.map(kind => ({ kind, name: kind, config: {} })));
const ready = () => upgradeTemplateLibrary(initial());
const copy = value => JSON.parse(JSON.stringify(value));
const templateId = 't-flex-list-table';

test('saving and importing a blueprint with decorative-only dependencies fails atomically', () => {
  const doc = ready(), before = serializeDoc(doc);
  const template = doc.templates.find(item => item.id === templateId);
  const broken = { ...template, componentIds: ['c-button'], patternIds: [] };
  assert.throws(() => upsertAsset(doc, 'templates', broken), /必要的组件依赖.*text-field/);
  const imported = copy(doc);
  imported.templates[imported.templates.findIndex(item => item.id === templateId)] = broken;
  assert.throws(() => importDoc(JSON.stringify(imported)), /必要的组件依赖/);
  assert.equal(serializeDoc(doc), before);
});

test('component presence outside the declared closure cannot satisfy a page runtime role', () => {
  const doc = ready();
  const template = doc.templates.find(item => item.id === templateId);
  assert.ok(doc.components.some(component => component.kind === 'number-field'));
  assert.throws(() => upsertAsset(doc, 'templates', { ...template, componentIds: template.componentIds.filter(id => id !== 'c-number-field') }), /数字输入.*number-field/);
  // The same role may legitimately arrive through an explicitly adopted pattern.
  const withPattern = upsertAsset(doc, 'patterns', { id: 'p-typed-fields', name: '自定义字段输入', description: '', componentIds: ['c-number-field'], steps: ['填写数字字段'] });
  const saved = upsertAsset(withPattern, 'templates', { ...template, componentIds: template.componentIds.filter(id => id !== 'c-number-field'), patternIds: [...template.patternIds, 'p-typed-fields'] });
  assert.equal(validateDoc(saved), true);
});

test('project snapshots and page overrides cannot bypass dependency validation through import', () => {
  const doc = createProject(ready(), { name: '项目依赖核对', templateId });
  const brokenSnapshot = copy(doc);
  const template = brokenSnapshot.projects[0].snapshot.templates.find(item => item.id === templateId);
  template.componentIds = ['c-button'];
  template.patternIds = [];
  assert.throws(() => importDoc(JSON.stringify(brokenSnapshot)), /必要的组件依赖/);
  const invalidOverride = copy(doc);
  invalidOverride.projects[0].pages[0].overrides = { componentIds: ['c-button'] };
  assert.throws(() => importDoc(JSON.stringify(invalidOverride)), /配置无效.*不支持/);
  const local = copy(doc.projects[0].snapshot.templates.find(item => item.id === templateId).blueprint);
  local.fields = [{ id: 'budget', label: '预算', type: 'number', required: true }];
  local.records = [{ id: 'budget-1', values: { budget: 1200 } }];
  const saved = upsertAsset(doc, 'projects', { id: doc.projects[0].id, pages: [{ ...doc.projects[0].pages[0], overrides: { blueprint: local } }] });
  assert.equal(validateDoc(saved), true);
});

test('legacy templates stay valid and a sparse library is not migrated without all required field roles', () => {
  const partial = initial(kinds.filter(kind => kind !== 'number-field'));
  assert.ok(partial.templates.every(template => template.blueprint === undefined));
  const before = serializeDoc(partial);
  assert.equal(validateDoc(partial), true);
  assert.equal(upgradeTemplateLibrary(partial), partial);
  assert.equal(serializeDoc(partial), before);
  assert.equal(partial.templateCatalogRelease, undefined);
  assert.deepEqual(importDoc(before), partial);
});
