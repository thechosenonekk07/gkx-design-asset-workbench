import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDoc, upgradeTemplateLibrary, createProject, createProjectCheckPlan, recordProjectCheck } from '../src/model.js';
import { compareProjectDelivery, getDeliveryProject } from '../src/projectDelivery.js';

const clone = value => JSON.parse(JSON.stringify(value));
const kinds = ['button', 'text-field', 'text-area', 'number-field', 'select', 'table', 'search-field', 'checkbox', 'alert-dialog', 'progress-bar', 'disclosure', 'switch', 'tabs', 'radio-group', 'breadcrumbs', 'menu', 'meter'];
function fixture() {
  let doc = createProject(upgradeTemplateLibrary(createInitialDoc(kinds.map(kind => ({ kind, name:kind, config:{} })))),
    { id:'delivery-project', name:'客户管理项目', description:'可复用资源管理', templateId:'t-flex-list-table' });
  doc = createProjectCheckPlan(doc, 'delivery-project');
  doc.projects[0].checks.forEach(check => { doc = recordProjectCheck(doc, 'delivery-project', { id:check.id, status:'passed', evidence:`已逐项核对 ${check.dimension}，见截图。` }); });
  const project = doc.projects[0];
  return { project, record:{ id:'delivery-1', package:{ project:clone(project) } } };
}
const template = project => project.snapshot.templates.find(item => item.id === project.pages[0].templateId);
const changes = (result, category) => result.changes.filter(change => change.category === category);
const deepFreeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; };

test('unchanged archive ignores archive metadata, record history, asset timestamps and object-key order without mutating inputs', () => {
  const { project, record } = fixture();
  project.deliveries = [{ id:'delivery-1', archivedAt:'2030-01-01' }];
  project.updatedAt = '2030-01-01';
  project.snapshot.components[0].updatedAt = '2030-01-02';
  project.checks[0].history = [{ evidence:'旧证据', archivedAt:'2030-01-02' }];
  project.checks[0].updatedAt = '2030-01-03';
  project.themeOverrides = Object.fromEntries(Object.entries(project.themeOverrides).reverse());
  deepFreeze(project); deepFreeze(record);
  const result = compareProjectDelivery(record, project);
  assert.deepEqual(result, { changed:false, summary:{pages:0,theme:0,assets:0,checks:0,metadata:0}, changes:[] });
  const copy = getDeliveryProject(record);
  copy.pages[0].name = '副本修改';
  assert.notEqual(record.package.project.pages[0].name, copy.pages[0].name);
});

test('comparison identifies actual page titles, fields, actions and sample values even when counts remain equal', () => {
  const { project, record } = fixture();
  const blueprint = clone(template(project).blueprint);
  blueprint.title = '客户资料';
  blueprint.fields[0].label = '客户名称';
  blueprint.actions.primaryLabel = '新增客户';
  blueprint.records[0].values[blueprint.fields[0].id] = '新的样本内容';
  blueprint.sections.reverse();
  project.pages[0].overrides = { blueprint };
  const result = compareProjectDelivery(record, project);
  assert.equal(result.changed, true);
  const entries = changes(result, 'pages');
  assert.ok(entries.some(change => change.after === '客户资料' && /标题/.test(change.label)));
  assert.ok(entries.some(change => change.after === '客户名称' && /文案/.test(change.label)));
  assert.ok(entries.some(change => change.after === '新增客户' && /主要操作/.test(change.label)));
  assert.ok(entries.some(change => change.after === '新的样本内容' && /客户名称/.test(change.label)));
  assert.ok(entries.some(change => /区域顺序/.test(change.label) && /主要内容/.test(change.after)));
  assert.equal(result.summary.pages, entries.length);
  assert.ok(entries.every(change => typeof change.before === 'string' && typeof change.after === 'string'));
});

test('effective page comparison honors local overrides and skips unrelated snapshot assets', () => {
  const { project, record } = fixture();
  const local = clone(template(project).blueprint);
  local.title = '项目自己的标题';
  project.pages[0].overrides = { blueprint:clone(local) };
  record.package.project.pages[0].overrides = { blueprint:clone(local) };
  template(project).blueprint.title = '被项目覆盖的共享标题';
  project.snapshot.templates.find(item => item.id !== project.pages[0].templateId).description = '不相关的模板变更';
  project.snapshot.tokens.find(item => item.id === 'palette.violet.900').value = '#123456';
  project.snapshot.revision += 1;
  project.checks = []; record.package.project.checks = [];
  assert.equal(compareProjectDelivery(record, project).changed, false);
});

test('comparison reports added and removed pages plus ordering of stable page identities', () => {
  const { project, record } = fixture();
  project.pages.push({ ...clone(project.pages[0]), id:'page-2', name:'新页面' });
  assert.ok(changes(compareProjectDelivery(record, project), 'pages').some(change => /新增/.test(change.label) && /新页面/.test(change.after)));
  record.package.project.pages.push(clone(project.pages[1]));
  project.pages.reverse();
  assert.ok(changes(compareProjectDelivery(record, project), 'pages').some(change => /页面排列顺序/.test(change.label)));
  project.pages = project.pages.filter(page => page.id !== 'page-1');
  assert.ok(changes(compareProjectDelivery(record, project), 'pages').some(change => /移除/.test(change.label) && change.after === '未设置'));
});

