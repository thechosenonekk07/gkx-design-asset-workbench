import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENT_CATALOG, buildComponentSpec } from '../src/componentCatalog.js';

const scenarioCoverage = {
  button: 5,
  link: 4,
  'text-field': 4,
  select: 3,
  tabs: 2,
  dialog: 2,
  'alert-dialog': 2,
  table: 2,
};

const dedicatedEntries = () => Object.keys(scenarioCoverage).map((kind) => {
  const entry = COMPONENT_CATALOG.find((item) => item.kind === kind);
  assert.ok(entry, `${kind} should exist in the shared catalog`);
  return entry;
});

test('component catalog keeps runnable scenario coverage for the high-frequency set', () => {
  for (const entry of dedicatedEntries()) {
    const {kind} = entry;
    const count = scenarioCoverage[kind];
    assert.ok(entry.spec, `${kind} should expose its documentation contract`);
    assert.ok(entry.spec.examples.length >= count, `${kind} should expose at least ${count} examples`);
    for (const example of entry.spec.examples) {
      assert.ok(example.name);
      assert.ok(example.note);
      assert.equal(typeof example.config, 'object');
    }
  }
});

test('dedicated scenarios remain stable when the current component draft has edited state', () => {
  for (const entry of dedicatedEntries()) {
    const draft = {
      ...entry.config,
      label: 'Edited draft',
      options: ['Draft option'],
      disabled: true,
      loading: true,
      value: 'Draft value',
      invalid: true,
      required: true,
      size: 'large',
      description: 'Draft description',
      errorMessage: 'Draft error',
      confirmLabel: 'Draft confirmation',
      tone: 'danger',
    };
    const spec = buildComponentSpec(entry.kind, entry.name, entry.en, entry.category, entry.description, draft, entry.capabilities);
    assert.deepEqual(spec.examples, entry.spec.examples, `${entry.kind} examples must not inherit current draft state`);
    assert.deepEqual(JSON.parse(JSON.stringify(spec.examples)), entry.spec.examples, `${entry.kind} examples must survive asset JSON roundtrips`);
  }
});

test('every dedicated scenario config field is exposed by the component editing contract', () => {
  for (const entry of dedicatedEntries()) {
    const editable = new Set(entry.capabilities);
    for (const example of entry.spec.examples) {
      for (const field of Object.keys(example.config)) {
        assert.ok(editable.has(field), `${entry.kind} scenario ${example.name} exposes uneditable config field ${field}`);
      }
    }
  }
});

test('text error and confirmation scenarios carry the state needed by their previews', () => {
  const text = COMPONENT_CATALOG.find((item) => item.kind === 'text-field');
  const errorExamples = text.spec.examples.filter((example) => example.config.invalid);
  assert.ok(errorExamples.length > 0, 'text input should include an explicit invalid sample');
  for (const example of errorExamples) {
    assert.ok(example.config.errorMessage.trim(), 'invalid text samples need actionable error content');
  }
  assert.ok(text.spec.examples.some((example) => example.config.required && !example.config.invalid));
  assert.ok(text.spec.examples.some((example) => !example.config.required && !example.config.invalid));

  const alerts = COMPONENT_CATALOG.find((item) => item.kind === 'alert-dialog').spec.examples;
  assert.deepEqual(new Set(alerts.map((example) => example.config.tone)), new Set(['primary', 'danger']));
  for (const example of alerts) {
    assert.ok(example.config.description.trim());
    assert.ok(example.config.confirmLabel.trim());
    assert.ok(example.config.cancelLabel.trim());
  }
});

test('reference-backed assets retain source links and token roles', () => {
  const button = COMPONENT_CATALOG.find((item) => item.kind === 'button');
  const link = COMPONENT_CATALOG.find((item) => item.kind === 'link');
  assert.equal(button.spec.sources[0].href, 'https://tdesign.tencent.com/vue-next/components/button');
  assert.equal(link.spec.sources[0].href, 'https://arco.design/docs/spec/link');
  assert.ok(button.spec.tokens.includes('success'));
  assert.ok(link.spec.tokens.includes('focus'));
  assert.ok(link.spec.api.some((prop) => prop.name === 'external'));
  assert.ok(button.bindings.success);
  assert.ok(link.bindings.warning);
});

const originalKinds = new Set([
  'button','toggle-button','link','breadcrumbs','tabs','menu','toolbar','text-field','search-field','number-field',
  'checkbox','checkbox-group','radio-group','switch','select','combo-box','list-box','grid-list','table','tree','tag-group',
  'disclosure','disclosure-group','dialog','alert-dialog','tooltip','popover','slider','range-slider','progress-bar','meter',
  'separator','calendar','range-calendar','date-field','date-picker','date-range-picker','time-field','color-area',
  'color-slider','color-field','color-picker','color-swatch','color-swatch-picker','file-trigger','drop-zone',
]);
const originalEntries = () => COMPONENT_CATALOG.filter(item => originalKinds.has(item.kind));

