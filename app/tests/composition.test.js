import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeComposition, validateComposition, assertComposition, deriveCompositionReferences,
  compositionFromReferences, moveCompositionItem, moveCompositionRegion, moveCompositionItemToRegion,
} from '../src/composition.js';

const source = { components: [{ id: 'button' }, { id: 'input' }], patterns: [{ id: 'form', componentIds: ['input', 'button'] }] };
const structure = () => ({ version: 1, regions: [
  { id: 'actions', title: '快捷操作', columns: 2, items: [
    { id: 'save', layer: 'components', assetId: 'button', label: '保存' },
    { id: 'cancel', layer: 'components', assetId: 'button', label: '取消' },
  ] },
  { id: 'main', title: '主要内容', columns: 1, items: [{ id: 'form-instance', layer: 'patterns', assetId: 'form' }] },
] });

test('repeated assets retain independent identities and wording through a JSON roundtrip', () => {
  const original = structure();
  const next = normalizeComposition(JSON.parse(JSON.stringify(original)), source);
  assert.deepEqual(next, original);
  assert.notEqual(next, original);
  next.regions[0].items[0].label = '仅本页保存';
  assert.equal(original.regions[0].items[0].label, '保存');
  assert.equal(next.regions[0].items[1].label, '取消');
  assert.deepEqual(deriveCompositionReferences(next), { componentIds: ['button'], patternIds: ['form'] });
});

test('derived references track actual instances after moves and removals, without implicit duplicates', () => {
  const value = structure();
  value.regions[1].items.push({ id: 'extra-field', layer: 'components', assetId: 'input' });
  const moved = moveCompositionItemToRegion(value, 'main', 'actions', 'extra-field');
  assert.deepEqual(deriveCompositionReferences(moved), { componentIds: ['button', 'input'], patternIds: ['form'] });
  moved.regions[0].items = moved.regions[0].items.filter(item => item.assetId !== 'button');
  assert.deepEqual(deriveCompositionReferences(moved), { componentIds: ['input'], patternIds: ['form'] });
  assert.equal(value.regions[1].items.length, 2);
  assert.equal(moved.regions[0].items[0].id, 'extra-field');
});

test('region and instance ordering are immutable and keep instance IDs stable', () => {
  const value = structure();
  const snapshot = JSON.stringify(value);
  const itemMoved = moveCompositionItem(value, 'actions', 'cancel', -1);
  assert.deepEqual(itemMoved.regions[0].items.map(item => item.id), ['cancel', 'save']);
  const regionMoved = moveCompositionRegion(itemMoved, 'main', -1);
  assert.deepEqual(regionMoved.regions.map(region => region.id), ['main', 'actions']);
  assert.equal(JSON.stringify(value), snapshot);
  assert.deepEqual(moveCompositionRegion(value, 'actions', -1), value);
  assert.throws(() => moveCompositionItem(value, 'actions', 'unknown', 1), /找不到/);
  assert.throws(() => moveCompositionRegion(value, 'main', 4), /方向/);
});

test('validation rejects missing assets, duplicate IDs, unsupported layers and bad column counts', () => {
  const value = structure();
  value.regions[0].columns = 4;
  value.regions[0].items[1].id = 'save';
  value.regions[1].items[0].assetId = 'missing';
  let errors = validateComposition(value, source);
  assert.ok(errors.some(error => error.includes('列数')));
  assert.ok(errors.some(error => error.includes('重复')));
  assert.ok(errors.some(error => error.includes('不存在')));
  value.regions[1].items[0].layer = 'projects';
  errors = validateComposition(value, source);
  assert.ok(errors.some(error => error.includes('只能引用组件或交互模式')));
  assert.throws(() => assertComposition(value, source));
});

test('unknown import fields and executable overrides are rejected rather than silently preserved', () => {
  const value = structure();
  value.regions[0].items[0].config = { onClick: 'arbitrary-code' };
  assert.throws(() => normalizeComposition(value), /不支持的字段/);
  const proto = JSON.parse('{"version":1,"regions":[],"__proto__":{"injected":true}}');
  assert.throws(() => normalizeComposition(proto), /不支持的字段/);
  const accessor = { version: 1, get regions() { throw new Error('Getter must not execute'); } };
  assert.throws(() => normalizeComposition(accessor), /不支持的字段/);
  assert.throws(() => normalizeComposition({ version: 1, regions: [{ id: 'a', title: '', columns: 1, items: null }] }), /实例列表/);
});

test('legacy references convert explicitly and do not mutate the original template or library', () => {
  const template = { componentIds: ['button', 'input'], patternIds: ['form'] };
  const before = JSON.stringify({ template, source });
  const value = compositionFromReferences(template, source);
  assert.equal(value.regions.length, 1);
  assert.equal(value.regions[0].items.length, 3);
  assert.equal(new Set(value.regions[0].items.map(item => item.id)).size, 3);
  assert.deepEqual(deriveCompositionReferences(value), template);
  assert.equal(JSON.stringify({ template, source }), before);
  assert.throws(() => compositionFromReferences({ componentIds: ['missing'] }, source), /不存在/);
});

test('empty draft regions are valid but unbounded structures are rejected', () => {
  assert.deepEqual(normalizeComposition(), { version: 1, regions: [] });
  assert.equal(validateComposition({ version: 1, regions: [{ id: 'empty', title: '', columns: 3, items: [] }] }).length, 0);
  const value = structure();
  value.regions[0].items = Array.from({ length: 51 }, (_, i) => ({ id: `item-${i}`, layer: 'components', assetId: 'button' }));
  assert.throws(() => normalizeComposition(value), /50/);
  assert.throws(() => normalizeComposition({ version: 2, regions: [] }), /版本/);
});