test('theme overrides, alias dependencies and adopted component config changes are compared by value', () => {
  const { project, record } = fixture();
  project.themeOverrides = { 'radius.md':{ value:14 } };
  project.snapshot.tokens.find(token => token.id === 'palette.blue.600').value = '#112233';
  const adoptedId = template(project).componentIds[0];
  project.snapshot.components.find(component => component.id === adoptedId).config = { label:'本次更新' };
  const result = compareProjectDelivery(record, project);
  assert.ok(changes(result, 'theme').some(change => /14/.test(change.after)));
  assert.ok(changes(result, 'assets').some(change => change.after === '#112233'));
  assert.ok(changes(result, 'assets').some(change => change.after === '本次更新'));
});

test('checks compare derived stale conclusions, evidence, standards and same-name page scopes', () => {
  const { project, record } = fixture();
  project.designRevision += 1;
  project.checks[0].evidence = '重新查验，证据不同。';
  project.checks[0].description = '本次补充标准';
  project.pages.push({ ...clone(project.pages[0]), id:'page-2' });
  project.checks[0].pageId = 'page-2';
  const entries = changes(compareProjectDelivery(record, project), 'checks');
  assert.ok(entries.some(change => change.before === '人工通过' && change.after === '需要复验'));
  assert.ok(entries.some(change => /检查证据/.test(change.label) && change.after === '重新查验，证据不同。'));
  assert.ok(entries.some(change => /说明/.test(change.label) && change.after === '本次补充标准'));
  assert.ok(entries.some(change => /检查范围/.test(change.label) && /page-1/.test(change.before) && /page-2/.test(change.after)));
});

test('same-count checks replaced with different identities and metadata edits are not treated as equal', () => {
  const { project, record } = fixture();
  project.checks[0].id = 'replacement-check';
  project.name = '新的项目名称';
  project.description = '新的项目说明';
  const result = compareProjectDelivery(record, project);
  assert.equal(result.summary.metadata, 2);
  assert.ok(changes(result, 'checks').some(change => /新增/.test(change.label)));
  assert.ok(changes(result, 'checks').some(change => /移除/.test(change.label)));
  assert.equal(new Set(result.changes.map(change => change.id)).size, result.changes.length);
});

test('zero, empty text and missing sample values remain distinct; long evidence stays bounded', () => {
  const { project, record } = fixture();
  const blueprint = template(project).blueprint;
  const oldBlueprint = template(record.package.project).blueprint;
  for (const value of [blueprint, oldBlueprint]) {
    value.fields.push({ id:'count', label:'数量', type:'number', required:false });
    value.records[0].values.count = 0;
  }
  const field = blueprint.fields[0];
  blueprint.records[0].values[field.id] = '';
  const first = changes(compareProjectDelivery(record, project), 'pages');
  assert.ok(first.some(change => change.after === '空文本'));
  delete blueprint.records[0].values[field.id];
  delete blueprint.records[0].values.count;
  const second = changes(compareProjectDelivery(record, project), 'pages');
  assert.ok(second.some(change => change.after === '未设置'));
  assert.ok(second.some(change => change.before === '0' && change.after === '未设置' && /数量/.test(change.label)));
  project.checks[0].evidence = '证据'.repeat(300);
  const check = changes(compareProjectDelivery(record, project), 'checks').find(change => /检查证据/.test(change.label));
  assert.ok(check.after.length < 280);
  assert.match(check.after, /共 600 字/);
});

test('invalid delivery or adopted dependency is surfaced instead of being represented as an empty equivalent project', () => {
  assert.throws(() => getDeliveryProject({ package:{} }), /有效的项目快照/);
  const { project, record } = fixture();
  project.snapshot.templates = [];
  assert.throws(() => compareProjectDelivery(record, project), /页面模板/);
});

test('equal-length edits beyond a long evidence prefix still expose the changed text', () => {
  const { project, record } = fixture();
  record.package.project.checks[0].evidence = `${'前段相同。'.repeat(60)}原证据`;
  project.checks[0].evidence = `${'前段相同。'.repeat(60)}新证据`;
  const result = changes(compareProjectDelivery(record, project), 'checks').find(change => /检查证据/.test(change.label));
  assert.notEqual(result.before, result.after);
  assert.match(result.before, /原证据/);
  assert.match(result.after, /新证据/);
  assert.ok(result.before.length < 260 && result.after.length < 260);
  assert.equal(result.fullBefore, record.package.project.checks[0].evidence);
  assert.equal(result.fullAfter, project.checks[0].evidence);
});

test('older standalone snapshots with partial component bindings retain default-token dependency changes', () => {
  const { project, record } = fixture();
  for (const item of [project, record.package.project]) item.snapshot.components.forEach(component => { component.bindings = {}; });
  project.snapshot.tokens.find(token => token.id === 'radius.md').value = 16;
  const entries = changes(compareProjectDelivery(record, project), 'assets');
  assert.ok(entries.some(change => /圆角/.test(change.label) && change.after === '16'));
});
