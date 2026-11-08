import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBlueprint, validateBlueprint, validatePageOverrides, resolvePageTemplate, templateFamily } from '../src/templateBlueprint.js';
import { createTemplatePresets } from '../src/templatePresets.js';

const source = {
  components: ['button', 'search-field', 'select', 'table', 'checkbox', 'text-field', 'text-area', 'number-field', 'alert-dialog', 'progress-bar', 'disclosure', 'menu'].map(kind => ({ id: `asset-${kind}`, kind })),
  patterns: [
    { id: 'p-search-filter', componentIds: ['asset-search-field', 'asset-select', 'asset-button', 'asset-table'] },
    { id: 'p-selection', componentIds: ['asset-table', 'asset-checkbox', 'asset-button', 'asset-menu'] },
    { id: 'p-confirm-action', componentIds: ['asset-button', 'asset-alert-dialog'] },
    { id: 'p-form-submit', componentIds: ['asset-text-field', 'asset-select', 'asset-button'] },
    { id: 'p-multistep', componentIds: ['asset-text-field', 'asset-progress-bar', 'asset-button'] },
  ],
};
const preset = id => createTemplatePresets(source).find(template => template.id === (id || 't-flex-list-table'));
const composition = (layer = 'components', assetId = 'asset-menu') => ({ version: 1, regions: [
  { id: 'toolbar', title: '页面工具', columns: 2, items: [{ id: 'toolbar-control', layer, assetId, label: '页面操作' }] },
] });

test('six separate opt-in presets expose valid real-data contracts and only source-backed dependencies', () => {
  const before = JSON.stringify(source);
  const templates = createTemplatePresets(source);
  assert.equal(templates.length, 6);
  assert.equal(new Set(templates.map(template => template.id)).size, 6);
  templates.forEach(template => {
    assert.deepEqual(validateBlueprint(template.blueprint), []);
    assert.ok(template.blueprint.records.length >= 3);
    assert.equal(template.blueprint.actions.allowDelete, template.blueprint.family === 'list');
    assert.ok(template.componentIds.every(id => source.components.some(component => component.id === id)));
    assert.ok(template.patternIds.every(id => source.patterns.some(pattern => pattern.id === id)));
  });
  assert.equal(JSON.stringify(source), before);
  templates[0].blueprint.fields[0].label = '本地标题';
  assert.equal(templates[1].blueprint.fields[0].label, '资源名称');
  assert.ok(createTemplatePresets({ components: [], patterns: [] }).every(template => !template.componentIds.length && !template.patternIds.length));
});

test('same adopted list template resolves three independent business contracts without mutating baseline or peers', () => {
  const template = preset();
  const original = JSON.stringify(template);
  const configurations = [
    { title: '研究文献', fields: [{ id: 'paper', label: '论文名称', type: 'text', required: true }, { id: 'year', label: '年份', type: 'number', required: true }], records: [{ id: 'p1', values: { paper: '知识检索研究', year: 2026 } }] },
    { title: '合作伙伴', fields: [{ id: 'organization', label: '机构', type: 'text', required: true }, { id: 'category', label: '合作类型', type: 'select', required: true, options: ['研究', '服务'] }], records: [{ id: 'o1', values: { organization: '研究团队', category: '研究' } }] },
    { title: '内容审核', fields: [{ id: 'subject', label: '标题', type: 'text', required: true }, { id: 'notes', label: '审核说明', type: 'textarea', required: false }], records: [{ id: 'c1', values: { subject: '本周公告', notes: '核对发布范围' } }] },
  ];
  const pages = configurations.map(configuration => ({ overrides: { blueprint: { ...structuredClone(template.blueprint), ...configuration } } }));
  pages.forEach(page => assert.deepEqual(validatePageOverrides(page, template, source), []));
  const resolved = pages.map(page => resolvePageTemplate(template, page));
  assert.deepEqual(resolved.map(value => value.blueprint.title), ['研究文献', '合作伙伴', '内容审核']);
  resolved[0].blueprint.fields[0].label = '已调整';
  assert.equal(pages[0].overrides.blueprint.fields[0].label, '论文名称');
  assert.equal(resolved[1].blueprint.fields[0].label, '机构');
  assert.equal(JSON.stringify(template), original);
});

test('shell, section ordering and structural variants preserve content, actions and regional composition', () => {
  const template = preset();
  const page = { overrides: { blueprint: structuredClone(template.blueprint), composition: composition() } };
  const before = structuredClone(page.overrides.blueprint);
  page.overrides.blueprint.shell = 'side';
  page.overrides.blueprint.variant = 'cards';
  page.overrides.blueprint.sections = ['content', 'intro', 'filters', 'actions'];
  const resolved = resolvePageTemplate(template, page);
  assert.deepEqual(resolved.blueprint.fields, before.fields);
  assert.deepEqual(resolved.blueprint.records, before.records);
  assert.deepEqual(resolved.blueprint.actions, before.actions);
  assert.deepEqual(resolved.composition, page.overrides.composition);
  assert.equal(resolved.blueprint.shell, 'side');
  assert.equal(resolved.blueprint.variant, 'cards');
});

