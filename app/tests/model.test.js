import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDoc, resolveToken, tokenCSS, upsertAsset, removeAsset, getUsage, createProject, upgradeProject, getProjectUpgrade, recordProjectCheck, removeProjectCheck, duplicateAsset, validateDoc, serializeDoc, importDoc } from '../src/model.js';

const kinds = ['button', 'toggle-button', 'link', 'breadcrumbs', 'tabs', 'menu', 'toolbar', 'text-field', 'search-field', 'number-field', 'checkbox', 'checkbox-group', 'radio-group', 'switch', 'select', 'combo-box', 'list-box', 'grid-list', 'table', 'tree', 'tag-group', 'disclosure', 'disclosure-group', 'dialog', 'alert-dialog', 'tooltip', 'popover', 'slider', 'range-slider', 'progress-bar', 'meter', 'separator', 'calendar', 'range-calendar', 'date-field', 'date-picker', 'date-range-picker', 'time-field', 'color-area', 'color-slider', 'color-field', 'color-picker', 'color-swatch', 'color-swatch-picker', 'file-trigger', 'drop-zone'];
const initial = () => createInitialDoc(kinds.map((kind) => ({ kind, name: kind, category: '公共组件', description: `可自定义 ${kind}`, config: { label: kind }, docs: `https://example.com/${kind}` })));
const token = (doc, id) => doc.tokens.find((entry) => entry.id === id);

test('universal seed has real values, type coverage and component references', () => {
  const doc = initial();
  assert.ok(doc.tokens.length > 140);
  assert.equal(doc.components.length, 46);
  assert.equal(doc.patterns.length, 6);
  assert.equal(doc.templates.length, 6);
  assert.equal(validateDoc(doc), true);
  assert.deepEqual(new Set(doc.tokens.map((entry) => entry.type)), new Set(['color', 'number', 'string', 'boolean', 'duration', 'cubicBezier', 'shadow']));
  assert.equal(resolveToken(doc, 'color.action'), '#2563EB');
  assert.equal(resolveToken(doc, 'color.action', 'dark'), '#60A5FA');
  assert.equal(tokenCSS(doc)['--asset-font-size'], '14px');
  assert.equal(tokenCSS(doc)['--asset-duration'], '180ms');
  assert.equal(tokenCSS(doc)['--asset-primary-hover'], '#1D4ED8');
  assert.equal(tokenCSS(doc)['--asset-primary-pressed'], '#1E40AF');
  assert.equal(tokenCSS(doc)['--asset-font-weight'], '400');
  assert.equal(tokenCSS(doc)['--asset-line-height'], '1.5');
  assert.equal(tokenCSS(doc)['--asset-disabled-opacity'], '0.45');
  assert.equal(tokenCSS(doc)['--asset-focus-width'], '2px');
  assert.equal(tokenCSS(doc)['--asset-font-family'], token(doc, 'font.family').value);
});

test('alias cycles, incompatible types and units are rejected atomically', () => {
  const doc = initial();
  assert.throws(() => upsertAsset(doc, 'tokens', { ...token(doc, 'palette.blue.600'), alias: 'color.action' }), /循环/);
  assert.throws(() => upsertAsset(doc, 'tokens', { ...token(doc, 'color.action'), alias: 'space.md' }), /类型不一致/);
  assert.throws(() => upsertAsset(doc, 'tokens', { ...token(doc, 'size.control'), alias: 'opacity.disabled' }), /单位不一致/);
  assert.throws(() => upsertAsset(doc, 'tokens', { ...token(doc, 'motion.duration'), value: -1 }), /不能小于/);
  assert.throws(() => upsertAsset(doc, 'tokens', { ...token(doc, 'behavior.showRequired'), value: 'true' }), /布尔值/);
  assert.equal(doc.revision, 1);
  assert.equal(resolveToken(doc, 'color.action'), '#2563EB');
});

