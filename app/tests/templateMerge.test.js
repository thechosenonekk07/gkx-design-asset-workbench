import test from 'node:test';
import assert from 'node:assert/strict';
import { planTemplateMerge } from '../src/templateMerge.js';
import { resolvePageTemplate } from '../src/templateBlueprint.js';

const field = (id, label = id, type = 'text') => ({ id, label, type, required: false });
const base = () => ({ id: 't-list', name: '通用列表', layout: 'list', patternIds: [], componentIds: [], blueprint: {
  version: 1, family: 'list', shell: 'none', variant: 'table', title: '资源', description: '',
  fields: [field('name', '名称'), field('count', '数量', 'number'), field('note', '备注')],
  records: [{ id: 'r1', values: { name: '条目', count: 0, note: '' } }],
  actions: { primaryLabel: '创建', secondaryLabel: '清空', allowCreate: true, allowDelete: false },
  sections: ['intro', 'filters', 'content', 'actions'],
} });
const pageFor = template => ({ id: 'page-1', templateId: template.id, name: '我的页面', customProperty: '保留', overrides: { blueprint: structuredClone(template.blueprint) } });
const id = (...path) => JSON.stringify(path);
const resolved = (plan, nextTemplate) => resolvePageTemplate(nextTemplate, plan.candidatePage);
const planFor = (baseTemplate, page, nextTemplate, choices = {}) => planTemplateMerge({ baseTemplate, page, nextTemplate, choices });

test('unchanged inherited page is a no-op, and redundant full overrides are removed', () => {
  const template = base(), page = pageFor(template);
  const plan = planFor(template, page, structuredClone(template));
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.entries, []);
  assert.deepEqual(plan.unresolved, []);
  assert.equal(plan.hasChanges, false);
  assert.equal(plan.candidatePage.name, '我的页面');
  assert.equal(plan.candidatePage.customProperty, '保留');
  assert.equal('overrides' in plan.candidatePage, false);
});

test('old full-page overrides preserve only real local edits and inherit independent incoming changes', () => {
  const template = base(), page = pageFor(template), incoming = structuredClone(template);
  page.overrides.blueprint.title = '项目资源';
  incoming.blueprint.description = '新版说明';
  incoming.blueprint.actions.allowCreate = false;
  const plan = planFor(template, page, incoming);
  const output = resolved(plan, incoming).blueprint;
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.unresolved, []);
  assert.equal(output.title, '项目资源');
  assert.equal(output.description, '新版说明');
  assert.equal(output.actions.allowCreate, false);
  assert.equal(output.actions.allowDelete, false);
  assert.equal(output.records[0].values.count, 0);
  assert.equal(output.records[0].values.note, '');
  assert.equal(plan.entries.find(entry => entry.id === id('blueprint', 'title')).status, 'local');
  assert.equal(plan.entries.find(entry => entry.id === id('blueprint', 'description')).status, 'incoming');
});

test('competing updates require explicit choices and support false, zero and empty-string values', () => {
  const template = base(), page = pageFor(template), incoming = structuredClone(template);
  page.overrides.blueprint.title = '本地标题'; incoming.blueprint.title = '新版标题';
  page.overrides.blueprint.records[0].values.name = '';
  incoming.blueprint.records[0].values.name = '新版值';
  const plan = planFor(template, page, incoming);
  assert.equal(plan.unresolved.length, 2);
  assert.equal(resolved(plan, incoming).blueprint.title, '本地标题');
  const choices = Object.fromEntries(plan.unresolved.map(entry => [entry.id, 'incoming']));
  choices[id('blueprint', 'records', 'r1')] = 'local';
  const selected = planFor(template, page, incoming, choices);
  assert.deepEqual(selected.errors, []);
  assert.deepEqual(selected.unresolved, []);
  assert.equal(resolved(selected, incoming).blueprint.title, '新版标题');
  assert.equal(resolved(selected, incoming).blueprint.records[0].values.name, '');
});

test('identical concurrent changes merge without a conflict and remove redundant overrides', () => {
  const template = base(), page = pageFor(template), incoming = structuredClone(template);
  page.overrides.blueprint.title = incoming.blueprint.title = '相同标题';
  const plan = planFor(template, page, incoming);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.entries[0].status, 'same');
  assert.equal(plan.unresolved.length, 0);
  assert.equal('overrides' in plan.candidatePage, false);
});

