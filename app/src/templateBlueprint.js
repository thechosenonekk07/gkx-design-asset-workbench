import { validateComposition } from './composition.js';

/** A serializable page contract. Data, navigation shell, and task behavior are independent. */
export const BLUEPRINT_FAMILIES = Object.freeze({ list: '列表检索', form: '表单向导', detail: '详情阅读' });
export const BLUEPRINT_SHELLS = Object.freeze({ none: '无导航框架', side: '侧边导航', top: '顶部导航' });
export const BLUEPRINT_VARIANTS = Object.freeze({
  list: Object.freeze({ table: '表格列表', cards: '卡片列表' }),
  form: Object.freeze({ standard: '单页表单', wizard: '分步表单' }),
  detail: Object.freeze({ summary: '摘要详情', sections: '分区详情' }),
});
export const BLUEPRINT_LIMITS = Object.freeze({ fields: 24, records: 100, options: 50, valueLength: 4000 });
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const forbiddenIds = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value, max, required = false) => typeof value === 'string' && value.length <= max
  && (!required || !!value.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const identifier = value => text(value, 100, true) && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value) && !forbiddenIds.has(value);
const clone = value => JSON.parse(JSON.stringify(value));

function keys(value, allowed, label, errors) {
  if (!record(value)) { errors.push(`${label}必须为普通对象。`); return false; }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !allowed.includes(key)
    || descriptors[key].get || descriptors[key].set || !descriptors[key].enumerable)) {
    errors.push(`${label}包含不支持的字段。`); return false;
  }
  return true;
}

export function validateBlueprint(value) {
  const errors = [];
  if (!keys(value, ['version', 'family', 'variant', 'shell', 'title', 'description', 'fields', 'records', 'actions', 'sections'], '页面配置', errors)) return errors;
  if (value.version !== 1) errors.push('页面配置版本必须为 1。');
  if (!own(BLUEPRINT_FAMILIES, value.family)) errors.push('页面类型必须为列表、表单或详情。');
  if (!own(BLUEPRINT_VARIANTS[value.family] || {}, value.variant)) errors.push('页面结构变体与页面类型不匹配。');
  if (!own(BLUEPRINT_SHELLS, value.shell)) errors.push('导航框架必须为无导航、侧边导航或顶部导航。');
  if (!text(value.title, 120, true)) errors.push('页面标题需要为 120 字以内的非空文本。');
  if (!text(value.description, 1000)) errors.push('页面说明需要为 1000 字以内文本。');
  if (!Array.isArray(value.fields) || !value.fields.length || value.fields.length > BLUEPRINT_LIMITS.fields) {
    errors.push(`页面需要 1 至 ${BLUEPRINT_LIMITS.fields} 个字段。`);
  }
  const fieldMap = new Map();
  if (Array.isArray(value.fields) && value.fields.length <= BLUEPRINT_LIMITS.fields) value.fields.forEach((field, index) => {
    const label = `第 ${index + 1} 个字段`;
    if (!keys(field, ['id', 'label', 'type', 'required', 'options'], label, errors)) return;
    if (!identifier(field.id)) errors.push(`${label}标识必须为安全的英文、数字、点、下划线或连字符。`);
    if (fieldMap.has(field.id)) errors.push(`${label}标识重复：${field.id}。`);
    else fieldMap.set(field.id, field);
    if (!text(field.label, 120, true)) errors.push(`${label}名称需要为 120 字以内非空文本。`);
    if (!['text', 'number', 'select', 'textarea'].includes(field.type)) errors.push(`${label}类型不受支持。`);
    if (typeof field.required !== 'boolean') errors.push(`${label}必填设置必须为布尔值。`);
    if (field.type === 'select') {
      if (!Array.isArray(field.options) || !field.options.length || field.options.length > BLUEPRINT_LIMITS.options
        || field.options.some(option => !text(option, 160, true)) || new Set(field.options).size !== field.options.length) {
        errors.push(`${label}需要 1 至 ${BLUEPRINT_LIMITS.options} 个非空、不重复的选项。`);
      }
    } else if (own(field, 'options')) errors.push(`${label}只有选择类型可以包含选项。`);
  });

  if (!Array.isArray(value.records) || value.records.length > BLUEPRINT_LIMITS.records) errors.push(`示例记录需要为数组且不能超过 ${BLUEPRINT_LIMITS.records} 条。`);
  const recordIds = new Set();
  if (Array.isArray(value.records) && value.records.length <= BLUEPRINT_LIMITS.records) value.records.forEach((entry, index) => {
    const label = `第 ${index + 1} 条示例记录`;
    if (!keys(entry, ['id', 'values'], label, errors)) return;
    if (!identifier(entry.id)) errors.push(`${label}需要安全的非空标识。`);
    if (recordIds.has(entry.id)) errors.push(`${label}标识重复：${entry.id}。`);
    recordIds.add(entry.id);
    if (!keys(entry.values, [...fieldMap.keys()], `${label}的字段值`, errors)) return;
    Object.entries(entry.values).forEach(([fieldId, fieldValue]) => {
      const field = fieldMap.get(fieldId);
      if (field.type === 'number') {
        if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) errors.push(`${label}的「${field.label}」必须为有限数字。`);
      } else if (!text(fieldValue, BLUEPRINT_LIMITS.valueLength)) errors.push(`${label}的「${field.label}」必须为 ${BLUEPRINT_LIMITS.valueLength} 字以内文本。`);
      else if (field.type === 'select' && fieldValue !== '' && (!Array.isArray(field.options) || !field.options.includes(fieldValue))) errors.push(`${label}的「${field.label}」不在可用选项中。`);
    });
  });
  if (keys(value.actions, ['primaryLabel', 'secondaryLabel', 'allowCreate', 'allowDelete'], '页面操作', errors)) {
    if (!text(value.actions.primaryLabel, 80, true)) errors.push('主要操作文案需要为 80 字以内非空文本。');
    if (!text(value.actions.secondaryLabel, 80, true)) errors.push('次要操作文案需要为 80 字以内非空文本。');
    if (typeof value.actions.allowCreate !== 'boolean' || typeof value.actions.allowDelete !== 'boolean') errors.push('创建与删除能力必须为布尔值。');
  }
  if (!Array.isArray(value.sections) || !value.sections.includes('content') || value.sections.length > 4
    || value.sections.some(section => !['intro', 'filters', 'content', 'actions'].includes(section))
    || new Set(value.sections).size !== value.sections.length) errors.push('页面区域只能由不重复的 intro、filters、content、actions 组成，且必须保留 content。');
  return errors;
}

