import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredBlueprintKinds, validateBlueprintDependencies } from '../src/blueprintDependencies.js';
import { createTemplatePresets } from '../src/templatePresets.js';
import { COMPONENT_CATALOG } from '../src/componentRegistry.js';
import { createInitialDoc } from '../src/model.js';

const source = () => createInitialDoc(COMPONENT_CATALOG);
const template = (doc, id = 't-flex-list-table') => createTemplatePresets(doc).find(item => item.id === id);

test('all six real presets include every editable runtime role', () => {
  const doc = source();
  createTemplatePresets(doc).forEach(item => assert.deepEqual(validateBlueprintDependencies(item, doc), [], item.id));
  assert.deepEqual(requiredBlueprintKinds({ family: 'detail' }), ['button', 'text-field', 'number-field', 'select']);
  assert.ok(!requiredBlueprintKinds({ family: 'form' }).includes('progress-bar'));
  assert.ok(!requiredBlueprintKinds({ family: 'detail' }).includes('disclosure'));
  assert.ok(!requiredBlueprintKinds({ family: 'form' }).includes('text-area'));
});

test('unrelated available components cannot hide missing template declarations', () => {
  const doc = source();
  const asset = { ...template(doc), componentIds: ['c-button'], patternIds: [] };
  const errors = validateBlueprintDependencies(asset, doc);
  assert.equal(errors.length, 7);
  assert.ok(errors.some(error => error.includes('表格列表')));
  assert.ok(errors.some(error => error.includes('数字输入')));
  assert.ok(errors.some(error => error.includes('删除确认')));
});

test('pattern component closure and custom component identities satisfy roles', () => {
  const doc = source();
  const asset = template(doc);
  asset.componentIds = ['c-number-field'];
  asset.patternIds = ['p-search-filter', 'p-selection', 'p-confirm-action', 'p-form-submit'];
  assert.deepEqual(validateBlueprintDependencies(asset, doc), []);
  doc.components.push({ ...doc.components.find(component => component.id === 'c-number-field'), id: 'project-numeric' });
  asset.componentIds = ['project-numeric'];
  assert.deepEqual(validateBlueprintDependencies(asset, doc), []);
});

test('local variants and action switches keep roles needed for later page customization', () => {
  const doc = source();
  const asset = template(doc);
  asset.blueprint.variant = 'cards';
  asset.blueprint.actions.allowCreate = false;
  asset.blueprint.actions.allowDelete = false;
  asset.blueprint.sections = ['content'];
  asset.blueprint.fields = [{ id: 'name', label: '名称', type: 'text', required: true }];
  asset.blueprint.records = [];
  asset.patternIds = [];
  asset.componentIds = ['c-button', 'c-text-field', 'c-search-field', 'c-checkbox', 'c-alert-dialog'];
  const errors = validateBlueprintDependencies(asset, doc);
  assert.ok(errors.some(error => error.includes('table')));
  assert.ok(errors.some(error => error.includes('number-field')));
  assert.ok(errors.some(error => error.includes('select')));
});

test('invalid contracts and missing referenced assets return useful errors without mutating inputs', () => {
  const doc = source();
  const asset = template(doc);
  asset.patternIds.push('missing-pattern');
  asset.componentIds.push('missing-component');
  const before = JSON.stringify({ doc, asset });
  const errors = validateBlueprintDependencies(asset, doc);
  assert.ok(errors.some(error => error.includes('交互模式不存在')));
  assert.ok(errors.some(error => error.includes('组件不存在')));
  assert.equal(JSON.stringify({ doc, asset }), before);
  assert.ok(validateBlueprintDependencies({ ...asset, blueprint: { ...asset.blueprint, title: '' } }, doc).some(error => error.includes('页面标题')));
  assert.deepEqual(validateBlueprintDependencies({ id: 'legacy' }, doc), []);
  assert.deepEqual(requiredBlueprintKinds(null), []);
});
