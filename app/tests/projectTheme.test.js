import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDoc, createProject, resolveToken, validateDoc, SCHEMA_VERSION } from '../src/model.js';
import { applyProjectTheme, resetProjectThemeValue, validateProjectTheme } from '../src/projectTheme.js';

const project = () => createProject(createInitialDoc([]), { name: '独立主题项目' }).projects[0];
test('project theme resolves semantic aliases without mutating shared baseline', () => {
  const source = project();
  const before = JSON.stringify(source.snapshot);
  const customized = { ...source, themeOverrides: { 'color.action': { value: '#7C3AED' }, 'radius.md': { value: 12 } } };
  const effective = applyProjectTheme(customized);
  assert.equal(resolveToken(effective, 'color.action'), '#7C3AED');
  assert.equal(resolveToken(effective, 'radius.md'), 12);
  assert.equal(resolveToken(effective, 'color.action', 'dark'), resolveToken(source.snapshot, 'color.action', 'dark'));
  assert.equal(JSON.stringify(source.snapshot), before);
  validateDoc({ schemaVersion: SCHEMA_VERSION, ...effective, projects: [], history: [] });
});
test('overriding a foundation keeps dependent semantic token references live in both modes', () => {
  const source = project();
  const effective = applyProjectTheme({ ...source, themeOverrides: { 'palette.blue.600': { value: '#7755CC', darkValue: '#AA99EE' } } });
  assert.equal(resolveToken(effective, 'color.action'), '#7755CC');
  // An explicit semantic dark color remains independent from a palette change.
  assert.equal(resolveToken(effective, 'color.action', 'dark'), resolveToken(source.snapshot, 'color.action', 'dark'));
  assert.equal(resolveToken(effective, 'palette.blue.600', 'dark'), '#AA99EE');
});
test('a dark-only semantic override preserves project-local light alias updates', () => {
  const source = project();
  const effective = applyProjectTheme({ ...source, themeOverrides: { 'palette.blue.600': { value: '#7755CC' }, 'color.action': { darkValue: '#F0AAFF' } } });
  assert.equal(resolveToken(effective, 'color.action'), '#7755CC');
  assert.equal(resolveToken(effective, 'color.action', 'dark'), '#F0AAFF');
});
test('reset one mode preserves the other and removes empty override objects', () => {
  const source = { 'color.action': { value: '#123456', darkValue: '#654321' } };
  const lightReset = resetProjectThemeValue(source, 'color.action', 'value');
  assert.deepEqual(lightReset, { 'color.action': { darkValue: '#654321' } });
  assert.deepEqual(resetProjectThemeValue(lightReset, 'color.action', 'darkValue'), {});
  assert.deepEqual(resetProjectThemeValue(source, 'color.action'), {});
  assert.equal(source['color.action'].value, '#123456');
});
test('invalid project overrides fail before a snapshot is generated', () => {
  const source = project();
  for (const overrides of [{ missing: { value: 2 } }, { 'radius.md': { value: '12px' } }, { 'radius.md': { value: Infinity } }, { 'color.action': { alias: 'color.text' } }, { 'motion.duration': { value: -1 } }, { 'color.action': {} }, []]) {
    assert.throws(() => validateProjectTheme({ ...source, themeOverrides: overrides }));
  }
});
test('full model validation rejects malformed CSS after theme materialization', () => {
  const source = project();
  const effective = applyProjectTheme({ ...source, themeOverrides: { 'color.action': { value: 'not-a-color' } } });
  assert.throws(() => validateDoc({ schemaVersion: SCHEMA_VERSION, ...effective, projects: [], history: [] }), /颜色/);
});