test('editor duration inputs normalize units and explicit undefined removes a theme override', () => {
  const doc = initial();
  const changed = upsertAsset(doc, 'tokens', { ...token(doc, 'motion.duration'), value: '0.24s' });
  assert.equal(resolveToken(changed, 'motion.duration'), 240);
  assert.equal(tokenCSS(changed)['--asset-duration'], '240ms');
  const cleared = upsertAsset(doc, 'tokens', { ...token(doc, 'color.action'), darkValue: undefined });
  assert.equal(resolveToken(cleared, 'color.action', 'dark'), '#2563EB');
});

test('reverse dependency traversal follows palette to semantic, component, pattern and template', () => {
  const doc = initial();
  const usages = getUsage(doc, 'tokens', 'palette.blue.600');
  assert.ok(usages.some((entry) => entry.id === 'color.action' && entry.direct));
  assert.ok(usages.some((entry) => entry.id === 'c-button' && !entry.direct));
  assert.ok(usages.some((entry) => entry.id === 'p-form-submit'));
  assert.ok(usages.some((entry) => entry.id === 't-create-form'));
  assert.equal(new Set(usages.map((entry) => `${entry.layer}:${entry.id}`)).size, usages.length);
  assert.throws(() => removeAsset(doc, 'tokens', 'palette.blue.600'), /仍被/);
  assert.throws(() => removeAsset(doc, 'components', 'c-button'), /表单提交/);
  assert.throws(() => removeAsset(doc, 'patterns', 'p-form-submit'), /页面模板/);
});

test('editing shared base propagates via bindings while locked projects retain their baseline', () => {
  const start = createProject(initial(), { name: '公共测试项目', templateId: 't-create-form' });
  const projectId = start.projects[0].id;
  const saved = recordProjectCheck(start, projectId, { name: '提交按钮检查', status: 'passed', evidence: '人工检查焦点与提交反馈，页面正常。', pageId: 'page-1' });
  const changed = upsertAsset(saved, 'tokens', { ...token(saved, 'palette.blue.600'), value: '#7C3AED' });
  assert.equal(resolveToken(changed, 'color.action'), '#7C3AED');
  assert.equal(tokenCSS(changed, changed.components[0].bindings)['--asset-primary'], '#7C3AED');
  assert.equal(resolveToken(changed.projects[0].snapshot, 'color.action'), '#2563EB');
  assert.equal(changed.projects[0].checks[0].status, 'passed');
  assert.equal(saved.revision, 1);
  assert.equal(changed.revision, 2);
  const impact = getProjectUpgrade(changed, projectId);
  assert.equal(impact.hasChanges, true);
  assert.ok(impact.changes.some((entry) => entry.id === 'palette.blue.600'));
  assert.deepEqual(impact.affectedPages, [{ id: 'page-1', name: '创建表单' }]);
  const upgraded = upgradeProject(changed, projectId);
  assert.equal(upgraded.revision, 2);
  assert.equal(resolveToken(upgraded.projects[0].snapshot, 'color.action'), '#7C3AED');
  assert.equal(upgraded.projects[0].checks[0].status, 'stale');
  assert.equal(upgraded.projects[0].checks[0].baselineRevision, 1);
  assert.equal(upgraded.projects[0].checks[0].previousStatus, 'passed');
  const verified = recordProjectCheck(upgraded, projectId, { id: upgraded.projects[0].checks[0].id, name: '提交按钮检查', status: 'passed', evidence: '按新基线复验按钮颜色和键盘操作。' });
  assert.equal(verified.projects[0].checks[0].baselineRevision, 2);
  assert.equal(verified.projects[0].checks[0].status, 'passed');
});

test('unrelated library changes are excluded from project impact', () => {
  const doc = createProject(initial(), { name: '项目', templateId: 't-create-form' });
  const changed = upsertAsset(doc, 'tokens', { id: 'custom.unused', name: '尚未使用', type: 'number', group: '间距', value: 19, unit: 'px' });
  assert.equal(getProjectUpgrade(changed, changed.projects[0].id).hasChanges, false);
  assert.deepEqual(getProjectUpgrade(changed, changed.projects[0].id).affectedPages, []);
});

