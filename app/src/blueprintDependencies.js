import { validateBlueprint } from './templateBlueprint.js';

const FIELD_KINDS = Object.freeze(['button', 'text-field', 'number-field', 'select']);
const LIST_KINDS = Object.freeze(['search-field', 'table', 'checkbox', 'alert-dialog']);
const ROLE_NAMES = Object.freeze({
  button: '操作按钮', 'text-field': '文本与多行输入', 'number-field': '数字输入', select: '单选字段',
  'search-field': '记录检索', table: '表格列表', checkbox: '列表选择', 'alert-dialog': '删除确认',
});
const array = value => Array.isArray(value) ? value : [];

/** Keep the roles that local page configuration can enable, regardless of today's variant. */
export function requiredBlueprintKinds(blueprint) {
  if (!['list', 'form', 'detail'].includes(blueprint?.family)) return [];
  // Multi-line fields use the text-field asset; the library has no separate text-area kind.
  return [...FIELD_KINDS, ...(blueprint.family === 'list' ? LIST_KINDS : [])];
}

/** Validate the declared closure, not unrelated assets that happen to exist in the library. */
export function validateBlueprintDependencies(template, source) {
  if (template?.blueprint === undefined) return [];
  const errors = validateBlueprint(template.blueprint);
  if (errors.length) return errors;
  const componentIds = new Set(array(template.componentIds));
  const patterns = array(source?.patterns);
  const components = array(source?.components);
  array(template.patternIds).forEach(id => {
    const pattern = patterns.find(item => item.id === id);
    if (!pattern) errors.push(`引用的交互模式不存在：${id}。`);
    else array(pattern.componentIds).forEach(componentId => componentIds.add(componentId));
  });
  const kinds = new Set();
  componentIds.forEach(id => {
    const component = components.find(item => item.id === id);
    if (!component) errors.push(`引用的组件不存在：${id}。`);
    else kinds.add(component.kind);
  });
  requiredBlueprintKinds(template.blueprint).forEach(kind => {
    if (!kinds.has(kind)) errors.push(`缺少「${ROLE_NAMES[kind]}」组件引用（${kind}）。`);
  });
  return [...new Set(errors)];
}
