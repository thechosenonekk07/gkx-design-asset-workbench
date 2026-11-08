import { applyProjectTheme, validateProjectTheme } from './projectTheme.js';
import { assertComposition, deriveCompositionReferences } from './composition.js';
import { assertBlueprint, resolvePageTemplate, validatePageOverrides } from './templateBlueprint.js';
import { createTemplatePresets } from './templatePresets.js';
import { planTemplateMerge } from './templateMerge.js';
import { validateBlueprintDependencies } from './blueprintDependencies.js';
import { CHECK_DIMENSIONS, buildProjectCheckPlan, getProjectAcceptance } from './projectAcceptance.js';
/** Shared design assets. Browser persistence belongs to the application, not this model. */
export const SCHEMA_VERSION = 1;
export const ASSET_LAYERS = ['tokens', 'components', 'patterns', 'templates', 'projects'];
export const TOKEN_TYPES = ['color', 'number', 'string', 'boolean', 'duration', 'cubicBezier', 'shadow'];
export const MAX_PROJECT_DELIVERIES = 50;
const MAX_ASSET_PACKAGE_LENGTH = 8 * 1024 * 1024;
export const DEFAULT_BINDINGS = Object.freeze({
  primary: 'color.action', onPrimary: 'color.onAction', surface: 'color.surface',
  primaryHover: 'color.actionHover', primaryPressed: 'color.actionPressed',
  text: 'color.text', muted: 'color.muted', border: 'color.border', radius: 'radius.md',
  height: 'size.control', fontSize: 'font.size.md', gap: 'space.md', focus: 'color.focus',
  duration: 'motion.duration', easing: 'motion.easing', danger: 'color.danger', shadow: 'shadow.md',
  fontFamily: 'font.family', fontWeight: 'font.weight.regular', lineHeight: 'font.lineHeight.normal',
  borderWidth: 'border.width', focusWidth: 'border.focusWidth', focusOffset: 'border.focusOffset',
  disabledOpacity: 'opacity.disabled',
});
export const LENGTH_BINDING_KEYS = Object.freeze(['radius', 'height', 'fontSize', 'gap', 'borderWidth', 'focusWidth', 'focusOffset']);
export const UNITLESS_BINDING_KEYS = Object.freeze(['fontWeight', 'lineHeight', 'disabledOpacity']);

