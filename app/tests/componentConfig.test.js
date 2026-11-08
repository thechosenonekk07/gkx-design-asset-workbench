import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeButtonConfig, resolveComponentConfig, safeLinkHref } from '../src/componentConfig.js';

test('button config separates appearance from semantic theme while retaining legacy values', () => {
  assert.deepEqual(normalizeButtonConfig({ variant: 'primary', theme: 'success' }), {
    variant: 'base', theme: 'success', size: 'medium', shape: 'rectangle', type: 'button', block: false,
    ghost: false, loading: false, disabled: false, icon: 'none', suffix: 'none', label: '执行操作',
  });
  assert.equal(normalizeButtonConfig({ variant: 'secondary', theme: 'primary' }).variant, 'outline');
  assert.equal(normalizeButtonConfig({ variant: 'quiet' }).variant, 'text');
});

test('icon-only shapes preserve accessible naming and ignore full-width layout', () => {
  const config = normalizeButtonConfig({ label: '打开设置', shape: 'circle', block: true, icon: 'settings' });
  assert.equal(config.shape, 'circle');
  assert.equal(config.block, false);
  assert.equal(config.icon, 'none');
  assert.equal(config.label, '打开设置');
});


test('old button priority resolves before new defaults and unsafe link schemes are inert', () => {
  const result = resolveComponentConfig('button', {variant:'secondary', label:'取消'}, {theme:'primary', variant:'base'});
  assert.equal(result.theme, 'default');
  assert.equal(result.variant, 'outline');
  for (const input of ['javascript:alert(1)', 'data:text/html,test', 'java\tscript:alert(1)', '']) assert.equal(safeLinkHref(input), '#');
  for (const input of ['/profile', '#details', 'https://react-aria.adobe.com/', 'mailto:a@example.com']) assert.equal(safeLinkHref(input), input);
});
test('selection configuration keeps valid defaults and removes references to deleted options', () => {
  assert.equal(resolveComponentConfig('select', {options:['设计','研发'],value:'研发'}).value, '研发');
  assert.equal(resolveComponentConfig('select', {options:['设计'],value:'研发'}).value, '');
  assert.equal(resolveComponentConfig('tabs', {options:['概览','规范'],value:'规范'}).value, '规范');
  assert.equal(resolveComponentConfig('tabs', {options:['概览'],value:'规范'}).value, '概览');
  assert.deepEqual(resolveComponentConfig('tabs', {options:[],value:'规范'}), {options:[],value:''});
});