test('validation protects references, uniqueness and evidence instead of accepting empty claims', () => {
  const doc = initial();
  assert.throws(() => upsertAsset(doc, 'patterns', { id: 'p-invalid', name: '无效引用', description: '', componentIds: ['c-unknown'], steps: [] }), /不存在/);
  assert.throws(() => upsertAsset(doc, 'components', { ...doc.components[0], bindings: { primary: 'space.md' } }), /需要 color/);
  assert.throws(() => upsertAsset(doc, 'components', { ...doc.components[0], bindings: { height: 'font.weight.bold' } }), /长度单位/);
  assert.throws(() => upsertAsset(doc, 'tokens', { ...token(doc, 'space.md'), id: 'duplicate' }), /名称.*重复/);
  const withProject = createProject(doc, { name: '项目', templateId: 't-create-form' });
  assert.throws(() => recordProjectCheck(withProject, withProject.projects[0].id, { name: '未经核验', status: 'passed' }), /验收依据/);
  const forged = { ...withProject.projects[0], snapshot: { ...withProject.projects[0].snapshot, revision: 99 } };
  assert.throws(() => upsertAsset(withProject, 'projects', forged), /基线只可/);
});

test('deleting shared template leaves historical project intact and blocks impossible upgrade', () => {
  const doc = createProject(initial(), { name: '项目', templateId: 't-create-form' });
  const changed = removeAsset(doc, 'templates', 't-create-form');
  assert.equal(validateDoc(changed), true);
  assert.equal(changed.projects[0].pages[0].templateId, 't-create-form');
  assert.ok(changed.projects[0].snapshot.templates.some((entry) => entry.id === 't-create-form'));
  assert.throws(() => upgradeProject(changed, changed.projects[0].id), /共享模板已删除/);
});

test('duplicates keep references with unique stable identity and complete backup roundtrips', () => {
  const doc = duplicateAsset(initial(), 'components', 'c-button');
  const copy = doc.components.at(-1);
  assert.equal(copy.name, 'button 副本');
  assert.notEqual(copy.id, 'c-button');
  assert.equal(copy.kind, 'button');
  assert.deepEqual(copy.bindings, doc.components[0].bindings);
  const imported = importDoc(serializeDoc(doc));
  assert.deepEqual(imported, doc);
  imported.tokens[0].value = '#FFFFFF';
  assert.notEqual(imported.tokens[0].value, doc.tokens[0].value);
  assert.throws(() => importDoc('{bad json'), /有效的 JSON/);
  const broken = JSON.parse(serializeDoc(doc));
  broken.templates[0].patternIds.push('p-missing');
  assert.throws(() => importDoc(broken), /不存在/);
  assert.throws(() => importDoc('{"__proto__":{}}'), /禁止的字段/);
});

test('all renderer fallback bindings are materialized and protected as real references', () => {
  const doc = initial();
  const changed = upsertAsset(doc, 'components', { id: 'custom-minimal', name: '最小自定义', kind: 'button', config: {}, bindings: { primary: 'color.success' } });
  const component = changed.components.at(-1);
  assert.equal(component.bindings.primary, 'color.success');
  assert.equal(component.bindings.radius, 'radius.md');
  assert.ok(getUsage(changed, 'tokens', 'radius.md').some((entry) => entry.id === 'custom-minimal'));
  assert.throws(() => removeAsset(changed, 'tokens', 'radius.md'), /仍被/);
  const partial = JSON.parse(serializeDoc(doc));
  partial.components[0].bindings = {};
  assert.throws(() => validateDoc(partial), /缺少/);
  assert.equal(importDoc(partial).components[0].bindings.primary, 'color.action');
  // Even before import normalization, usage must reflect actual renderer fallback.
  assert.ok(getUsage(partial, 'tokens', 'color.action').some((entry) => entry.id === 'c-button'));
});