test('independent additions on each side form a stable union, including nearby placement', () => {
  const template = base(), page = pageFor(template), incoming = structuredClone(template);
  page.overrides.blueprint.fields.splice(1, 0, field('local', '本地字段'));
  incoming.blueprint.fields.push(field('shared', '共享字段'));
  page.overrides.blueprint.records.push({ id: 'local-row', values: { local: '本地', name: '本地记录' } });
  incoming.blueprint.records.push({ id: 'shared-row', values: { shared: '共享', name: '共享记录' } });
  const plan = planFor(template, page, incoming);
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.unresolved, []);
  const output = resolved(plan, incoming).blueprint;
  assert.deepEqual(output.fields.map(value => value.id), ['name', 'local', 'count', 'note', 'shared']);
  assert.deepEqual(new Set(output.records.map(value => value.id)), new Set(['r1', 'local-row', 'shared-row']));
  const orderChoice = { [id('blueprint', 'fields', '$order')]: 'local' };
  const chosen = planFor(template, page, incoming, orderChoice);
  assert.equal(resolved(chosen, incoming).blueprint.fields.length, 5);
  assert.deepEqual(chosen.errors, []);
});

test('competing moves require a choice, and choosing an order never loses surviving new IDs', () => {
  const template = base(), page = pageFor(template), incoming = structuredClone(template);
  page.overrides.blueprint.fields.reverse();
  page.overrides.blueprint.fields.push(field('local'));
  incoming.blueprint.fields = [incoming.blueprint.fields[1], incoming.blueprint.fields[0], incoming.blueprint.fields[2], field('shared')];
  const plan = planFor(template, page, incoming);
  assert.equal(plan.unresolved.length, 1);
  assert.equal(plan.unresolved[0].id, id('blueprint', 'fields', '$order'));
  for (const choice of ['local', 'incoming']) {
    const chosen = planFor(template, page, incoming, { [plan.unresolved[0].id]: choice });
    assert.deepEqual(chosen.errors, []);
    assert.equal(resolved(chosen, incoming).blueprint.fields.length, 5);
  }
});

test('incoming deletion versus local entity edits is an explicit absent/present conflict', () => {
  const template = base(), page = pageFor(template), incoming = structuredClone(template);
  page.overrides.blueprint.fields[2].label = '我的备注';
  incoming.blueprint.fields.pop(); delete incoming.blueprint.records[0].values.note;
  const plan = planFor(template, page, incoming);
  const conflict = plan.entries.find(entry => entry.id === id('blueprint', 'fields', 'note'));
  assert.equal(conflict.status, 'conflict');
  assert.deepEqual(conflict.incoming, { present: false });
  assert.equal(conflict.local.present, true);
  assert.equal(plan.unresolved.length, 1);
  const chosen = planFor(template, page, incoming, { [conflict.id]: 'incoming' });
  assert.deepEqual(chosen.errors, []);
  assert.deepEqual(chosen.unresolved, []);
});

test('deleting a field with locally edited sample values requires a linked choice, never silent data loss', () => {
  const template = base(), page = pageFor(template), incoming = structuredClone(template);
  page.overrides.blueprint.records[0].values.note = '必须保留的本地值';
  incoming.blueprint.fields.pop(); delete incoming.blueprint.records[0].values.note;
  const plan = planFor(template, page, incoming);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.unresolved.length, 2);
  assert.equal(resolved(plan, incoming).blueprint.records[0].values.note, '必须保留的本地值');
  const fieldId = id('blueprint', 'fields', 'note'), rowId = id('blueprint', 'records', 'r1');
  const invalid = planFor(template, page, incoming, { [fieldId]: 'incoming', [rowId]: 'local' });
  assert.equal(invalid.unresolved.length, 0);
  assert.ok(invalid.errors.length > 0);
  const keepLocal = planFor(template, page, incoming, { [fieldId]: 'local', [rowId]: 'local' });
  assert.deepEqual(keepLocal.errors, []);
  const takeIncoming = planFor(template, page, incoming, { [fieldId]: 'incoming', [rowId]: 'incoming' });
  assert.deepEqual(takeIncoming.errors, []);
  assert.equal('note' in resolved(takeIncoming, incoming).blueprint.records[0].values, false);
});

test('new records depending on a shared deleted field block until dependencies are explicitly resolved', () => {
  const template = base(), page = pageFor(template), incoming = structuredClone(template);
  page.overrides.blueprint.records.push({ id: 'local-row', values: { note: '新增本地值' } });
  incoming.blueprint.fields.pop(); delete incoming.blueprint.records[0].values.note;
  const plan = planFor(template, page, incoming);
  assert.equal(plan.unresolved.length, 1);
  assert.equal(plan.unresolved[0].id, id('blueprint', 'fields', 'note'));
  assert.equal(resolved(plan, incoming).blueprint.records.length, 2);
  const adoptDeletion = planFor(template, page, incoming, { [id('blueprint', 'fields', 'note')]: 'incoming' });
  assert.ok(adoptDeletion.errors.length);
  const resolvedDeletion = planFor(template, page, incoming, {
    [id('blueprint', 'fields', 'note')]: 'incoming', [id('blueprint', 'records', 'local-row')]: 'incoming',
  });
  assert.deepEqual(resolvedDeletion.errors, []);
});

