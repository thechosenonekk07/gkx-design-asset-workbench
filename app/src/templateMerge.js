import { validateBlueprint, validatePageOverrides, templateFamily } from './templateBlueprint.js';

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const clone = value => JSON.parse(JSON.stringify(value));
const missing = () => ({ present: false });
const present = value => ({ present: true, value: clone(value) });
const at = (value, key) => value && own(value, key) ? present(value[key]) : missing();
const equal = (a, b) => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(key => own(b, key) && equal(a[key], b[key]));
};

// Validate descriptors before reading values: imported choices and configuration must stay inert.
function jsonSafe(value, active = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (!Array.isArray(value) && !plain(value)) return false;
  if (active.has(value)) return false;
  active.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const valid = Reflect.ownKeys(descriptors).every(key => {
    if (Array.isArray(value) && key === 'length') return true;
    const descriptor = descriptors[key];
    if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)
      || descriptor.get || descriptor.set || !descriptor.enumerable) return false;
    if (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key)) return false;
    return jsonSafe(descriptor.value, active);
  }) && (!Array.isArray(value) || Object.keys(value).length === value.length);
  active.delete(value);
  return valid;
}

const INFORMATION = { title: '页面标题', description: '页面说明', shell: '导航框架', variant: '结构变体', sections: '页面区域顺序' };
const ACTIONS = { primaryLabel: '主要操作文案', secondaryLabel: '次要操作文案', allowCreate: '允许创建', allowDelete: '允许删除' };
const ids = rows => rows.map(row => row.id);
const mapRows = rows => new Map(rows.map(row => [row.id, row]));
const hasReordered = (base, next) => !equal(next.filter(id => base.includes(id)), base.filter(id => next.includes(id)));

/** Retain all selected entities, inserting new IDs near their original neighbors. */
function combineOrder(primary, secondary, base, selected) {
  const order = primary.filter(id => selected.has(id));
  for (const sequence of [secondary, base, [...selected]]) {
    sequence.forEach((id, index) => {
      if (!selected.has(id) || order.includes(id)) return;
      const previous = sequence.slice(0, index).reverse().find(other => order.includes(other));
      const next = sequence.slice(index + 1).find(other => order.includes(other));
      if (previous !== undefined) order.splice(order.indexOf(previous) + 1, 0, id);
      else if (next !== undefined) order.splice(order.indexOf(next), 0, id);
      else order.push(id);
    });
  }
  return order;
}

/**
 * Compare the adopted template, the page's effective configuration, and a new shared template.
 * Choices only address generated units. Unresolved conflicts keep the local value for review;
 * callers MUST reject application while unresolved or errors is non-empty.
 */