const SHARED = ASSET_LAYERS.slice(0, 4);
const LAYER_NAMES = { tokens: '基础变量', components: '组件', patterns: '交互模式', templates: '页面模板', projects: '项目' };
const TYPE_BINDINGS = { primary: 'color', primaryHover: 'color', primaryPressed: 'color', onPrimary: 'color', surface: 'color', text: 'color', muted: 'color', border: 'color', success: 'color', warning: 'color', focus: 'color', danger: 'color', radius: 'number', height: 'number', fontSize: 'number', gap: 'number', duration: 'duration', easing: 'cubicBezier', shadow: 'shadow', fontFamily: 'string', fontWeight: 'number', lineHeight: 'number', borderWidth: 'number', focusWidth: 'number', focusOffset: 'number', disabledOpacity: 'number' };
const LENGTH_UNITS = ['px', 'rem', 'em', '%', 'vh', 'vw', 'vmin', 'vmax'];
const clone = (value) => {
  // JSON serialization converts NaN/Infinity to null; reject invalid inputs first.
  safeTree(value);
  return JSON.parse(JSON.stringify(value));
};
const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const reference = (doc, layer, id) => doc[layer]?.find((entry) => entry.id === id);
const cssKey = (value) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function basicTokens() {
  const tokens = [];
  const add = (id, name, type, group, value, extras = {}) => tokens.push({ id, name, type, group, value, description: name, custom: false, ...extras });
  const palettes = {
    blue: ['#EFF6FF', '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A'],
    gray: ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1', '#94A3B8', '#64748B', '#475569', '#334155', '#1E293B', '#0F172A'],
    green: ['#F0FDF4', '#DCFCE7', '#BBF7D0', '#86EFAC', '#4ADE80', '#22C55E', '#16A34A', '#15803D', '#166534', '#14532D'],
    amber: ['#FFFBEB', '#FEF3C7', '#FDE68A', '#FCD34D', '#FBBF24', '#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F'],
    red: ['#FEF2F2', '#FEE2E2', '#FECACA', '#FCA5A5', '#F87171', '#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D'],
    violet: ['#F5F3FF', '#EDE9FE', '#DDD6FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95'],
  };
  const paletteNames = { blue: '蓝', gray: '中性', green: '绿', amber: '琥珀', red: '红', violet: '紫' };
  Object.entries(palettes).forEach(([color, values]) => values.forEach((value, index) => {
    const step = index === 0 ? 50 : index * 100;
    add(`palette.${color}.${step}`, `${paletteNames[color]}色 ${step}`, 'color', '基础色阶', value, { description: '原始色值；语义颜色通过别名引用，不直接表达业务用途。' });
  }));
  add('palette.white', '纯白', 'color', '基础色阶', '#FFFFFF');
  add('palette.black', '纯黑', 'color', '基础色阶', '#000000');
  const semantics = [
    ['action', '主要操作', 'palette.blue.600', '#60A5FA'],
    ['actionHover', '操作悬停', 'palette.blue.700', '#93C5FD'],
    ['actionPressed', '操作按下', 'palette.blue.800', '#3B82F6'],
    ['onAction', '主要操作文字', 'palette.white', '#0F172A'],
    ['surface', '控件表面', 'palette.white', '#1E293B'],
    ['canvas', '页面背景', 'palette.gray.50', '#0F172A'],
    ['subtle', '弱化表面', 'palette.gray.100', '#334155'],
    ['text', '主要文字', 'palette.gray.900', '#F8FAFC'],
    ['muted', '辅助文字', 'palette.gray.600', '#CBD5E1'],
    ['border', '默认边框', 'palette.gray.300', '#64748B'],
    ['focus', '键盘焦点', 'palette.blue.600', '#93C5FD'],
    ['danger', '危险操作', 'palette.red.700', '#FCA5A5'],
    ['success', '成功反馈', 'palette.green.700', '#86EFAC'],
    ['warning', '警告反馈', 'palette.amber.700', '#FCD34D'],
    ['info', '信息反馈', 'palette.blue.700', '#93C5FD'],
    ['selection', '选中背景', 'palette.blue.50', '#1E3A8A'],
    ['disabled', '禁用文字', 'palette.gray.500', '#94A3B8'],
  ];
  semantics.forEach(([id, name, alias, darkValue]) => add(`color.${id}`, name, 'color', '语义颜色', tokens.find((t) => t.id === alias).value, { alias, darkValue, description: `${name}的语义角色，浅色引用基础色阶，深色有独立配对值。` }));
  add('font.family', '界面字体', 'string', '文字', 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif');
  add('font.mono', '代码字体', 'string', '文字', 'ui-monospace, SFMono-Regular, Menlo, monospace');
  [['xs', 12], ['sm', 13], ['md', 14], ['lg', 16], ['xl', 20], ['2xl', 24], ['3xl', 32]].forEach(([size, value]) => add(`font.size.${size}`, `字号 ${size}`, 'number', '文字', value, { unit: 'px', min: 8, max: 96 }));
  [['regular', 400], ['medium', 500], ['semibold', 600], ['bold', 700]].forEach(([weight, value]) => add(`font.weight.${weight}`, `字重 ${weight}`, 'number', '文字', value, { min: 100, max: 900 }));
  [['tight', 1.25], ['normal', 1.5], ['relaxed', 1.75]].forEach(([name, value]) => add(`font.lineHeight.${name}`, `行高 ${name}`, 'number', '文字', value, { min: 1, max: 3 }));
  add('font.letterSpacing', '字符间距', 'number', '文字', 0, { unit: 'px' });
  [['none', 0], ['2xs', 2], ['xs', 4], ['sm', 8], ['md', 12], ['lg', 16], ['xl', 24], ['2xl', 32], ['3xl', 48], ['4xl', 64]].forEach(([name, value]) => add(`space.${name}`, `间距 ${name}`, 'number', '间距', value, { unit: 'px', min: 0, max: 256 }));
  [['compact', 28], ['control', 36], ['comfortable', 44], ['icon', 16], ['iconLarge', 20], ['touchTarget', 44], ['content', 1120], ['sidebar', 240]].forEach(([name, value]) => add(`size.${name}`, `尺寸 ${name}`, 'number', '尺寸', value, { unit: 'px', min: 1 }));
  [['none', 0], ['sm', 4], ['md', 8], ['lg', 12], ['xl', 16], ['full', 9999]].forEach(([name, value]) => add(`radius.${name}`, `圆角 ${name}`, 'number', '圆角与边框', value, { unit: 'px', min: 0 }));
  add('border.width', '默认边框宽度', 'number', '圆角与边框', 1, { unit: 'px', min: 0, max: 8 });
  add('border.focusWidth', '焦点描边宽度', 'number', '圆角与边框', 2, { unit: 'px', min: 1, max: 8 });
  add('border.focusOffset', '焦点描边偏移', 'number', '圆角与边框', 2, { unit: 'px', min: 0, max: 8 });
  add('shadow.sm', '低层浮起阴影', 'shadow', '阴影', '0 1px 3px rgba(15, 23, 42, 0.08)');
  add('shadow.md', '浮层阴影', 'shadow', '阴影', '0 8px 24px rgba(15, 23, 42, 0.12)', { darkValue: '0 8px 24px rgba(0, 0, 0, 0.32)' });
  add('shadow.lg', '对话框阴影', 'shadow', '阴影', '0 20px 48px rgba(15, 23, 42, 0.18)');
  add('opacity.disabled', '禁用不透明度', 'number', '透明度', 0.45, { min: 0, max: 1 });
  add('opacity.backdrop', '遮罩不透明度', 'number', '透明度', 0.35, { min: 0, max: 1 });
  [['instant', 0], ['fast', 120], ['duration', 180], ['slow', 280]].forEach(([name, value]) => add(`motion.${name}`, `动效时长 ${name}`, 'duration', '动效', value, { unit: 'ms', min: 0, max: 5000 }));
  add('motion.easing', '标准缓动', 'cubicBezier', '动效', 'cubic-bezier(0.2, 0, 0, 1)');
  add('motion.enter', '进入缓动', 'cubicBezier', '动效', 'cubic-bezier(0, 0, 0, 1)');
  add('motion.exit', '退出缓动', 'cubicBezier', '动效', 'cubic-bezier(0.3, 0, 1, 1)');
  [['base', 0], ['sticky', 10], ['popover', 100], ['modal', 1000], ['toast', 1100]].forEach(([name, value]) => add(`layer.${name}`, `层级 ${name}`, 'number', '层级', value, { min: 0 }));
  [['sm', 640], ['md', 768], ['lg', 1024], ['xl', 1280]].forEach(([name, value]) => add(`breakpoint.${name}`, `断点 ${name}`, 'number', '断点', value, { unit: 'px', min: 0 }));
  [['submit', '提交'], ['cancel', '取消'], ['search', '搜索'], ['empty', '暂无内容'], ['required', '请填写此字段']].forEach(([name, value]) => add(`content.${name}`, `通用文案 ${name}`, 'string', '内容', value));
  add('behavior.reducedMotion', '减少动态效果', 'boolean', '行为', false, { description: '由资产使用方结合操作系统减少动态效果偏好处理。' });
  add('behavior.showRequired', '显示必填提示', 'boolean', '行为', true);
  return tokens;
}

export function createInitialDoc(componentCatalog = []) {
  assert(Array.isArray(componentCatalog), '组件清单必须是数组。');
  const components = componentCatalog.map((component) => ({ ...clone(component), id: `c-${component.kind}`, custom: false, config: clone(component.config || {}), bindings: { ...DEFAULT_BINDINGS, ...(component.bindings || {}) } }));
  const ids = new Set(components.map((component) => component.id));
  const pick = (...kinds) => kinds.map((kind) => `c-${kind}`).filter((id) => ids.has(id));
  const patterns = [
    { id: 'p-search-filter', name: '搜索与筛选', description: '输入条件，执行检索，查看结果并能清空条件返回完整列表。', componentIds: pick('search-field', 'select', 'button', 'table'), steps: ['填写关键词与筛选条件', '提交搜索并展示结果', '清空条件并恢复列表'] },
    { id: 'p-form-submit', name: '表单提交', description: '带字段说明、必填验证与明确结果反馈的单页提交。', componentIds: pick('text-field', 'select', 'checkbox', 'button'), steps: ['填写必填信息', '定位并修复字段错误', '提交后显示结果并保留输入'] },
    { id: 'p-confirm-action', name: '操作确认', description: '执行有影响的操作之前说明对象、后果和可恢复路径。', componentIds: pick('button', 'alert-dialog'), steps: ['发起操作', '核对对象及后果', '确认执行或取消并返回来源'] },
    { id: 'p-settings', name: '设置与切换', description: '分组修改偏好，通过明确的保存动作提交变化。', componentIds: pick('tabs', 'switch', 'radio-group', 'button'), steps: ['定位设置分组', '修改选项并查看当前状态', '保存变更或恢复原值'] },
    { id: 'p-selection', name: '列表选择与批量操作', description: '选择多个对象，持续显示选择数量，并支持取消选择。', componentIds: pick('table', 'checkbox', 'button', 'menu'), steps: ['选择列表对象', '查看选择数量与可用操作', '执行批量操作或取消选择'] },
    { id: 'p-multistep', name: '分步填写', description: '将复杂输入拆成可返回、保留内容和最终确认的多个步骤。', componentIds: pick('text-field', 'radio-group', 'progress-bar', 'button'), steps: ['填写第一组信息', '验证后进入下一步', '返回修改并保留输入', '核对汇总后完成'] },
  ].map((pattern) => ({ ...pattern, custom: false }));
  const templates = [
    { id: 't-resource-list', name: '资源列表', description: '检索、筛选、列表选择与操作确认组成通用资源管理页面。', layout: 'list', patternIds: ['p-search-filter', 'p-selection', 'p-confirm-action'], componentIds: pick('breadcrumbs', 'table') },
    { id: 't-create-form', name: '创建表单', description: '围绕一个提交目标组织字段、说明、校验与取消路径。', layout: 'form', patternIds: ['p-form-submit'], componentIds: pick('breadcrumbs', 'text-field') },
    { id: 't-settings', name: '偏好设置', description: '按主题组织可保存、可恢复的通用设置。', layout: 'settings', patternIds: ['p-settings'], componentIds: pick('tabs', 'switch') },
    { id: 't-detail', name: '资源详情', description: '展示对象信息，提供相关操作、编辑与危险操作确认。', layout: 'detail', patternIds: ['p-confirm-action'], componentIds: pick('breadcrumbs', 'tabs', 'disclosure') },
    { id: 't-overview', name: '状态概览', description: '把真实状态摘要与可检索资源相连，不预置虚构业务指标。', layout: 'dashboard', patternIds: ['p-search-filter'], componentIds: pick('progress-bar', 'meter', 'table') },
    { id: 't-onboarding', name: '分步配置', description: '引导填写、回退修改、核对后提交的通用配置模板。', layout: 'wizard', patternIds: ['p-multistep', 'p-form-submit'], componentIds: pick('progress-bar') },
  ].map((template) => ({ ...template, custom: false }));
  const doc = { schemaVersion: SCHEMA_VERSION, revision: 1, tokens: basicTokens(), components, patterns, templates, projects: [], history: [] };
  validateDoc(doc);
  return doc;
}

export function resolveToken(doc, id, theme = 'light', visited = new Set()) {
  const token = reference(doc, 'tokens', id);
  assert(token, `找不到变量「${id}」。`);
  assert(!visited.has(id), `变量别名循环：${[...visited, id].join(' → ')}。`);
  visited.add(id);
  if (theme === 'dark' && token.darkValue !== undefined && token.darkValue !== null) return token.darkValue;
  return token.alias ? resolveToken(doc, token.alias, theme, visited) : token.value;
}

export function tokenCSS(doc, bindings = {}, theme = 'light') {
  const effective = { ...DEFAULT_BINDINGS, ...bindings };
  return Object.fromEntries(Object.entries(effective).map(([binding, id]) => {
    const token = reference(doc, 'tokens', id);
    assert(token, `绑定「${binding}」找不到变量「${id}」。`);
    const value = resolveToken(doc, id, theme);
    return [`--asset-${cssKey(binding)}`, typeof value === 'number' ? `${value}${token.unit || ''}` : String(value)];
  }));
}

function directReferences(doc, layer, asset) {
  if (layer === 'tokens') return asset.alias ? [{ layer: 'tokens', id: asset.alias }] : [];
  // These are the same bindings the renderer resolves, including defaults.
  if (layer === 'components') return Object.values({ ...DEFAULT_BINDINGS, ...(asset.bindings || {}) }).map((id) => ({ layer: 'tokens', id }));
  if (layer === 'patterns') return (asset.componentIds || []).map((id) => ({ layer: 'components', id }));
  if (layer === 'templates') return [...(asset.patternIds || []).map((id) => ({ layer: 'patterns', id })), ...(asset.componentIds || []).map((id) => ({ layer: 'components', id }))];
  if (layer === 'projects') return (asset.pages || []).map((page) => ({ layer: 'templates', id: page.templateId }));
  return [];
}

function closure(doc, starting) {
  const seen = new Set();
  const queue = [...starting];
  while (queue.length) {
    const entry = queue.shift();
    const key = `${entry.layer}:${entry.id}`;
    if (seen.has(key)) continue;
    const asset = reference(doc, entry.layer, entry.id);
    if (!asset) continue;
    seen.add(key);
    queue.push(...directReferences(doc, entry.layer, asset));
  }
  return seen;
}

export function getUsage(doc, layer, id) {
  assert(ASSET_LAYERS.includes(layer), '未知资产层级。');
  const result = [];
  const found = new Set([`${layer}:${id}`]);
  let frontier = [{ layer, id }];
  let depth = 0;
  while (frontier.length) {
    depth += 1;
    const keys = new Set(frontier.map((entry) => `${entry.layer}:${entry.id}`));
    const next = [];
    SHARED.forEach((candidateLayer) => (doc[candidateLayer] || []).forEach((asset) => {
      const key = `${candidateLayer}:${asset.id}`;
      if (found.has(key) || !directReferences(doc, candidateLayer, asset).some((entry) => keys.has(`${entry.layer}:${entry.id}`))) return;
      found.add(key);
      const item = { id: asset.id, layer: candidateLayer, name: asset.name, direct: depth === 1, depth, locked: false };
      result.push(item);
      next.push(item);
    }));
    frontier = next;
  }
  (doc.projects || []).forEach((project) => {
    const used = closure(project.snapshot, directReferences(doc, 'projects', project));
    if (used.has(`${layer}:${id}`)) result.push({ id: project.id, layer: 'projects', name: project.name, direct: layer === 'templates', depth: layer === 'templates' ? 1 : 2, locked: true });
  });
  return result;
}

function checkValue(token, value, label) {
  if (token.type === 'color') assert(typeof value === 'string' && /^(#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|(?:rgb|rgba|hsl|hsla|oklch|oklab)\([\d\s.,%/+\-a-z]+\)|transparent|currentColor)$/i.test(value.trim()), `${label}必须是有效颜色值。`);
  if (token.type === 'number' || token.type === 'duration') {
    assert(typeof value === 'number' && Number.isFinite(value), `${label}必须是有限数字。`);
    if (token.type === 'duration') assert(value >= 0, `${label}时长不能小于 0。`);
    if (Number.isFinite(token.min)) assert(value >= token.min, `${label}不能小于 ${token.min}。`);
    if (Number.isFinite(token.max)) assert(value <= token.max, `${label}不能大于 ${token.max}。`);
  }
  if (token.type === 'boolean') assert(typeof value === 'boolean', `${label}必须是布尔值 true 或 false。`);
  if (token.type === 'string') assert(typeof value === 'string', `${label}必须是字符串。`);
  if (token.type === 'shadow') assert(typeof value === 'string' && (value === 'none' || /^(?:inset\s+)?(?:0|-?[\d.]+(?:px|rem|em))\s/.test(value)) && !/[;{}]|url\(/i.test(value), `${label}必须是有效的 CSS 阴影值。`);
  if (token.type === 'cubicBezier') {
    const matched = typeof value === 'string' && value.match(/^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/);
    const standard = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'].includes(value);
    assert(standard || (matched && matched.slice(1).every((number) => Number.isFinite(Number(number))) && Number(matched[1]) >= 0 && Number(matched[1]) <= 1 && Number(matched[3]) >= 0 && Number(matched[3]) <= 1), `${label}必须是标准缓动或有效 cubic-bezier；横坐标应在 0 到 1 之间。`);
  }
}

function validateComponentConfig(component) {
  const config = component.config;
  const label = `组件「${component.name}」`;
  const bounded = ['slider', 'range-slider', 'number-field'].includes(component.kind);
  const progress = ['progress-bar', 'meter'].includes(component.kind);
  if (!bounded && !progress) return;
  const finite = (value, field) => assert(typeof value === 'number' && Number.isFinite(value), `${label}的${field}必须是有限数字。`);
  const min = bounded ? config.min ?? 0 : 0;
  const max = bounded ? config.max ?? 100 : 100;
  finite(min, '最小值');
  finite(max, '最大值');
  assert(min <= max, `${label}的最小值不能大于最大值。`);
  if (component.kind === 'slider' || component.kind === 'range-slider') assert(min < max, `${label}的最大值必须大于最小值。`);
  if (bounded) {
    const step = config.step ?? 1;
    finite(step, '步长');
    assert(step > 0, `${label}的步长必须大于 0。`);
  }
  if (config.value === undefined) return;
  const inBounds = (value) => {
    finite(value, '默认值');
    assert(value >= min && value <= max, `${label}的默认值必须在 ${min} 到 ${max} 之间。`);
  };
  if (component.kind === 'range-slider') {
    assert(Array.isArray(config.value) && config.value.length === 2, `${label}的默认范围必须恰好包含两个数字。`);
    config.value.forEach(inBounds);
    assert(config.value[0] <= config.value[1], `${label}的范围起始值不能大于结束值。`);
  } else inBounds(config.value);
}

function validateShared(doc) {
  SHARED.forEach((layer) => validateList(doc[layer], layer));
  doc.tokens.forEach((token) => {
    assert(TOKEN_TYPES.includes(token.type), `变量「${token.name}」类型不支持。`);
    assert(nonempty(token.group), `变量「${token.name}」缺少分类。`);
    if (token.type === 'duration') assert(['ms', 's'].includes(token.unit), `变量「${token.name}」的时长单位只能为 ms 或 s。`);
    else if (token.type === 'number') assert(token.unit === undefined || ['', 'px', 'rem', 'em', '%', 'vh', 'vw', 'vmin', 'vmax', 'deg', 'fr'].includes(token.unit), `变量「${token.name}」的数字单位不支持。`);
    else assert(token.unit === undefined || token.unit === '', `变量「${token.name}」的类型不支持单位。`);
    checkValue(token, token.value, `变量「${token.name}」`);
    if (token.darkValue !== undefined && token.darkValue !== null) checkValue(token, token.darkValue, `变量「${token.name}」深色值`);
    if (token.alias) {
      const target = reference(doc, 'tokens', token.alias);
      assert(target, `变量「${token.name}」引用了不存在的变量「${token.alias}」。`);
      assert(target.type === token.type, `变量「${token.name}」与别名目标「${target.name}」类型不一致。`);
      assert((target.unit || '') === (token.unit || ''), `变量「${token.name}」与别名目标「${target.name}」单位不一致。`);
    }
    resolveToken(doc, token.id, 'light');
    resolveToken(doc, token.id, 'dark');
  });
  doc.components.forEach((component) => {
    assert(nonempty(component.kind), `组件「${component.name}」缺少实现类型 kind。`);
    assert(object(component.config), `组件「${component.name}」配置必须是对象。`);
    validateComponentConfig(component);
    assert(object(component.bindings), `组件「${component.name}」变量绑定必须是对象。`);
    Object.keys(DEFAULT_BINDINGS).forEach((key) => assert(nonempty(component.bindings[key]), `组件「${component.name}」缺少「${key}」变量绑定，请通过资产导入补全默认绑定。`));
    Object.entries(component.bindings).forEach(([key, id]) => {
      assert(/^[a-zA-Z][a-zA-Z0-9]*$/.test(key), `组件「${component.name}」绑定名无效。`);
      const token = reference(doc, 'tokens', id);
      assert(token, `组件「${component.name}」绑定了不存在的变量「${id}」。`);
      if (TYPE_BINDINGS[key]) assert(token.type === TYPE_BINDINGS[key], `组件「${component.name}」的「${key}」需要 ${TYPE_BINDINGS[key]} 类型变量。`);
      if (LENGTH_BINDING_KEYS.includes(key)) assert(LENGTH_UNITS.includes(token.unit), `组件「${component.name}」的「${key}」需要带长度单位的变量，不能绑定字重、透明度或层级。`);
      if (UNITLESS_BINDING_KEYS.includes(key)) assert(!token.unit, `组件「${component.name}」的「${key}」需要无单位的数字变量。`);
      if (['disabledOpacity', 'fontWeight', 'lineHeight'].includes(key)) ['light', 'dark'].forEach((theme) => {
        const value = resolveToken(doc, id, theme);
        if (key === 'disabledOpacity') assert(value >= 0 && value <= 1, `组件「${component.name}」禁用透明度必须在 0 到 1 之间。`);
        if (key === 'fontWeight') assert(Number.isInteger(value) && value >= 1 && value <= 1000, `组件「${component.name}」字重必须是 1 到 1000 之间的整数。`);
        if (key === 'lineHeight') assert(value > 0, `组件「${component.name}」行高倍数必须大于 0。`);
      });
    });
  });
  doc.patterns.forEach((pattern) => {
    assert(Array.isArray(pattern.componentIds), `模式「${pattern.name}」组件引用必须是数组。`);
    assert(Array.isArray(pattern.steps) && pattern.steps.every(nonempty), `模式「${pattern.name}」步骤必须是非空字符串数组。`);
    validateReferences(doc, 'patterns', pattern);
  });
  doc.templates.forEach((template) => {
    assert(nonempty(template.layout), `模板「${template.name}」缺少布局类型。`);
    assert(Array.isArray(template.patternIds) && Array.isArray(template.componentIds), `模板「${template.name}」引用必须是数组。`);
    validateReferences(doc, 'templates', template);
    if (template.blueprint !== undefined) assertBlueprint(template.blueprint);
    const dependencyErrors = validateBlueprintDependencies(template, doc);
    assert(!dependencyErrors.length, `模板「${template.name}」缺少必要的组件依赖：${dependencyErrors.join('；')}`);
    if (template.flowEnabled !== undefined) assert(typeof template.flowEnabled === 'boolean', `模板「${template.name}」的流程预览开关必须为布尔值。`);
    if (template.composition) {
      assertComposition(template.composition, doc);
      const refs = deriveCompositionReferences(template.composition);
      ['componentIds', 'patternIds'].forEach(key => {
        // Executable page configurations and supplementary regions coexist. Their
        // declared dependencies include both the behavior and region instances.
        const consistent = template.blueprint || template.flowEnabled !== undefined
          ? refs[key].every(id => template[key].includes(id))
          : JSON.stringify([...new Set(template[key])].sort()) === JSON.stringify([...refs[key]].sort());
        assert(consistent, `模板「${template.name}」的区域与引用清单不一致，请通过组合编辑保存。`);
      });
    }
  });
}

function validateReferences(doc, layer, asset) {
  directReferences(doc, layer, asset).forEach(({ layer: targetLayer, id }) => assert(reference(doc, targetLayer, id), `「${asset.name}」引用的${LAYER_NAMES[targetLayer]}「${id}」不存在。`));
}

function validateList(list, layer) {
  assert(Array.isArray(list) && list.length <= 10000, `${LAYER_NAMES[layer]}必须是数组，最多 10000 项。`);
  const ids = new Set();
  const names = new Set();
  list.forEach((asset) => {
    assert(object(asset), `${LAYER_NAMES[layer]}内容必须是对象。`);
    assert(typeof asset.id === 'string' && /^[a-zA-Z][a-zA-Z0-9._-]*$/.test(asset.id), `${LAYER_NAMES[layer]} ID 无效。`);
    assert(!ids.has(asset.id), `${LAYER_NAMES[layer]} ID「${asset.id}」重复。`);
    ids.add(asset.id);
    assert(nonempty(asset.name), `${LAYER_NAMES[layer]}名称不能为空。`);
    const normalized = asset.name.trim().toLocaleLowerCase();
    assert(!names.has(normalized), `${LAYER_NAMES[layer]}名称「${asset.name}」重复。`);
    names.add(normalized);
  });
}

function safeTree(value, path = '资产包', seen = new Set()) {
  if (typeof value === 'number') assert(Number.isFinite(value), `${path}包含非法数字。`);
  if (value === null || typeof value !== 'object') return;
  assert(!seen.has(value), `${path}不能包含循环结构。`);
  seen.add(value);
  Object.entries(value).forEach(([key, child]) => {
    assert(!['__proto__', 'prototype', 'constructor'].includes(key), `${path}包含禁止的字段「${key}」。`);
    safeTree(child, `${path}.${key}`, seen);
  });
  seen.delete(value);
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function validateProjectOrigin(project) {
  if (project.derivedFrom === undefined) return;
  const origin = project.derivedFrom;
  const validId = value => typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9._-]*$/.test(value);
  assert(object(origin) && origin.kind === 'delivery', '项目复用来源必须是一份交付归档。');
  assert(Object.keys(origin).every(key => ['kind', 'projectId', 'projectName', 'deliveryId', 'deliveryTitle', 'deliveryCreatedAt', 'baselineRevision', 'designRevision', 'createdAt', 'pages'].includes(key)), '项目复用来源包含不支持的字段。');
  assert(validId(origin.projectId) && origin.projectId !== project.id && validId(origin.deliveryId), '项目复用来源 ID 无效，不能将当前项目作为自身来源。');
  assert(nonempty(origin.projectName) && nonempty(origin.deliveryTitle), '项目复用来源缺少项目或归档名称。');
  assert(validTimestamp(origin.deliveryCreatedAt) && validTimestamp(origin.createdAt), '项目复用来源时间无效。');
  assert(Number.isInteger(origin.baselineRevision) && origin.baselineRevision >= 1 && origin.baselineRevision <= project.snapshot.revision, '项目复用来源的基线版本无效。');
  assert(Number.isInteger(origin.designRevision) && origin.designRevision >= 1, '项目复用来源的设计修订无效。');
  assert(Array.isArray(origin.pages) && origin.pages.length > 0 && origin.pages.length <= 10000, '项目复用来源必须记录至少一个采用页面。');
  const sourceIds = new Set(), pageIds = new Set();
  origin.pages.forEach(page => {
    assert(object(page) && Object.keys(page).every(key => ['sourcePageId', 'pageId', 'sourceName'].includes(key)), '项目复用页面来源格式无效。');
    // Legacy project page IDs are free-form. Keep their identity rather than rewriting provenance.
    assert(nonempty(page.sourcePageId) && validId(page.pageId) && nonempty(page.sourceName), '项目复用页面来源缺少有效 ID 或名称。');
    assert(page.sourcePageId !== page.pageId && !sourceIds.has(page.sourcePageId) && !pageIds.has(page.pageId), '项目复用页面来源 ID 重复或未建立新的页面身份。');
    sourceIds.add(page.sourcePageId); pageIds.add(page.pageId);
  });
  // The source project or a copied page may later be removed. Provenance remains a historical record.
}

function validateProjectDeliveries(project) {
  if (project.deliveries === undefined) return;
  assert(Array.isArray(project.deliveries) && project.deliveries.length <= MAX_PROJECT_DELIVERIES, `每个项目最多保留 ${MAX_PROJECT_DELIVERIES} 份交付归档；请先导出完整资产库备份，再缩小归档范围。`);
  const ids = new Set();
  project.deliveries.forEach(record => {
    assert(object(record) && typeof record.id === 'string' && /^[a-zA-Z][a-zA-Z0-9._-]*$/.test(record.id) && !ids.has(record.id), '交付归档 ID 无效或重复。');
    ids.add(record.id);
    assert(Object.keys(record).every(key => ['id', 'title', 'note', 'createdAt', 'package'].includes(key)), '交付归档包含不支持的字段。');
    assert(nonempty(record.title) && record.title.length <= 120, '交付归档名称不能为空，最多 120 个字符。');
    assert(typeof record.note === 'string' && record.note.length <= 2000, '交付归档说明必须是文字，最多 2000 个字符。');
    assert(validTimestamp(record.createdAt), '交付归档创建时间无效。');
    const payload = record.package;
    assert(object(payload) && payload.format === 'gkx-design-delivery' && payload.schemaVersion === 2, '交付归档的包格式或版本无效。');
    assert(Object.keys(payload).every(key => ['format', 'schemaVersion', 'exportedAt', 'mode', 'project', 'acceptance', 'scope'].includes(key)), '交付归档包包含不支持的字段。');
    assert(['draft', 'reviewed'].includes(payload.mode), '交付归档模式无效。');
    assert(validTimestamp(payload.exportedAt) && payload.exportedAt === record.createdAt, '交付归档包时间必须与创建时间一致。');
    const archived = payload.project;
    assert(object(archived) && archived.id === project.id, '交付归档必须属于当前项目。');
    assert(!Object.prototype.hasOwnProperty.call(archived, 'deliveries'), '交付归档不能嵌套其他交付归档。');
    assert(object(archived.snapshot) && archived.snapshot.revision <= project.snapshot.revision && (archived.designRevision ?? 1) <= (project.designRevision ?? 1), '交付归档的基线或设计修订不能晚于当前项目。');
    // Reuse complete project validation against the archived baseline, never today's shared assets.
    validateDoc({ ...archived.snapshot, schemaVersion: SCHEMA_VERSION, projects: [archived], history: [] });
    archived.checks.forEach(check => {
      [check, ...(check.history || [])].forEach(entry => {
        ['description', 'evidence'].forEach(key => assert(entry[key] === undefined || typeof entry[key] === 'string', '交付归档的检查说明和证据必须为文字。'));
        assert(entry.updatedAt === undefined || validTimestamp(entry.updatedAt), '交付归档的检查时间无效。');
      });
    });
    assert(object(payload.scope) && payload.scope.method === 'manual-evidence' && nonempty(payload.scope.note), '交付归档缺少人工验收范围说明。');
    const acceptance = getProjectAcceptance(archived);
    assert(JSON.stringify(stableReviewValue(payload.acceptance)) === JSON.stringify(stableReviewValue(acceptance)), '交付归档的验收摘要与实际检查证据不一致。');
    if (payload.mode === 'reviewed') assert(acceptance.ready, '人工验收交付归档必须完成当时版本的全部检查，不能将未通过的草稿标记为已验收。');
  });
}

export function validateDoc(doc) {
  assert(object(doc), '资产包必须是一个 JSON 对象。');
  safeTree(doc);
  assert(doc.schemaVersion === SCHEMA_VERSION, `不支持资产包版本 ${doc.schemaVersion ?? '未声明'}。`);
  assert(Number.isInteger(doc.revision) && doc.revision >= 1, '共享库版本必须是正整数。');
  validateShared(doc);
  validateList(doc.projects, 'projects');
  assert(Array.isArray(doc.history), '变更记录必须是数组。');
  doc.projects.forEach((project) => {
    assert(object(project.snapshot) && Number.isInteger(project.snapshot.revision) && project.snapshot.revision >= 1 && project.snapshot.revision <= doc.revision, `项目「${project.name}」缺少有效的基线快照。`);
    validateShared(project.snapshot);
    assert(Number.isInteger(project.designRevision ?? 1) && (project.designRevision ?? 1) >= 1, `项目「${project.name}」设计修订无效。`);
    validateProjectOrigin(project);
    validateProjectTheme(project);
    validateShared(applyProjectTheme(project));
    assert(Array.isArray(project.pages), `项目「${project.name}」页面必须是数组。`);
    const pageIds = new Set();
    project.pages.forEach((page) => {
      assert(object(page) && nonempty(page.id) && nonempty(page.name), `项目「${project.name}」页面缺少 ID 或名称。`);
      assert(!pageIds.has(page.id), `项目「${project.name}」页面 ID 重复。`);
      pageIds.add(page.id);
      const template = reference(project.snapshot, 'templates', page.templateId);
      assert(template, `项目「${project.name}」页面「${page.name}」的模板不在其基线快照中。`);
      const overrideErrors = validatePageOverrides(page, template, project.snapshot);
      assert(!overrideErrors.length, `项目「${project.name}」页面「${page.name}」配置无效：${overrideErrors.join('；')}`);
      const dependencyErrors = validateBlueprintDependencies(resolvePageTemplate(template, page), project.snapshot);
      assert(!dependencyErrors.length, `项目「${project.name}」页面「${page.name}」缺少必要的组件依赖：${dependencyErrors.join('；')}`);
    });
    assert(Array.isArray(project.checks), `项目「${project.name}」验收记录必须是数组。`);
    const checkIds = new Set();
    project.checks.forEach((check) => {
      assert(object(check) && nonempty(check.id) && nonempty(check.name), `项目「${project.name}」检查项缺少 ID 或名称。`);
      assert(!checkIds.has(check.id), `项目「${project.name}」检查项 ID 重复。`);
      checkIds.add(check.id);
      assert(['passed', 'failed', 'pending', 'stale'].includes(check.status), `检查「${check.name}」状态无效。`);
      assert(Number.isInteger(check.baselineRevision) && check.baselineRevision >= 1 && check.baselineRevision <= project.snapshot.revision, `检查「${check.name}」基线版本无效。`);
      assert(Number.isInteger(check.designRevision ?? 1) && (check.designRevision ?? 1) >= 1 && (check.designRevision ?? 1) <= (project.designRevision ?? 1), `检查「${check.name}」设计修订无效。`);
      if (check.status !== 'stale') assert((check.designRevision ?? 1) === (project.designRevision ?? 1), `检查「${check.name}」不属于当前项目设计修订，必须重新检查。`);
      if (check.status !== 'stale') assert(check.baselineRevision === project.snapshot.revision, `检查「${check.name}」不属于当前基线，必须标记为待复验。`);
      if (check.pageId) assert(pageIds.has(check.pageId), `检查「${check.name}」引用了不存在的项目页面。`);
      if (check.status === 'passed' || check.status === 'failed') assert(nonempty(check.evidence), `检查「${check.name}」需要填写验收依据，不能无依据标记结果。`);
      if (check.dimension !== undefined) assert(CHECK_DIMENSIONS.some(dimension => dimension.id === check.dimension), `检查「${check.name}」验收维度无效。`);
      if (check.criterionKey !== undefined) assert(nonempty(check.criterionKey), `检查「${check.name}」验收标准标识无效。`);
      if (check.customCriterion !== undefined) assert(typeof check.customCriterion === 'boolean', `检查「${check.name}」自定义标准标记必须为布尔值。`);
      if (check.history !== undefined) {
        assert(Array.isArray(check.history) && check.history.length <= 20, `检查「${check.name}」最多保留 20 次历史记录。`);
        check.history.forEach(previous => {
          assert(object(previous) && nonempty(previous.name) && ['passed', 'failed', 'pending', 'stale'].includes(previous.status), `检查「${check.name}」历史记录无效。`);
          assert(!Object.prototype.hasOwnProperty.call(previous, 'history'), `检查「${check.name}」历史记录不能嵌套。`);
          assert(Number.isInteger(previous.baselineRevision) && previous.baselineRevision >= 1 && previous.baselineRevision <= project.snapshot.revision, `检查「${check.name}」历史基线无效。`);
          assert(Number.isInteger(previous.designRevision ?? 1) && (previous.designRevision ?? 1) >= 1 && (previous.designRevision ?? 1) <= (project.designRevision ?? 1), `检查「${check.name}」历史设计修订无效。`);
          if (previous.status === 'passed' || previous.status === 'failed') assert(nonempty(previous.evidence), `检查「${check.name}」历史结论缺少验收依据。`);
          assert(nonempty(previous.archivedAt) && Number.isFinite(Date.parse(previous.archivedAt)), `检查「${check.name}」历史归档时间无效。`);
        });
      }
    });
    if (project.upgradeReviews !== undefined) {
      assert(Array.isArray(project.upgradeReviews) && project.upgradeReviews.length <= 20, `项目「${project.name}」最多保留 20 条升级审阅记录。`);
      const reviewIds = new Set();
      project.upgradeReviews.forEach((review) => {
        assert(object(review) && nonempty(review.id) && !reviewIds.has(review.id), `项目「${project.name}」升级审阅记录 ID 无效或重复。`);
        reviewIds.add(review.id);
        assert(Number.isInteger(review.fromRevision) && review.fromRevision >= 1 && Number.isInteger(review.toRevision) && review.toRevision > review.fromRevision && review.toRevision <= project.snapshot.revision, '升级审阅的共享基线版本无效。');
        assert(Number.isInteger(review.fromDesignRevision) && review.fromDesignRevision >= 1 && Number.isInteger(review.toDesignRevision) && review.toDesignRevision === review.fromDesignRevision + 1 && review.toDesignRevision <= (project.designRevision ?? 1), '升级审阅的项目设计修订无效。');
        assert(Array.isArray(review.decisions), '升级审阅的决策清单必须是数组。');
        review.decisions.forEach((decision) => {
          assert(object(decision) && nonempty(decision.pageId) && nonempty(decision.entryId), '升级审阅决策缺少页面或差异标识。');
          if (decision.label !== undefined) assert(nonempty(decision.label), '升级审阅决策的名称不能为空。');
          if (decision.group !== undefined) assert(nonempty(decision.group), '升级审阅决策的分类不能为空。');
          assert(['incoming', 'local', 'same', 'conflict'].includes(decision.status) && ['local', 'incoming'].includes(decision.choice) && ['automatic', 'reviewed'].includes(decision.resolution), '升级审阅决策的选择无效。');
        });
      });
    }
    validateProjectDeliveries(project);
  });
  return true;
}

function nextId(list, prefix) {
  let index = 1;
  const ids = new Set(list.map((item) => item.id));
  while (ids.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function committed(doc, layer, id, action, name) {
  if (SHARED.includes(layer)) doc.revision += 1;
  const event = { id: nextId(doc.history, 'change'), revision: doc.revision, layer, assetId: id, action, name };
  doc.history = [...doc.history, event].slice(-100);
  validateDoc(doc);
  return doc;
}

export function upsertAsset(doc, layer, asset) {
  assert(ASSET_LAYERS.includes(layer), '未知资产层级。');
  assert(object(asset) && nonempty(asset.id), '维护资产时必须提供稳定 ID。');
  const next = clone(doc);
  const index = next[layer].findIndex((entry) => entry.id === asset.id);
  const current = index >= 0 ? next[layer][index] : null;
  if (layer === 'projects' && Object.prototype.hasOwnProperty.call(asset, 'derivedFrom')) {
    assert(current && JSON.stringify(stableReviewValue(asset.derivedFrom)) === JSON.stringify(stableReviewValue(current.derivedFrom)), '项目复用来源为只读记录，请通过从交付归档创建项目建立，不能直接新增、删除或改写。');
  }
  if (layer === 'projects' && Object.prototype.hasOwnProperty.call(asset, 'deliveries')) {
    assert(current && JSON.stringify(stableReviewValue(asset.deliveries)) === JSON.stringify(stableReviewValue(current.deliveries)), '交付归档为只读记录，请通过保存交付归档操作新增，不能直接覆盖、删除或改写。');
  }
  if (layer === 'components' && current && asset.kind !== undefined) assert(current.kind === asset.kind, '已有组件不能直接改变实现类型，请创建新组件。');
  if (layer === 'projects' && current) {
    if (Object.prototype.hasOwnProperty.call(asset, 'snapshot')) assert(JSON.stringify(asset.snapshot) === JSON.stringify(current.snapshot), '项目基线只可通过升级操作更新。');
    if (Object.prototype.hasOwnProperty.call(asset, 'themeOverrides')) assert(JSON.stringify(asset.themeOverrides) === JSON.stringify(current.themeOverrides), '项目主题请通过主题与风格保存。');
    if (Object.prototype.hasOwnProperty.call(asset, 'designRevision')) assert(asset.designRevision === current.designRevision, '项目设计修订不能直接修改。');
    if (Object.prototype.hasOwnProperty.call(asset, 'checks')) assert(JSON.stringify(asset.checks) === JSON.stringify(current.checks), '验收结果请通过验收记录操作更新。');
    if (Object.prototype.hasOwnProperty.call(asset, 'upgradeReviews')) assert(JSON.stringify(asset.upgradeReviews) === JSON.stringify(current.upgradeReviews), '升级审阅记录只可通过版本升级操作更新。');
  }
  const value = { custom: true, ...(current || {}), ...clone(asset), name: (asset.name ?? current?.name ?? '').trim() };
  Object.keys(asset).forEach((key) => { if (asset[key] === undefined) delete value[key]; });
  if (layer === 'templates' && value.composition) {
    const refs = deriveCompositionReferences(value.composition);
    ['componentIds', 'patternIds'].forEach(key => {
      value[key] = value.blueprint || value.flowEnabled !== undefined ? [...new Set([...(value[key] || []), ...refs[key]])] : refs[key];
    });
  }
  if (layer === 'projects' && current && JSON.stringify(value.pages) !== JSON.stringify(current.pages)) {
    value.designRevision = (current.designRevision ?? 1) + 1;
    value.checks = staleChecks(current.checks);
  }
  if (layer === 'components') value.bindings = { ...DEFAULT_BINDINGS, ...(value.bindings || {}) };
  if (layer === 'tokens' && value.type === 'duration') {
    value.unit ||= 'ms';
    ['value', 'darkValue'].forEach((key) => {
      if (typeof value[key] !== 'string') return;
      const parsed = value[key].trim().match(/^(-?\d+(?:\.\d+)?)\s*(ms|s)?$/);
      assert(parsed, `变量「${value.name}」的时长应为数字或带 ms、s 的值。`);
      const parsedUnit = parsed[2] || value.unit;
      const number = Number(parsed[1]);
      value[key] = parsedUnit === value.unit ? number : value.unit === 'ms' ? number * 1000 : number / 1000;
    });
  }
  if (current && JSON.stringify(current) === JSON.stringify(value)) return clone(doc);
  if (index >= 0) next[layer][index] = value;
  else next[layer].push(value);
  return committed(next, layer, value.id, current ? 'update' : 'create', value.name);
}

export function removeAsset(doc, layer, id) {
  assert(ASSET_LAYERS.includes(layer), '未知资产层级。');
  const asset = reference(doc, layer, id);
  assert(asset, '要删除的资产不存在。');
  const uses = getUsage(doc, layer, id).filter((item) => !item.locked);
  assert(!uses.length, `不能删除「${asset.name}」：仍被 ${uses.slice(0, 6).map((item) => `${LAYER_NAMES[item.layer]}「${item.name}」`).join('、')} 引用。请先解除或替换引用。`);
  const next = clone(doc);
  next[layer] = next[layer].filter((entry) => entry.id !== id);
  return committed(next, layer, id, 'delete', asset.name);
}

export function duplicateAsset(doc, layer, id, overrides = {}) {
  assert(ASSET_LAYERS.includes(layer), '未知资产层级。');
  const original = reference(doc, layer, id);
  assert(original, '要复制的资产不存在。');
  let index = 1;
  let name = `${original.name} 副本`;
  while (doc[layer].some((entry) => entry.name === name)) { index += 1; name = `${original.name} 副本 ${index}`; }
  const copy = { ...clone(original), custom: true, id: nextId(doc[layer], `${id}-copy`), name, ...clone(overrides) };
  // A new project has its own delivery history; another project's releases cannot be relabelled.
  if (layer === 'projects') {
    delete copy.deliveries;
    delete copy.derivedFrom;
  }
  assert(!reference(doc, layer, copy.id), '复制资产必须使用新的 ID。');
  return upsertAsset(doc, layer, copy);
}

function sharedSnapshot(doc) {
  return { revision: doc.revision, ...Object.fromEntries(SHARED.map((layer) => [layer, clone(doc[layer])])) };
}

export function createProject(doc, options) {
  assert(object(options), '请提供项目名称和初始模板。');
  const template = options.templateId ? reference(doc, 'templates', options.templateId) : null;
  if (options.templateId) assert(template, '所选页面模板不存在。');
  const project = {
    id: options.id || nextId(doc.projects, 'project'), name: options.name, description: options.description || '', custom: true,
    pages: clone(options.pages || (template ? [{ id: 'page-1', name: template.name, templateId: template.id }] : [])),
    snapshot: sharedSnapshot(doc), checks: [], designRevision: 1, themeOverrides: {},
  };
  assert(!reference(doc, 'projects', project.id), '项目 ID 已存在。');
  return upsertAsset(doc, 'projects', project);
}

/** Adopt exactly the template already locked in the project's baseline. */
export function adoptTemplateToProject(doc, options) {
  assert(object(options), '请提供目标项目和页面模板。');
  const project = reference(doc, 'projects', options.projectId);
  assert(project, '目标项目不存在。');
  const template = reference(project.snapshot, 'templates', options.templateId);
  assert(template, '这个模板尚未纳入项目锁定的基线，请先在项目「版本与影响」中主动升级，再采用到项目。');
  const page = {
    id: options.id || nextId(project.pages, 'page'),
    name: typeof options.pageName === 'string' ? options.pageName.trim() : template.name,
    templateId: template.id,
  };
  assert(nonempty(page.name), '项目页面名称不能为空。');
  assert(!project.pages.some(existing => existing.id === page.id), '项目页面 ID 已存在，请使用新的 ID。');
  return upsertAsset(doc, 'projects', { id: project.id, pages: [...project.pages, page] });
}

export const TEMPLATE_CATALOG_RELEASE = '2026-10-04-blueprints-1';

/** Append a release once, without rewriting any existing asset or project snapshot. */
export function upgradeTemplateLibrary(doc) {
  validateDoc(doc);
  if (doc.templateCatalogRelease === TEMPLATE_CATALOG_RELEASE) return doc;
  // A partial/imported asset package must not acquire executable templates with
  // missing foundations. It can be upgraded after its required assets exist.
  const availableKinds = new Set(doc.components.map(component => component.kind));
  if (!['button', 'text-field', 'number-field', 'select', 'table', 'search-field', 'checkbox', 'alert-dialog', 'progress-bar'].every(kind => availableKinds.has(kind))) return doc;
  const presets = createTemplatePresets(doc);
  const next = clone(doc);
  const ids = new Set(next.templates.map(template => template.id));
  const names = new Set(next.templates.map(template => template.name.trim().toLocaleLowerCase()));
  const added = presets.filter(template => !ids.has(template.id) && !names.has(template.name.trim().toLocaleLowerCase()));
  next.templates.push(...clone(added));
  next.templateCatalogRelease = TEMPLATE_CATALOG_RELEASE;
  return committed(next, 'templates', TEMPLATE_CATALOG_RELEASE, 'catalog-upgrade', `补充 ${added.length} 个可配置页面模板`);
}

export function getProjectUpgrade(doc, projectId) {
  const project = reference(doc, 'projects', projectId);
  assert(project, '项目不存在。');
  const roots = directReferences(doc, 'projects', project);
  const oldClosure = closure(project.snapshot, roots);
  const newClosure = closure(doc, roots);
  const keys = new Set([...oldClosure, ...newClosure]);
  const changes = [...keys].flatMap((key) => {
    const [layer, id] = key.split(':');
    const before = reference(project.snapshot, layer, id);
    const after = reference(doc, layer, id);
    if (JSON.stringify(before) === JSON.stringify(after)) return [];
    return [{ layer, id, name: after?.name || before?.name || id, change: !before ? 'added' : !after ? 'removed' : 'modified' }];
  });
  const changed = new Set(changes.map((item) => `${item.layer}:${item.id}`));
  const affectedPages = project.pages.filter((page) => {
    const root = [{ layer: 'templates', id: page.templateId }];
    const all = new Set([...closure(doc, root), ...closure(project.snapshot, root)]);
    return [...all].some((key) => changed.has(key));
  }).map(({ id, name }) => ({ id, name }));
  const availableTemplateIds = doc.templates.filter(template => !reference(project.snapshot, 'templates', template.id)).map(template => template.id);
  return { hasChanges: changes.length > 0, hasCatalogChanges: availableTemplateIds.length > 0, availableTemplateIds, fromRevision: project.snapshot.revision, toRevision: doc.revision, changes, affectedPages };
}

export function upgradeProject(doc, projectId) {
  const next = clone(doc);
  const project = reference(next, 'projects', projectId);
  assert(project, '项目不存在。');
  project.pages.forEach((page) => {
    const template = reference(doc, 'templates', page.templateId);
    assert(template, `页面「${page.name}」使用的共享模板已删除，无法直接升级；原项目基线仍然保留。`);
    const errors = validatePageOverrides(page, template, doc);
    assert(!errors.length, `页面「${page.name}」的本地配置与新版本不兼容：${errors.join('；')} 原项目基线与本地配置仍然保留，请先处理冲突再升级。`);
  });
  if (project.snapshot.revision === doc.revision) return next;
  Object.keys(project.themeOverrides || {}).forEach(id => {
    const before = reference(project.snapshot, 'tokens', id), after = reference(doc, 'tokens', id);
    assert(after && before.type === after.type && (before.unit || '') === (after.unit || ''), `项目自定义变量「${id}」已删除或类型/单位改变，请先恢复继承后升级。`);
  });
  project.snapshot = sharedSnapshot(doc);
  project.designRevision = (project.designRevision ?? 1) + 1;
  project.checks = staleChecks(project.checks);
  return committed(next, 'projects', project.id, 'upgrade', project.name);
}

// A review key binds an explicit decision to the exact project and shared input.
// Object property order does not affect equality; collection order remains significant.
function stableReviewValue(value) {
  if (Array.isArray(value)) return value.map(stableReviewValue);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableReviewValue(value[key])]));
  return value;
}

function projectReviewKey(doc, project) {
  return JSON.stringify(stableReviewValue({ project, revision: doc.revision, ...Object.fromEntries(SHARED.map(layer => [layer, doc[layer]])) }));
}

/** Compare every page against its locked template before constructing an upgrade. */
export function getProjectUpgradeReview(doc, projectId, { choicesByPage = {} } = {}) {
  validateDoc(doc);
  const project = reference(doc, 'projects', projectId);
  assert(project, '项目不存在。');
  const errors = [];
  const choicesValid = object(choicesByPage) && [Object.prototype, null].includes(Object.getPrototypeOf(choicesByPage));
  if (!choicesValid) errors.push('升级选择必须按项目页面组织。');
  const choices = choicesValid ? choicesByPage : {};
  const knownPages = new Set(project.pages.map(page => page.id));
  Object.keys(choices).forEach(pageId => {
    if (!knownPages.has(pageId)) errors.push(`升级选择引用了不存在的项目页面「${pageId}」。`);
  });
  const pages = project.pages.map(page => {
    const baseTemplate = reference(project.snapshot, 'templates', page.templateId);
    const nextTemplate = reference(doc, 'templates', page.templateId);
    try {
      const pageChoices = Object.prototype.hasOwnProperty.call(choices, page.id) ? choices[page.id] : {};
      const plan = planTemplateMerge({ baseTemplate, page, nextTemplate, source: doc, choices: pageChoices });
      errors.push(...plan.errors.map(error => `页面「${page.name}」：${error}`));
      return { ...plan, name: page.name, templateId: page.templateId };
    } catch (error) {
      const message = `页面「${page.name}」：${error.message}`;
      errors.push(message);
      return { pageId: page.id, name: page.name, templateId: page.templateId, entries: [], unresolved: [], errors: [error.message], candidatePage: clone(page), hasChanges: false };
    }
  });
  const unresolvedCount = pages.reduce((sum, page) => sum + page.unresolved.length, 0);
  Object.keys(project.themeOverrides || {}).forEach(id => {
    const before = reference(project.snapshot, 'tokens', id), after = reference(doc, 'tokens', id);
    if (!after || !before || before.type !== after.type || (before.unit || '') !== (after.unit || '')) errors.push(`项目自定义变量「${id}」已删除或类型/单位改变，请先恢复继承后升级。`);
  });
  let candidateProject = null;
  if (!errors.length && !unresolvedCount) {
    const candidate = clone(project);
    if (project.snapshot.revision !== doc.revision) {
      candidate.snapshot = sharedSnapshot(doc);
      candidate.pages = pages.map(page => clone(page.candidatePage));
      candidate.designRevision = (project.designRevision ?? 1) + 1;
      candidate.checks = staleChecks(project.checks);
    }
    const next = clone(doc);
    next.projects[next.projects.findIndex(entry => entry.id === projectId)] = candidate;
    try { validateDoc(next); candidateProject = candidate; }
    catch (error) { errors.push(error.message); }
  }
  return {
    fromRevision: project.snapshot.revision, toRevision: doc.revision,
    designRevision: project.designRevision ?? 1, pages, unresolvedCount,
    errors: [...new Set(errors)], candidateProject, reviewKey: projectReviewKey(doc, project),
  };
}

/** Recompute and validate atomically; never apply a stale or partially resolved review. */
export function applyProjectUpgradeReview(doc, projectId, { choicesByPage = {}, reviewKey } = {}) {
  const review = getProjectUpgradeReview(doc, projectId, { choicesByPage });
  assert(nonempty(reviewKey) && reviewKey === review.reviewKey, '升级审阅已过期：项目或共享资产已发生变化，请重新审阅后应用。');
  assert(!review.unresolvedCount, `还有 ${review.unresolvedCount} 项升级冲突未处理，请逐项选择后再升级。`);
  assert(!review.errors.length, `升级审阅未通过：${review.errors.join('；')}`);
  assert(review.candidateProject, '无法生成有效的项目升级结果。');
  if (review.fromRevision === review.toRevision) return clone(doc);
  const next = clone(doc);
  const candidate = clone(review.candidateProject);
  const decisions = review.pages.flatMap(page => page.entries.map(entry => ({
    pageId: page.pageId, entryId: entry.id, label: entry.label, group: entry.group, status: entry.status,
    choice: entry.choice || (entry.status === 'incoming' ? 'incoming' : 'local'),
    resolution: Object.prototype.hasOwnProperty.call(choicesByPage[page.pageId] || {}, entry.id) ? 'reviewed' : 'automatic',
  })));
  candidate.upgradeReviews = [...(candidate.upgradeReviews || []), {
    id: `upgrade-${candidate.designRevision}`, fromRevision: review.fromRevision, toRevision: review.toRevision,
    fromDesignRevision: review.designRevision, toDesignRevision: candidate.designRevision, decisions,
  }].slice(-20);
  next.projects[next.projects.findIndex(entry => entry.id === projectId)] = candidate;
  return committed(next, 'projects', projectId, 'upgrade-reviewed', candidate.name);
}


function staleChecks(checks) {
  return checks.map(check => ({ ...check, previousStatus: check.status === 'stale' ? check.previousStatus : check.status, status: 'stale' }));
}

export function setProjectTheme(doc, projectId, overrides) {
  const next = clone(doc);
  const project = reference(next, 'projects', projectId);
  assert(project, '项目不存在。');
  if (JSON.stringify(project.themeOverrides || {}) === JSON.stringify(overrides)) return next;
  project.themeOverrides = clone(overrides);
  project.designRevision = (project.designRevision ?? 1) + 1;
  project.checks = staleChecks(project.checks);
  return committed(next, 'projects', project.id, 'theme', project.name);
}

function projectCheckValue(project, check, current) {
  assert(object(check), '请提供检查内容。');
  const own = key => Object.prototype.hasOwnProperty.call(check, key);
  if (own('history')) assert(JSON.stringify(check.history) === JSON.stringify(current?.history || []), '检查历史由验收记录自动维护，不能直接修改。');
  const value = { ...(current || {}), ...clone(check), id: check.id || nextId(project.checks, 'check'), status: check.status || current?.status || 'pending', baselineRevision: project.snapshot.revision, designRevision: project.designRevision ?? 1 };
  ['description', 'evidence', 'pageId', 'dimension', 'criterionKey'].forEach(key => {
    if (own(key) && check[key] === undefined) delete value[key];
  });
  if (!value.pageId) delete value.pageId;
  if (!value.dimension || value.dimension === 'custom') {
    delete value.dimension;
    delete value.criterionKey;
  } else {
    assert(CHECK_DIMENSIONS.some(dimension => dimension.id === value.dimension), '请选择有效的验收维度。');
    assert(value.pageId && project.pages.some(page => page.id === value.pageId), '标准验收维度必须关联一个项目页面。');
    const criterion = buildProjectCheckPlan(project).find(item => item.pageId === value.pageId && item.dimension === value.dimension);
    assert(criterion, '找不到当前页面的验收标准。');
    value.criterionKey = criterion.criterionKey;
    if (!own('customCriterion') && ['name', 'description'].some(key => own(key) && value[key] !== criterion[key])) value.customCriterion = true;
  }
  const definitionChanged = current && ['name', 'description', 'pageId', 'dimension', 'criterionKey', 'customCriterion'].some(key => JSON.stringify(current[key]) !== JSON.stringify(value[key]));
  const revisionChanged = current && (current.baselineRevision !== project.snapshot.revision || (current.designRevision ?? 1) !== (project.designRevision ?? 1));
  if (!own('status') && (definitionChanged || revisionChanged || current?.status === 'stale')) value.status = 'pending';
  delete value.previousStatus;
  delete value.history;
  // Caller timestamps and imported history are never accepted as a fresh review event.
  if (current?.updatedAt !== undefined) value.updatedAt = current.updatedAt;
  else delete value.updatedAt;
  const previous = current ? clone(current) : null;
  if (previous) delete previous.history;
  if (previous && JSON.stringify(stableReviewValue(previous)) === JSON.stringify(stableReviewValue(value))) return current;
  const now = new Date().toISOString();
  value.updatedAt = now;
  if (current) value.history = [...(current.history || []), { ...previous, archivedAt: now }].slice(-20);
  return value;
}

export function recordProjectCheck(doc, projectId, check) {
  const next = clone(doc);
  const project = reference(next, 'projects', projectId);
  assert(project, '项目不存在。');
  assert(object(check), '请提供检查内容。');
  const id = check.id || nextId(project.checks, 'check');
  const index = project.checks.findIndex((entry) => entry.id === id);
  const current = index >= 0 ? project.checks[index] : null;
  const value = projectCheckValue(project, { ...check, id }, current);
  if (current === value) return next;
  if (index >= 0) project.checks[index] = value;
  else project.checks.push(value);
  return committed(next, 'projects', project.id, 'check', value.name);
}

/** Materialize missing review tasks only; generating a plan never verifies a result. */
export function createProjectCheckPlan(doc, projectId, { pageId } = {}) {
  validateDoc(doc);
  const next = clone(doc);
  const project = reference(next, 'projects', projectId);
  assert(project, '项目不存在。');
  if (pageId !== undefined) assert(project.pages.some(page => page.id === pageId), '指定的项目页面不存在。');
  let changed = false;
  buildProjectCheckPlan(project).filter(item => pageId === undefined || item.pageId === pageId).forEach(item => {
    const existing = project.checks.filter(check => check.pageId === item.pageId && check.dimension === item.dimension);
    if (!existing.length) {
      project.checks.push(projectCheckValue(project, { ...item, status: 'pending' }, null));
      changed = true;
      return;
    }
    existing.filter(check => check.criterionKey !== item.criterionKey || (!check.customCriterion && ['name', 'description'].some(key => check[key] !== item[key]))).forEach(check => {
      const customized = check.customCriterion ? { name: check.name, description: check.description } : {};
      const value = projectCheckValue(project, { ...item, ...customized, id: check.id, status: 'pending' }, check);
      project.checks[project.checks.findIndex(entry => entry.id === check.id)] = value;
      changed = true;
    });
  });
  return changed ? committed(next, 'projects', project.id, 'check-plan', project.name) : next;
}

/** A portable manual-review package. Draft exports remain possible when review is incomplete. */
export function prepareProjectDelivery(doc, projectId, { mode = 'draft' } = {}) {
  validateDoc(doc);
  const project = reference(doc, 'projects', projectId);
  assert(project, '项目不存在。');
  assert(['draft', 'reviewed'].includes(mode), '交付模式必须是待审草稿或人工验收交付。');
  const acceptance = getProjectAcceptance(project);
  if (mode === 'reviewed') assert(acceptance.ready, '项目尚未完成当前基线与设计修订的全部人工验收，请先处理缺失、待检查、未通过或待复验项；仍可导出待审草稿。');
  const snapshot = clone(project);
  delete snapshot.deliveries;
  return {
    format: 'gkx-design-delivery', schemaVersion: 2, exportedAt: new Date().toISOString(), mode,
    project: snapshot, acceptance: clone(acceptance),
    scope: { method: 'manual-evidence', note: '本交付包记录当前项目设计快照与人工验收证据，不代表线上生产环境认证、自动测试通过或真实业务接口验证。' },
  };
}

/** Append a frozen delivery snapshot. Saving a draft never promotes it to reviewed. */
export function createProjectDeliveryRecord(doc, projectId, { mode = 'draft', title, note = '' } = {}) {
  assert(nonempty(title) && title.trim().length <= 120, '请填写交付归档名称，最多 120 个字符。');
  assert(typeof note === 'string' && note.length <= 2000, '交付归档说明必须是文字，最多 2000 个字符。');
  const payload = prepareProjectDelivery(doc, projectId, { mode });
  const next = clone(doc);
  const project = reference(next, 'projects', projectId);
  const deliveries = project.deliveries || [];
  assert(deliveries.length < MAX_PROJECT_DELIVERIES, `每个项目最多保留 ${MAX_PROJECT_DELIVERIES} 份交付归档；请先导出完整资产库备份，再缩小归档范围。`);
  project.deliveries = [...deliveries, { id: nextId(deliveries, 'delivery'), title: title.trim(), note: note.trim(), createdAt: payload.exportedAt, package: payload }];
  const result = committed(next, 'projects', projectId, 'delivery', title.trim());
  assert(JSON.stringify(result, null, 2).length <= MAX_ASSET_PACKAGE_LENGTH, '保存后资产包将超过 8 MB，无法完整导入；请先导出完整资产库备份，并缩小归档范围。原有归档未作修改。');
  return result;
}

/** Start an independent project from a frozen delivery, never from the live source project. */
export function createProjectFromDelivery(doc, sourceProjectId, deliveryId, options) {
  validateDoc(doc);
  assert(object(options), '请提供新项目名称与采用页面。');
  assert(nonempty(options.name) && options.name.trim().length <= 120, '请填写新项目名称，最多 120 个字符。');
  assert(options.description === undefined || (typeof options.description === 'string' && options.description.length <= 2000), '新项目说明必须是文字，最多 2000 个字符。');
  assert(options.copyCheckStandards === undefined || typeof options.copyCheckStandards === 'boolean', '是否复用检查标准必须为布尔值。');
  const source = reference(doc, 'projects', sourceProjectId);
  assert(source, '来源项目不存在。');
  const delivery = (source.deliveries || []).find(record => record.id === deliveryId);
  assert(delivery, '要复用的交付归档不存在。');
  const archived = delivery.package.project;
  const selectedIds = options.pageIds === undefined ? archived.pages.map(page => page.id) : options.pageIds;
  assert(Array.isArray(selectedIds) && selectedIds.length > 0, '请至少选择一个归档页面。');
  assert(new Set(selectedIds).size === selectedIds.length && selectedIds.every(id => archived.pages.some(page => page.id === id)), '采用页面必须来自当前归档，且不能重复。');
  const id = options.id ?? nextId(doc.projects, 'project');
  assert(!reference(doc, 'projects', id), '新项目 ID 已存在。');
  const pageMap = new Map();
  const identityPool = [...archived.pages];
  const pages = archived.pages.filter(page => selectedIds.includes(page.id)).map(page => {
    const pageId = nextId(identityPool, 'page');
    const copied = { ...clone(page), id: pageId };
    identityPool.push(copied);
    pageMap.set(page.id, pageId);
    return copied;
  });
  const project = {
    id, name: options.name.trim(), description: (options.description || '').trim(), custom: true,
    snapshot: clone(archived.snapshot), themeOverrides: clone(archived.themeOverrides || {}),
    designRevision: 1, pages, checks: [],
    derivedFrom: {
      kind: 'delivery', projectId: archived.id, projectName: archived.name,
      deliveryId: delivery.id, deliveryTitle: delivery.title, deliveryCreatedAt: delivery.createdAt,
      baselineRevision: archived.snapshot.revision, designRevision: archived.designRevision ?? 1,
      createdAt: new Date().toISOString(),
      pages: archived.pages.filter(page => pageMap.has(page.id)).map(page => ({ sourcePageId: page.id, pageId: pageMap.get(page.id), sourceName: page.name })),
    },
  };
  const checkIds = [...archived.checks];
  const appendCheck = definition => {
    const check = projectCheckValue(project, { ...definition, id: nextId(checkIds, 'check'), status: 'pending' }, null);
    project.checks.push(check); checkIds.push(check);
  };
  if (options.copyCheckStandards !== false) archived.checks.filter(check => (!check.pageId || pageMap.has(check.pageId)) && (!check.dimension || check.customCriterion)).forEach(check => {
    // Whitelist definitions. Evidence, conclusions, history and source record timestamps never travel.
    const definition = { name: check.name };
    if (check.description !== undefined) definition.description = clone(check.description);
    if (check.customCriterion !== undefined) definition.customCriterion = check.customCriterion;
    if (check.pageId) definition.pageId = pageMap.get(check.pageId);
    if (check.dimension && definition.pageId) definition.dimension = check.dimension;
    appendCheck(definition);
  });
  // Automatic standards are regenerated from the copied page configuration. An archived
  // check may refer to an earlier revision and must not freeze an outdated title or field list.
  buildProjectCheckPlan(project).forEach(item => {
    if (!project.checks.some(check => check.pageId === item.pageId && check.dimension === item.dimension)) appendCheck(item);
  });
  const next = clone(doc);
  next.projects.push(project);
  const result = committed(next, 'projects', project.id, 'reuse-delivery', project.name);
  assert(JSON.stringify(result, null, 2).length <= MAX_ASSET_PACKAGE_LENGTH, '复用后资产包将超过 8 MB，无法完整导入；请先导出完整资产库备份，并缩小采用页面范围。原项目与归档未作修改。');
  return result;
}

export function removeProjectCheck(doc, projectId, checkId) {
  const next = clone(doc);
  const project = reference(next, 'projects', projectId);
  assert(project, '项目不存在。');
  const check = project.checks.find((entry) => entry.id === checkId);
  assert(check, '要删除的检查记录不存在。');
  project.checks = project.checks.filter((entry) => entry.id !== checkId);
  return committed(next, 'projects', project.id, 'remove-check', check.name);
}

export function serializeDoc(doc) {
  validateDoc(doc);
  return JSON.stringify(doc, null, 2);
}

export function importDoc(input) {
  if (typeof input === 'string') assert(input.length <= MAX_ASSET_PACKAGE_LENGTH, '资产包超过 8 MB，请精简后导入。');
  let value;
  try { value = typeof input === 'string' ? JSON.parse(input) : clone(input); }
  catch { fail('资产包不是有效的 JSON 文件。'); }
  safeTree(value);
  // Persist defaults rather than keeping invisible fallback dependencies.
  const materialize = (library) => {
    if (!object(library) || !Array.isArray(library.components)) return;
    library.components.forEach((component) => {
      if (object(component) && object(component.bindings)) component.bindings = { ...DEFAULT_BINDINGS, ...component.bindings };
    });
  };
  materialize(value);
  if (Array.isArray(value?.projects)) value.projects.forEach((project) => materialize(project?.snapshot));
  validateDoc(value);
  return clone(value);
}