export function assertBlueprint(value) {
  const errors = validateBlueprint(value);
  if (errors.length) throw new Error(errors.join('\n'));
  return value;
}

export function templateFamily(template) {
  if (template?.blueprint && own(BLUEPRINT_FAMILIES, template.blueprint.family)) return template.blueprint.family;
  return ({ dashboard: 'overview', list: 'list', form: 'form', wizard: 'form', detail: 'detail', settings: 'settings' })[template?.layout] || 'custom';
}

/** Overrides may reorganize already adopted dependencies, never introduce unrelated shared assets. */
export function validatePageOverrides(page, template, source) {
  const errors = [];
  if (!record(page)) return ['项目页面必须为普通对象。'];
  const descriptor = Object.getOwnPropertyDescriptor(page, 'overrides');
  if (!descriptor) return errors;
  if (descriptor.get || descriptor.set) return ['项目页面配置包含不支持的字段。'];
  if (!keys(descriptor.value, ['blueprint', 'composition'], '项目页面配置', errors)) return errors;
  const overrides = descriptor.value;
  if (own(overrides, 'blueprint')) {
    const blueprintErrors = validateBlueprint(overrides.blueprint);
    errors.push(...blueprintErrors);
    if (!template?.blueprint) errors.push('该模板没有可供继承的页面配置。');
    else if (!blueprintErrors.length && overrides.blueprint.family !== template.blueprint.family) errors.push('项目页面不能修改所采用模板的页面类型。');
  }
  if (own(overrides, 'composition')) {
    const compositionErrors = validateComposition(overrides.composition, source);
    errors.push(...compositionErrors);
    if (!compositionErrors.length && source) {
      const patterns = new Set(template?.patternIds || []);
      const components = new Set(template?.componentIds || []);
      (source.patterns || []).filter(pattern => patterns.has(pattern.id)).forEach(pattern => (pattern.componentIds || []).forEach(id => components.add(id)));
      overrides.composition.regions.forEach(region => region.items.forEach(item => {
        if (!(item.layer === 'patterns' ? patterns : components).has(item.assetId)) errors.push(`项目页面只能编排所采用模板的依赖资产：${item.assetId}。`);
      }));
    }
  }
  return errors;
}

export function resolvePageTemplate(template, page = {}) {
  if (!record(template)) throw new Error('找不到所采用的页面模板。');
  const errors = validatePageOverrides(page, template);
  if (template.blueprint) errors.push(...validateBlueprint(template.blueprint));
  if (errors.length) throw new Error(errors.join('\n'));
  return { ...clone(template), ...clone(page.overrides || {}) };
}