test('composition stays an atomic conflict, and invalid incoming dependencies cannot be applied', () => {
  const template = base();
  template.componentIds = ['button'];
  template.composition = { version: 1, regions: [{ id: 'main', title: '内容', columns: 1, items: [{ id: 'button-1', layer: 'components', assetId: 'button' }] }] };
  const page = pageFor(template), incoming = structuredClone(template);
  page.overrides.composition = structuredClone(template.composition);
  page.overrides.composition.regions[0].title = '我的内容';
  incoming.composition.regions[0].columns = 2;
  incoming.componentIds = [];
  const plan = planTemplateMerge({ baseTemplate: template, page, nextTemplate: incoming, source: { components: [{ id: 'button' }], patterns: [] } });
  assert.equal(plan.unresolved.length, 1);
  assert.equal(plan.unresolved[0].id, id('composition'));
  assert.match(plan.errors.join(' '), /只能编排/);
});

test('missing, switched or incompatible templates remain blocked and keep the old page intact', () => {
  const template = base(), page = pageFor(template);
  const variants = [undefined, { ...template, id: 'different' }, { ...template, blueprint: { ...template.blueprint, family: 'form', variant: 'standard' } }, { ...template, blueprint: { ...template.blueprint, version: 2 } }];
  for (const incoming of variants) {
    const plan = planFor(template, page, incoming);
    assert.ok(plan.errors.length);
    assert.deepEqual(plan.candidatePage, page);
  }
});

test('JSON round trips preserve review values and inputs stay immutable; key order is not a change', () => {
  const template = base(), page = pageFor(template), incoming = structuredClone(template);
  page.overrides.blueprint.fields[0] = { required: false, label: '名称', type: 'text', id: 'name' };
  incoming.blueprint.description = '更新';
  const before = JSON.stringify({ template, page, incoming });
  const plan = planFor(template, page, incoming);
  assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
  assert.equal(JSON.stringify({ template, page, incoming }), before);
  assert.equal(plan.entries.length, 1);
  plan.candidatePage.name = '修改输出不影响输入';
  assert.equal(page.name, '我的页面');
});

test('unknown choices, invalid choices, prototype keys and executable getters cannot be applied', () => {
  const template = base(), page = pageFor(template), incoming = structuredClone(template);
  incoming.blueprint.title = '更新';
  assert.match(planFor(template, page, incoming, { nope: 'local' }).errors.join(' '), /不存在/);
  assert.match(planFor(template, page, incoming, { [id('blueprint', 'title')]: 'execute' }).errors.join(' '), /只能/);
  assert.ok(planFor(template, page, incoming, JSON.parse('{"__proto__":"local"}')).errors.length);
  const getterChoices = { get invalid() { throw new Error('never execute'); } };
  assert.ok(planFor(template, page, incoming, getterChoices).errors.length);
  const unsafePage = { ...page, get overrides() { throw new Error('never execute'); } };
  assert.ok(planFor(template, unsafePage, incoming).errors.length);
  const unsafeIncoming = { ...incoming, get blueprint() { throw new Error('never execute'); } };
  assert.ok(planFor(template, page, unsafeIncoming).errors.length);
});

test('legacy templates without blueprint still preserve custom composition and inherited no-ops', () => {
  const template = { id: 'legacy', layout: 'detail', componentIds: [], patternIds: [] };
  const page = { id: 'legacy-page', templateId: 'legacy', name: '详情' };
  const plan = planFor(template, page, structuredClone(template));
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.candidatePage, page);
  assert.equal(plan.hasChanges, false);
});


test('matching reorders with independent additions merge, but competing placement of the same added ID conflicts', () => {
  const template = base(), page = pageFor(template), incoming = structuredClone(template);
  page.overrides.blueprint.fields.reverse(); incoming.blueprint.fields.reverse();
  page.overrides.blueprint.fields.push(field('local'));
  incoming.blueprint.fields.push(field('shared'));
  const matching = planFor(template, page, incoming);
  assert.deepEqual(matching.errors, []);
  assert.deepEqual(matching.unresolved, []);
  assert.equal(resolved(matching, incoming).blueprint.fields.length, 5);
  const freshPage = pageFor(template), freshIncoming = structuredClone(template);
  freshPage.overrides.blueprint.fields.unshift(field('both'));
  freshIncoming.blueprint.fields.push(field('both'));
  const competing = planFor(template, freshPage, freshIncoming);
  assert.equal(competing.unresolved.length, 1);
  assert.equal(competing.unresolved[0].id, id('blueprint', 'fields', '$order'));
});