test('project composition may only reference the adopted template dependency closure', () => {
  const template = preset();
  assert.ok(!template.componentIds.includes('asset-menu'));
  assert.deepEqual(validatePageOverrides({ overrides: { composition: composition() } }, template, source), []);
  assert.deepEqual(validatePageOverrides({ overrides: { composition: composition('patterns', 'p-selection') } }, template, source), []);
  assert.match(validatePageOverrides({ overrides: { composition: composition('components', 'asset-progress-bar') } }, template, source).join(' '), /只能编排/);
  assert.match(validatePageOverrides({ overrides: { composition: composition('patterns', 'p-multistep') } }, template, source).join(' '), /只能编排/);
  assert.match(validatePageOverrides({ overrides: { composition: composition('components', 'unknown') } }, template, source).join(' '), /不存在/);
});

test('project overrides reject unknown fields and incompatible template families', () => {
  const template = preset();
  assert.match(validatePageOverrides({ overrides: { templateId: 'different' } }, template, source).join(' '), /不支持/);
  const formBlueprint = preset('t-flex-form-standard').blueprint;
  assert.match(validatePageOverrides({ overrides: { blueprint: formBlueprint } }, template, source).join(' '), /页面类型/);
  assert.throws(() => resolvePageTemplate(template, { overrides: { blueprint: formBlueprint } }), /页面类型/);
  assert.match(validatePageOverrides({ overrides: { blueprint: template.blueprint } }, { id: 'legacy' }, source).join(' '), /没有可供继承/);
});

test('blueprint validation catches duplicate IDs, incompatible values, unsafe IDs and unsupported schema', () => {
  const invalid = mutate => { const value = preset().blueprint; mutate(value); return validateBlueprint(value); };
  assert.match(invalid(value => { value.version = 2; }).join(' '), /版本/);
  assert.match(invalid(value => { value.variant = 'wizard'; }).join(' '), /变体/);
  assert.match(invalid(value => { value.fields[1].id = value.fields[0].id; }).join(' '), /重复/);
  assert.match(invalid(value => { value.fields[0].id = '__proto__'; }).join(' '), /安全/);
  assert.match(invalid(value => { value.fields[0].id = 'toString'; }).join(' '), /安全/);
  assert.match(invalid(value => { value.records[0].values.status = '不存在'; }).join(' '), /不在可用选项/);
  assert.match(invalid(value => { value.records[0].values.name = 1; }).join(' '), /必须为/);
  assert.match(invalid(value => { value.fields[2].options = {}; }).join(' '), /选项/);
  assert.match(invalid(value => { value.records[0].values.unknown = '未知'; }).join(' '), /不支持/);
  assert.match(invalid(value => { value.sections = ['intro', 'filters']; }).join(' '), /content/);
  assert.match(invalid(value => { value.sections = ['content', 'content']; }).join(' '), /不重复/);
  assert.match(invalid(value => { value.actions.allowCreate = 'yes'; }).join(' '), /布尔/);
  assert.match(invalid(value => { value.records[1].id = value.records[0].id; }).join(' '), /重复/);
  assert.throws(() => assertBlueprint({ ...preset().blueprint, code: 'run()' }), /不支持/);
});

test('number values must be finite and select values bounded, but missing values are editable drafts', () => {
  const value = preset().blueprint;
  value.fields.push({ id: 'count', label: '数量', type: 'number', required: true });
  assert.deepEqual(validateBlueprint(value), []);
  value.records[0].values.count = Infinity;
  assert.match(validateBlueprint(value).join(' '), /有限数字/);
  value.records[0].values.count = 0;
  assert.deepEqual(validateBlueprint(value), []);
  value.fields[2].options = Array.from({ length: 51 }, (_, index) => `选项 ${index}`);
  assert.match(validateBlueprint(value).join(' '), /50/);
});

test('imported executable properties are rejected without invoking getters', () => {
  const value = preset().blueprint;
  Object.defineProperty(value, 'fields', { enumerable: true, get() { throw new Error('must never run'); } });
  assert.match(validateBlueprint(value).join(' '), /不支持/);
  const page = { get overrides() { throw new Error('must never run'); } };
  assert.match(validatePageOverrides(page, preset(), source).join(' '), /不支持/);
  const blueprint = { ...preset().blueprint, get family() { throw new Error('must never run'); } };
  assert.match(validatePageOverrides({ overrides: { blueprint } }, preset(), source).join(' '), /不支持/);
  const recordValues = JSON.parse('{"__proto__":"unexpected"}');
  const safe = preset().blueprint;
  safe.records[0].values = recordValues;
  assert.match(validateBlueprint(safe).join(' '), /不支持/);
});

test('legacy templates remain resolvable, independent and classified without being rewritten', () => {
  const template = { id: 't-legacy', layout: 'dashboard', componentIds: ['asset-table'], patternIds: ['p-search-filter'] };
  const resolved = resolvePageTemplate(template);
  assert.deepEqual(resolved, template);
  assert.notEqual(resolved, template);
  assert.equal(templateFamily(template), 'overview');
  assert.equal(templateFamily({ layout: 'wizard' }), 'form');
  assert.equal(templateFamily({ layout: 'settings' }), 'settings');
  assert.equal(templateFamily({ layout: 'regions' }), 'custom');
  assert.equal(templateFamily(preset()), 'list');
});
