/** Serializable page structure. Instances are independent; referenced assets remain shared. */
export const COMPOSITION_LIMITS = Object.freeze({ regions: 20, itemsPerRegion: 50, totalItems: 200 });
const layers = new Set(['components', 'patterns']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const validText = (value, max, required = false) => typeof value === 'string' && value.length <= max
  && (!required || !!value.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const nextId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;

export function validateComposition(value, source) {
  const errors = [];
  const keys = (record, allowed, label) => {
    if (!isRecord(record)) { errors.push(`${label}必须为普通对象。`); return false; }
    const descriptors = Object.getOwnPropertyDescriptors(record);
    if (Object.keys(descriptors).some(key => !allowed.includes(key) || descriptors[key].get || descriptors[key].set)) {
      errors.push(`${label}包含不支持的字段。`); return false;
    }
    return true;
  };
  if (!keys(value, ['version', 'regions'], '页面编排')) return errors;
  if (value.version !== 1) errors.push('页面编排版本必须为 1。');
  if (!Array.isArray(value.regions)) return [...errors, '页面编排需要区域列表。'];
  if (value.regions.length > COMPOSITION_LIMITS.regions) return [...errors, `区域不能超过 ${COMPOSITION_LIMITS.regions} 个。`];
  const identities = new Set();
  const checkId = (id, label) => {
    if (!validText(id, 160, true)) errors.push(`${label}需要有效标识。`);
    else if (identities.has(id)) errors.push(`${label}标识重复：${id}。`);
    else identities.add(id);
  };
  let total = 0;
  value.regions.forEach((region, index) => {
    const label = `第 ${index + 1} 个区域`;
    if (!keys(region, ['id', 'title', 'columns', 'items'], label)) return;
    checkId(region.id, label);
    if (!validText(region.title, 120)) errors.push(`${label}标题需要为 120 字以内文本。`);
    if (![1, 2, 3].includes(region.columns)) errors.push(`${label}列数只能为 1、2 或 3。`);
    if (!Array.isArray(region.items)) { errors.push(`${label}需要实例列表。`); return; }
    total += region.items.length;
    if (region.items.length > COMPOSITION_LIMITS.itemsPerRegion) { errors.push(`${label}不能超过 ${COMPOSITION_LIMITS.itemsPerRegion} 个实例。`); return; }
    region.items.forEach((item, itemIndex) => {
      const itemLabel = `${label}的第 ${itemIndex + 1} 个实例`;
      if (!keys(item, ['id', 'layer', 'assetId', 'label'], itemLabel)) return;
      checkId(item.id, itemLabel);
      if (!layers.has(item.layer)) errors.push(`${itemLabel}只能引用组件或交互模式。`);
      if (!validText(item.assetId, 160, true)) errors.push(`${itemLabel}需要有效资产标识。`);
      if (item.label !== undefined && !validText(item.label, 160)) errors.push(`${itemLabel}文案需要为 160 字以内文本。`);
      if (source && layers.has(item.layer) && !(source[item.layer] || []).some(asset => asset.id === item.assetId)) {
        errors.push(`${itemLabel}引用的资产不存在：${item.assetId}。`);
      }
    });
  });
  if (total > COMPOSITION_LIMITS.totalItems) errors.push(`页面实例总数不能超过 ${COMPOSITION_LIMITS.totalItems} 个。`);
  return errors;
}

export function assertComposition(value, source) {
  const errors = validateComposition(value, source);
  if (errors.length) throw new Error(errors.join('\n'));
  return value;
}

export function normalizeComposition(value = { version: 1, regions: [] }, source) {
  assertComposition(value, source);
  return { version: 1, regions: value.regions.map(region => ({
    id: region.id, title: region.title, columns: region.columns,
    items: region.items.map(item => ({ id: item.id, layer: item.layer, assetId: item.assetId,
      ...(item.label !== undefined ? { label: item.label } : {}),
    })),
  })) };
}

/** Only direct dependencies belong here. Model graph traversal resolves pattern components. */
export function deriveCompositionReferences(value) {
  assertComposition(value);
  const componentIds = new Set();
  const patternIds = new Set();
  value.regions.forEach(region => region.items.forEach(item => (item.layer === 'components' ? componentIds : patternIds).add(item.assetId)));
  return { componentIds: [...componentIds], patternIds: [...patternIds] };
}

export function createCompositionRegion(title = '新区域') {
  return { id: nextId('region'), title, columns: 1, items: [] };
}

export function createCompositionInstance(layer, assetId) {
  const instance = { id: nextId('instance'), layer, assetId };
  assertComposition({ version: 1, regions: [{ id: 'validation-region', title: '', columns: 1, items: [instance] }] });
  return instance;
}

export function compositionFromReferences({ componentIds = [], patternIds = [] } = {}, source) {
  const region = createCompositionRegion('页面内容');
  region.items = [...patternIds.map(id => createCompositionInstance('patterns', id)), ...componentIds.map(id => createCompositionInstance('components', id))];
  return normalizeComposition({ version: 1, regions: [region] }, source);
}

const reordered = (list, id, offset) => {
  if (![-1, 1].includes(offset)) throw new Error('移动方向只能为上移或下移。');
  const result = [...list];
  const from = result.findIndex(item => item.id === id);
  if (from < 0) throw new Error('找不到需要移动的区域或实例。');
  const to = from + offset;
  if (to >= 0 && to < result.length) [result[from], result[to]] = [result[to], result[from]];
  return result;
};

export function moveCompositionRegion(value, regionId, offset) {
  const next = normalizeComposition(value);
  next.regions = reordered(next.regions, regionId, offset);
  return next;
}

export function moveCompositionItem(value, regionId, instanceId, offset) {
  const next = normalizeComposition(value);
  const region = next.regions.find(item => item.id === regionId);
  if (!region) throw new Error('找不到需要编辑的区域。');
  region.items = reordered(region.items, instanceId, offset);
  return next;
}

export function moveCompositionItemToRegion(value, fromId, toId, instanceId) {
  const next = normalizeComposition(value);
  const from = next.regions.find(region => region.id === fromId);
  const to = next.regions.find(region => region.id === toId);
  if (!from || !to) throw new Error('找不到需要移动的区域。');
  const item = from.items.find(entry => entry.id === instanceId);
  if (!item) throw new Error('找不到需要移动的实例。');
  if (from !== to) {
    from.items = from.items.filter(entry => entry.id !== instanceId);
    to.items.push(item);
  }
  return assertComposition(next);
}