export function planTemplateMerge({ baseTemplate, page, nextTemplate, source, choices = {} } = {}) {
  const result = { pageId: null, entries: [], unresolved: [], errors: [], candidatePage: null, hasChanges: false };
  if (!plain(page) || !jsonSafe(page)) {
    result.errors.push('项目页面必须为不含可执行属性的 JSON 对象。');
    return result;
  }
  result.pageId = page.id ?? null;
  result.candidatePage = clone(page);
  if (!plain(baseTemplate) || !jsonSafe(baseTemplate)) result.errors.push('找不到有效的旧版页面模板。');
  if (!plain(nextTemplate) || !jsonSafe(nextTemplate)) result.errors.push('新版页面模板不存在或不是有效的 JSON 对象。');
  if (!plain(choices) || !jsonSafe(choices)) result.errors.push('合并选择必须为不含可执行属性的普通 JSON 对象。');
  if (source !== undefined && (!plain(source) || !jsonSafe(source))) result.errors.push('新资产来源必须为有效的 JSON 对象。');
  if (result.errors.length) return result;
  if (baseTemplate.id !== nextTemplate.id || (own(page, 'templateId') && page.templateId !== baseTemplate.id)) result.errors.push('合并不能改变项目页面所采用的模板标识。');
  if (templateFamily(baseTemplate) !== templateFamily(nextTemplate)) result.errors.push('新旧模板的页面类型不兼容，需要另行迁移。');
  if (own(baseTemplate, 'blueprint') !== own(nextTemplate, 'blueprint')
    || (baseTemplate.blueprint && baseTemplate.blueprint.version !== nextTemplate.blueprint.version)) result.errors.push('新旧模板的页面配置版本或结构不兼容，需要另行迁移。');
  if (baseTemplate.blueprint) result.errors.push(...validateBlueprint(baseTemplate.blueprint).map(error => `旧模板：${error}`));
  if (nextTemplate.blueprint) result.errors.push(...validateBlueprint(nextTemplate.blueprint).map(error => `新模板：${error}`));
  result.errors.push(...validatePageOverrides(page, baseTemplate).map(error => `当前页面：${error}`));
  if (result.errors.length) return result;

  const unit = (path, label, group, base, local, incoming, forceConflict = false, reason) => {
    if (equal(base, local) && equal(base, incoming) && !forceConflict) return { value: local, entry: null };
    const status = forceConflict ? 'conflict' : equal(local, incoming) ? 'same'
      : equal(base, local) ? 'incoming' : equal(base, incoming) ? 'local' : 'conflict';
    const entry = { id: JSON.stringify(path), label, group, base, local, incoming, status,
      choice: status === 'incoming' || status === 'same' ? 'incoming' : status === 'local' ? 'local' : null,
      ...(reason ? { reason } : {}) };
    if (own(choices, entry.id) && ['local', 'incoming'].includes(choices[entry.id])) entry.choice = choices[entry.id];
    result.entries.push(entry);
    const selected = { value: entry.choice === 'incoming' ? incoming : local, entry };
    return selected;
  };
  const localBlueprint = page.overrides?.blueprint || baseTemplate.blueprint;
  const nextBlueprint = nextTemplate.blueprint;
  const candidateOverrides = {};

  if (localBlueprint) {
    const base = baseTemplate.blueprint, local = localBlueprint, incoming = nextBlueprint;
    const blueprint = clone(incoming);
    for (const [key, label] of Object.entries(INFORMATION)) {
      const selected = unit(['blueprint', key], label, ['shell', 'variant', 'sections'].includes(key) ? '页面结构' : '页面信息', at(base, key), at(local, key), at(incoming, key));
      if (selected.value.present) blueprint[key] = clone(selected.value.value);
      else delete blueprint[key];
    }
    for (const [key, label] of Object.entries(ACTIONS)) {
      const selected = unit(['blueprint', 'actions', key], label, '页面操作', at(base.actions, key), at(local.actions, key), at(incoming.actions, key));
      if (selected.value.present) blueprint.actions[key] = clone(selected.value.value);
      else delete blueprint.actions[key];
    }
    for (const key of ['fields', 'records']) {
      const baseMap = mapRows(base[key]), localMap = mapRows(local[key]), incomingMap = mapRows(incoming[key]);
      const selectedMap = new Map();
      const group = key === 'fields' ? '字段' : '示例数据';
      const rowValue = (map, id) => map.has(id) ? present(map.get(id)) : missing();
      const changedDependentValue = (fieldId, candidate, other) => candidate.records.some(row => own(row.values, fieldId)
        && (!other.records.some(entry => entry.id === row.id) || !equal(at(row.values, fieldId), at(other.records.find(entry => entry.id === row.id)?.values, fieldId))));
      for (const id of new Set([...baseMap.keys(), ...localMap.keys(), ...incomingMap.keys()])) {
        const b = rowValue(baseMap, id), l = rowValue(localMap, id), n = rowValue(incomingMap, id);
        const dependencyConflict = key === 'fields' && b.present
          && ((!n.present && l.present && changedDependentValue(id, local, base))
            || (!l.present && n.present && changedDependentValue(id, incoming, base)));
        const label = key === 'fields' ? (l.value?.label || n.value?.label || b.value?.label || id) : `记录 ${id}`;
        const selected = unit(['blueprint', key, id], label, group, b, l, n, dependencyConflict,
          dependencyConflict ? '字段删除与另一侧新增或修改的示例值有关，需要同时核对字段和示例记录。' : undefined);
        if (selected.value.present) selectedMap.set(id, clone(selected.value.value));
      }
      const baseOrder = ids(base[key]), localOrder = ids(local[key]), incomingOrder = ids(incoming[key]);
      const localReordered = hasReordered(baseOrder, localOrder), incomingReordered = hasReordered(baseOrder, incomingOrder);
      const selectedOrder = unit(['blueprint', key, '$order'], `${group}顺序`, group, present(baseOrder), present(localOrder), present(incomingOrder));
      // Compare only shared IDs when deciding whether two moves compete. New IDs remain in the union.
      const common = new Set(localOrder.filter(id => incomingOrder.includes(id)));
      const sameCommonOrder = equal(localOrder.filter(id => common.has(id)), incomingOrder.filter(id => common.has(id)));
      const commonAdditions = [...common].some(id => !baseOrder.includes(id));
      const compatibleOrder = sameCommonOrder || (!commonAdditions && (!localReordered || !incomingReordered));
      if (selectedOrder.entry && selectedOrder.entry.status === 'conflict' && compatibleOrder) {
        const entry = selectedOrder.entry;
        entry.status = sameCommonOrder ? 'same' : localReordered ? 'local' : incomingReordered ? 'incoming' : 'same';
        entry.reason = '保留双方仍然存在的条目；独立新增条目按相邻位置合入，不因顺序选择被删除。';
        if (!own(choices, entry.id)) entry.choice = localReordered ? 'local' : 'incoming';
        selectedOrder.value = entry.choice === 'local' ? entry.local : entry.incoming;
      }
      const primary = selectedOrder.value.value;
      const secondary = equal(primary, incomingOrder) ? localOrder : incomingOrder;
      blueprint[key] = combineOrder(primary, secondary, baseOrder, new Set(selectedMap.keys())).map(id => selectedMap.get(id));
    }
    if (!equal(blueprint, incoming)) candidateOverrides.blueprint = blueprint;
  }
  const composition = unit(['composition'], '页面区域编排', '区域编排', at(baseTemplate, 'composition'),
    own(page.overrides || {}, 'composition') ? at(page.overrides, 'composition') : at(baseTemplate, 'composition'), at(nextTemplate, 'composition'));
  if (composition.value.present && !equal(composition.value, at(nextTemplate, 'composition'))) candidateOverrides.composition = clone(composition.value.value);
  // The current override contract cannot represent an explicit absence inherited from a new template.
  if (!composition.value.present && own(nextTemplate, 'composition') && composition.entry?.choice === 'local') {
    result.errors.push('当前页面未采用区域编排；新版新增了区域编排。请选择采用新版编排，或先调整共享模板，不能把缺失值伪装为空编排。');
  }

  const knownIds = new Set(result.entries.map(entry => entry.id));
  for (const [id, choice] of Object.entries(choices)) {
    if (!knownIds.has(id)) result.errors.push(`合并选择引用了不存在的差异项：${id}。`);
    else if (!['local', 'incoming'].includes(choice)) result.errors.push(`差异项的选择只能为 local 或 incoming：${id}。`);
  }
  const candidatePage = clone(page);
  if (Object.keys(candidateOverrides).length) candidatePage.overrides = candidateOverrides;
  else delete candidatePage.overrides;
  result.candidatePage = candidatePage;
  result.errors.push(...validatePageOverrides(candidatePage, nextTemplate, source));
  result.unresolved = result.entries.filter(entry => entry.status === 'conflict' && entry.choice === null);
  result.hasChanges = result.entries.length > 0;
  return result;
}