test('new appearance bindings preserve unitless numbers and track actual state tokens', () => {
  const doc = initial();
  const component = doc.components[0];
  const changed = upsertAsset(doc, 'components', { ...component, bindings: { ...component.bindings, fontWeight: 'font.weight.bold', lineHeight: 'font.lineHeight.relaxed', primaryHover: 'color.success' } });
  const css = tokenCSS(changed, changed.components[0].bindings);
  assert.equal(css['--asset-font-weight'], '700');
  assert.equal(css['--asset-line-height'], '1.75');
  assert.equal(css['--asset-primary-hover'], '#15803D');
  assert.ok(getUsage(changed, 'tokens', 'font.weight.bold').some((entry) => entry.id === 'c-button'));
  assert.ok(getUsage(changed, 'tokens', 'color.success').some((entry) => entry.id === 'c-button'));
  assert.throws(() => upsertAsset(doc, 'components', { ...component, bindings: { ...component.bindings, fontWeight: 'space.md' } }), /无单位/);
  assert.throws(() => upsertAsset(doc, 'components', { ...component, bindings: { ...component.bindings, borderWidth: 'font.weight.bold' } }), /长度单位/);
  assert.throws(() => upsertAsset(doc, 'components', { ...component, bindings: { ...component.bindings, disabledOpacity: 'font.weight.bold' } }), /透明度必须/);
  assert.throws(() => removeAsset(doc, 'tokens', 'color.actionHover'), /仍被/);
});

test('removing an evidence check permits removal of its page without mutating the snapshot', () => {
  const doc = createProject(initial(), { name: '有检查的项目', templateId: 't-create-form' });
  const projectId = doc.projects[0].id;
  const checked = recordProjectCheck(doc, projectId, { name: '字段检查', pageId: 'page-1', status: 'failed', evidence: '必填字段提示缺失，需要补充。' });
  assert.throws(() => upsertAsset(checked, 'projects', { ...checked.projects[0], pages: [] }), /不存在的项目页面/);
  const cleared = removeProjectCheck(checked, projectId, checked.projects[0].checks[0].id);
  const removed = upsertAsset(cleared, 'projects', { ...cleared.projects[0], pages: [] });
  assert.equal(removed.projects[0].pages.length, 0);
  assert.equal(removed.projects[0].checks.length, 0);
  assert.equal(removed.revision, doc.revision);
  assert.deepEqual(removed.projects[0].snapshot, doc.projects[0].snapshot);
  assert.throws(() => removeProjectCheck(removed, projectId, 'missing'), /不存在/);
});

test('nonfinite draft values are rejected before JSON cloning can turn them into null', () => {
  const doc = initial();
  const range = doc.components.find((component) => component.kind === 'range-slider');
  assert.throws(() => upsertAsset(doc, 'components', { ...range, config: { value: [NaN, 80], min: 0, max: 100, step: 1 } }), /非法数字/);
  assert.throws(() => upsertAsset(doc, 'components', { ...range, config: { value: [20, Infinity], min: 0, max: 100, step: 1 } }), /非法数字/);
  const malformed = { ...doc, components: [{ ...range, config: { value: [20, NaN] } }] };
  assert.throws(() => importDoc(malformed));
  assert.equal(doc.revision, 1);
});

test('numeric controls validate bounds, step and ordered ranges while allowing numeric edits', () => {
  const doc = initial();
  const range = doc.components.find((component) => component.kind === 'range-slider');
  const save = (config) => upsertAsset(doc, 'components', { ...range, config });
  assert.throws(() => save({ value: [20], min: 0, max: 100 }), /两个数字/);
  assert.throws(() => save({ value: [80, 20], min: 0, max: 100 }), /起始值/);
  assert.throws(() => save({ value: [-1, 80], min: 0, max: 100 }), /必须在/);
  assert.throws(() => save({ value: [20, 101], min: 0, max: 100 }), /必须在/);
  assert.throws(() => save({ value: [20, 80], min: 100, max: 0 }), /最小值/);
  assert.throws(() => save({ value: [20, 80], min: 0, max: 100, step: 0 }), /步长/);
  assert.throws(() => save({ value: [20, 80], min: 0, max: 100, step: -2 }), /步长/);
  const changed = save({ value: [-5.5, 2.5], min: -10, max: 10, step: 0.5 });
  assert.deepEqual(changed.components.find((component) => component.id === range.id).config.value, [-5.5, 2.5]);
  const slider = doc.components.find((component) => component.kind === 'slider');
  assert.throws(() => upsertAsset(doc, 'components', { ...slider, config: { value: [20, 80] } }), /有限数字/);
  const progress = doc.components.find((component) => component.kind === 'progress-bar');
  assert.throws(() => upsertAsset(doc, 'components', { ...progress, config: { value: 101 } }), /必须在/);
});