test('all 46 original components expose individual revision 4 contracts and distinct editable examples', () => {
  assert.equal(originalEntries().length, 46);
  for (const entry of originalEntries()) {
    const spec = entry.spec;
    assert.equal(spec.schemaRevision, 4, entry.kind);
    assert.ok(spec.whenToUse.length > 10, `${entry.kind} requires a concrete use case`);
    assert.ok(spec.avoid.length > 10, `${entry.kind} requires a usage boundary`);
    assert.ok(spec.anatomy.length >= 2, `${entry.kind} requires named anatomy`);
    assert.ok(spec.keyboard.length >= 1, `${entry.kind} requires an honest keyboard contract`);
    assert.ok(spec.acceptance.length >= 2, `${entry.kind} requires multiple checkable outcomes`);
    assert.ok(spec.examples.length >= 2, `${entry.kind} requires multiple scenarios`);
    assert.equal(new Set(spec.examples.map(item => JSON.stringify(item.config))).size, spec.examples.length, `${entry.kind} scenarios must not repeat identical configuration`);
    for (const example of spec.examples) {
      assert.ok(example.group, `${entry.kind}: ${example.name} needs a scenario group`);
      assert.ok(example.note, `${entry.kind}: ${example.name} needs use guidance`);
      for (const field of Object.keys(example.config)) assert.ok(entry.capabilities.includes(field), `${entry.kind}: ${field} is not editable`);
    }
    assert.deepEqual(spec.api.map(prop => prop.name), entry.capabilities);
  }
});

test('every original contract keeps example fixtures and API defaults stable across editing drafts', () => {
  for (const entry of originalEntries()) {
    const draft = {...entry.config,label:'Changed',options:['Changed'],value:'Changed',disabled:true,required:true,size:'large',min:-999,max:999};
    const rebuilt = buildComponentSpec(entry.kind, entry.name, entry.en, entry.category, entry.description, draft, entry.capabilities);
    assert.deepEqual(rebuilt.examples, entry.spec.examples, `${entry.kind} sample fixtures changed with a draft`);
    assert.deepEqual(rebuilt.api, entry.spec.api, `${entry.kind} initial defaults changed with a draft`);
    assert.deepEqual(rebuilt.sources, entry.spec.sources, `${entry.kind} document mapping changed while editing`);
    assert.deepEqual(JSON.parse(JSON.stringify(rebuilt)), rebuilt, `${entry.kind} contract must survive export and import`);
  }
});

test('API defaults preserve boolean, numeric, range, option and enum types', () => {
  const prop = (kind,key) => COMPONENT_CATALOG.find(item => item.kind === kind).spec.api.find(item => item.name === key);
  assert.equal(prop('checkbox','value').type, 'boolean');
  assert.equal(prop('checkbox','value').defaultValue, true);
  assert.equal(prop('number-field','value').defaultValue, 5);
  assert.deepEqual(prop('range-slider','value').defaultValue, [20,80]);
  assert.equal(prop('range-slider','value').type, '[number, number]');
  assert.deepEqual(prop('table','options').defaultValue, ['林青','陈默','周宁']);
  assert.deepEqual(prop('button','variant').supportedValues, ['base','outline','dashed','text']);
  assert.deepEqual(prop('link','icon').supportedValues, [false,true]);
  assert.ok(prop('button','icon').supportedValues.includes('download'));
  assert.equal(prop('button','size').defaultValue, 'medium');
});

test('static display assets do not advertise hover, disabled, or independent focus behavior', () => {
  for (const kind of ['progress-bar','meter','separator','color-swatch']) {
    const entry = COMPONENT_CATALOG.find(item => item.kind === kind);
    assert.ok(!entry.spec.states.some(state => /悬停|禁用|聚焦/.test(state.name)), kind);
    assert.deepEqual(entry.spec.keyboard, ['展示资产，无独立键盘操作。']);
    assert.ok(!entry.spec.api.some(prop => prop.name === 'disabled'), kind);
    assert.ok(!entry.spec.tokens.includes('focus'), kind);
  }
});

test('button scenarios cover appearance, theme, shape, size, state and composition independently', () => {
  const examples = COMPONENT_CATALOG.find(item => item.kind === 'button').spec.examples;
  assert.ok(examples.length >= 10);
  for (const [field,values] of Object.entries({variant:['base','outline','dashed','text'],theme:['default','primary','success','warning','danger'],shape:['rectangle','square','round','circle'],size:['small','medium','large']})) {
    const present = new Set(examples.map(item => item.config[field]));
    for (const value of values) assert.ok(present.has(value), `Button lacks a ${field}=${value} example`);
  }
  assert.ok(examples.some(item => item.config.loading));
  assert.ok(examples.some(item => item.config.disabled));
  assert.ok(examples.some(item => item.config.block));
  assert.ok(examples.some(item => item.config.ghost));
  assert.ok(examples.some(item => item.config.icon !== 'none' && item.config.suffix !== 'none'));
});

test('sample fixtures are detached copies and do not mutate future contracts', () => {
  const entry = COMPONENT_CATALOG.find(item => item.kind === 'table');
  const rebuilt = buildComponentSpec(entry.kind, entry.name, entry.en, entry.category, entry.description, {}, entry.capabilities);
  rebuilt.examples[0].config.options.push('Do not retain');
  rebuilt.api.find(prop => prop.name === 'options').defaultValue.push('Do not retain');
  const fresh = buildComponentSpec(entry.kind, entry.name, entry.en, entry.category, entry.description, {}, entry.capabilities);
  assert.deepEqual(fresh.examples, entry.spec.examples);
  assert.deepEqual(fresh.api, entry.spec.api);
});