test('value validation leaves legitimate date, time and color strings editable', () => {
  const doc = initial();
  for (const [kind, value] of [['date-picker', '2026-12-31'], ['time-field', '14:30'], ['color-picker', '#7C3AED'], ['text-field', '可编辑内容']]) {
    const component = doc.components.find((entry) => entry.kind === kind);
    const next = upsertAsset(doc, 'components', { ...component, config: { ...component.config, value } });
    assert.equal(next.components.find((entry) => entry.id === component.id).config.value, value);
  }
});

test('historical projects without optional semantic colors roundtrip without a baseline migration', () => {
  const legacy = initial();
  legacy.tokens = legacy.tokens.filter((entry) => !['color.success', 'color.warning'].includes(entry.id));
  const button = legacy.components.find((entry) => entry.kind === 'button');
  button.config = { label: '旧版次按钮', variant: 'secondary' };
  button.capabilities = ['label', 'variant'];
  button.spec = { purpose: '项目已确认的操作说明' };
  const saved = createProject(legacy, { name: '历史交付项目', templateId: 't-create-form' });

  const imported = importDoc(serializeDoc(saved));
  assert.deepEqual(imported, saved);
  assert.deepEqual(imported.projects[0].snapshot, saved.projects[0].snapshot);
  assert.equal(imported.components[0].bindings.success, undefined);
  assert.equal(imported.components[0].bindings.warning, undefined);
  assert.doesNotThrow(() => tokenCSS(imported.projects[0].snapshot, imported.projects[0].snapshot.components[0].bindings));
  assert.equal(getProjectUpgrade(imported, imported.projects[0].id).hasChanges, false);
});

test('explicit semantic color bindings track usage and enter a project only through baseline upgrade', () => {
  const saved = createProject(initial(), { name: '颜色绑定项目', templateId: 't-create-form' });
  const projectId = saved.projects[0].id;
  const button = saved.components.find((entry) => entry.kind === 'button');
  const updated = upsertAsset(saved, 'components', {
    ...button,
    bindings: { ...button.bindings, success: 'color.success', warning: 'color.warning' },
  });
  const current = updated.components.find((entry) => entry.id === button.id);
  assert.equal(tokenCSS(updated, current.bindings)['--asset-success'], '#15803D');
  assert.equal(tokenCSS(updated, current.bindings)['--asset-warning'], '#B45309');
  for (const id of ['color.success', 'color.warning']) {
    const usage = getUsage(updated, 'tokens', id);
    assert.deepEqual(usage.filter((entry) => entry.layer === 'components').map((entry) => entry.id), ['c-button']);
    assert.ok(usage.some((entry) => entry.id === 'p-form-submit'));
    assert.ok(usage.some((entry) => entry.id === 't-create-form'));
    assert.ok(!usage.some((entry) => entry.id === projectId));
    assert.throws(() => removeAsset(updated, 'tokens', id), /仍被/);
  }
  assert.deepEqual(updated.projects[0].snapshot, saved.projects[0].snapshot);
  assert.ok(getProjectUpgrade(updated, projectId).changes.some((entry) => entry.id === 'c-button'));

  const upgraded = upgradeProject(updated, projectId);
  assert.equal(upgraded.projects[0].snapshot.components.find((entry) => entry.id === 'c-button').bindings.success, 'color.success');
  assert.ok(getUsage(upgraded, 'tokens', 'color.success').some((entry) => entry.id === projectId && entry.locked));
  assert.deepEqual(importDoc(serializeDoc(upgraded)), upgraded);
  assert.throws(() => upsertAsset(saved, 'components', { ...button, bindings: { ...button.bindings, success: 'space.md' } }), /需要 color/);
});
