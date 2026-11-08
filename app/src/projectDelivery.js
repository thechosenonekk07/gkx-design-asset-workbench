import { resolvePageTemplate, BLUEPRINT_FAMILIES, BLUEPRINT_SHELLS, BLUEPRINT_VARIANTS } from './templateBlueprint.js';
import { applyProjectTheme } from './projectTheme.js';
import { CHECK_DIMENSIONS, getCheckStatus } from './projectAcceptance.js';
import { DEFAULT_BINDINGS } from './model.js';

const array = value => Array.isArray(value) ? value : [];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const labels = {
  id:'标识',
  name:'名称', description:'说明', title:'标题', templateId:'采用模板', layout:'页面布局',
  blueprint:'页面配置', composition:'区域编排', family:'页面类型', variant:'结构变体', shell:'导航框架',
  fields:'字段', label:'文案', type:'类型', required:'必填', options:'可选值', records:'样本', values:'字段值',
  actions:'页面操作', primaryLabel:'主要操作', secondaryLabel:'次要操作', allowCreate:'允许创建', allowDelete:'允许删除',
  sections:'区域顺序', regions:'区域', columns:'列数', items:'实例', layer:'资产层级', assetId:'引用资产',
  componentIds:'组件引用', patternIds:'模式引用', config:'配置', bindings:'变量绑定',
  value:'浅色值', darkValue:'深色值', alias:'引用变量', unit:'单位', group:'分组', min:'最小值', max:'最大值',
  kind:'实现类型', category:'分类', status:'检查结论', recordedStatus:'记录状态', evidence:'检查证据',
  pageId:'检查范围', dimension:'检查维度', criterionKey:'标准版本', customCriterion:'自定义标准',
  baselineRevision:'检查基线', designRevision:'检查设计修订', scope:'适用范围', version:'格式版本',
  states:'状态', rules:'规则', steps:'操作步骤', spec:'使用规范', docs:'参考文档', capabilities:'支持能力',
};
const sectionLabels = { intro:'标题与说明', filters:'检索条件', actions:'页面操作', content:'主要内容' };
const statusLabels = { passed:'人工通过', failed:'需要修改', pending:'待检查', stale:'需要复验' };
const dimensionLabels = Object.fromEntries(CHECK_DIMENSIONS.map(item => [item.id, item.label]));
const assetLabels = { tokens:'基础变量', components:'组件', patterns:'交互模式' };
const assetMetadata = new Set(['createdAt', 'updatedAt', 'archivedAt', 'exportedAt', 'history']);
const present = value => value !== undefined;
const limited = (value, max = 240) => value.length > max ? `${value.slice(0, max)}…（共 ${value.length} 字）` : value;
const itemName = item => object(item) ? item.label || item.name || item.title || item.id || '配置' : item;
const keyed = value => Array.isArray(value) && value.every(item => object(item) && typeof item.id === 'string')
  && new Set(value.map(item => item.id)).size === value.length;
const normalized = value => Array.isArray(value) ? value.map(normalized) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalized(value[key])])) : value;
const equal = (left, right) => JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));

function readable(value, key) {
  if (value === undefined) return '未设置';
  if (value === null) return '空值';
  if (value === '') return '空文本';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const mapped = key === 'status' || key === 'recordedStatus' ? statusLabels[value]
      : key === 'dimension' ? dimensionLabels[value]
        : key === 'family' ? BLUEPRINT_FAMILIES[value]
          : key === 'shell' ? BLUEPRINT_SHELLS[value]
            : key === 'variant' ? Object.values(BLUEPRINT_VARIANTS).find(variants => variants[value])?.[value]
              : key === 'sections' ? sectionLabels[value] : undefined;
    return limited(mapped || value);
  }
  if (Array.isArray(value)) {
    if (!value.length) return '无';
    const entries = value.slice(0, 6).map(item => object(item) ? readable(itemName(item)) : readable(item, key));
    return limited(`${entries.join('、')}${value.length > 6 ? `等 ${value.length} 项` : ''}`);
  }
  const entries = Object.entries(value).filter(([name]) => name !== 'id');
  if (!entries.length) return '空配置';
  return limited(entries.slice(0, 4).map(([name, content]) => `${labels[name] || name}：${readable(content, name)}`).join('；')
    + (entries.length > 4 ? `；共 ${entries.length} 项配置` : ''));
}

function withoutAssetMetadata(asset) {
  return Object.fromEntries(Object.entries(asset || {}).filter(([key]) => key !== 'id' && !assetMetadata.has(key)));
}

/** The returned project is detached, so previewing an archive cannot mutate its saved package. */
export function getDeliveryProject(record) {
  const project = record?.package?.project;
  if (!object(project) || !object(project.snapshot) || !Array.isArray(project.pages)) throw new Error('交付记录缺少有效的项目快照。');
  return clone(project);
}

function projectState(project) {
  const source = applyProjectTheme(project);
  const assets = { tokens: new Map(), components: new Map(), patterns: new Map() };
  const visited = new Set();
  function visit(layer, id) {
    if (visited.has(`${layer}/${id}`)) return;
    visited.add(`${layer}/${id}`);
    const asset = array(source[layer]).find(item => item.id === id);
    if (!asset) throw new Error(`项目采用的资产不存在：${layer}/${id}。`);
    assets[layer].set(id, asset);
    // Match tokenCSS even for older standalone delivery snapshots with partial bindings.
    if (layer === 'components') Object.values({ ...DEFAULT_BINDINGS, ...asset.bindings }).forEach(token => visit('tokens', token));
    if (layer === 'patterns') array(asset.componentIds).forEach(component => visit('components', component));
    if (layer === 'tokens' && asset.alias) visit('tokens', asset.alias);
  }
  const pages = new Map(array(project.pages).map(page => {
    const template = resolvePageTemplate(array(source.templates).find(item => item.id === page.templateId), page);
    array(template.componentIds).forEach(id => visit('components', id));
    array(template.patternIds).forEach(id => visit('patterns', id));
    array(template.composition?.regions).forEach(region => array(region.items).forEach(item => visit(item.layer, item.assetId)));
    return [page.id, { name:page.name, templateId:page.templateId, template:withoutAssetMetadata(template) }];
  }));
  return { pages, assets };
}

/** Compare meaningful adopted design content, never archive history or save timestamps. */
export function compareProjectDelivery(record, currentProject) {
  const beforeProject = getDeliveryProject(record);
  if (!object(currentProject) || !object(currentProject.snapshot)) throw new Error('当前项目缺少有效的设计快照。');
  const oldState = projectState(beforeProject), currentState = projectState(currentProject);
  const changes = [];
  const summary = { pages:0, theme:0, assets:0, checks:0, metadata:0 };
  function add(category, path, label, before, after, key) {
    let beforeText = readable(before, key), afterText = readable(after, key);
    // Equal prefixes must not conceal a real edit later in long evidence or descriptions.
    if (typeof before === 'string' && typeof after === 'string' && before !== after && beforeText === afterText) {
      const oldChars = [...before], newChars = [...after];
      let offset = 0;
      while (offset < Math.min(oldChars.length, newChars.length) && oldChars[offset] === newChars[offset]) offset += 1;
      const start = Math.max(0, offset - 70);
      const excerpt = chars => `${start ? '…' : ''}${chars.slice(start, start + 180).join('')}${chars.length > start + 180 ? '…' : ''}（变更附近，第 ${offset + 1} 字）`;
      beforeText = excerpt(oldChars); afterText = excerpt(newChars);
    }
    changes.push({ id:`${category}:${path.map(part => encodeURIComponent(String(part))).join('/')}`, category, label,
      before:beforeText, after:afterText,
      ...(typeof before === 'string' && before.length > 240 ? { fullBefore:before } : {}),
      ...(typeof after === 'string' && after.length > 240 ? { fullAfter:after } : {}),
    });
    summary[category] += 1;
  }
  function diff(category, path, label, before, after, key, fieldLabels = {}) {
    if (equal(before, after)) return;
    if (object(before) && object(after)) {
      new Set([...Object.keys(before), ...Object.keys(after)]).forEach(name => {
        const fieldName = path.at(-1) === 'values' ? fieldLabels[name] : undefined;
        diff(category, [...path, name], `${label} · ${fieldName || labels[name] || name}`, before[name], after[name], name, fieldLabels);
      });
    } else if (keyed(before) && keyed(after)) {
      const beforeMap = new Map(before.map(item => [item.id, item])), afterMap = new Map(after.map(item => [item.id, item]));
      const sharedBefore = before.filter(item => afterMap.has(item.id)).map(item => item.id);
      const sharedAfter = after.filter(item => beforeMap.has(item.id)).map(item => item.id);
      if (!equal(sharedBefore, sharedAfter)) add(category, [...path, 'order'], `${label} · 排列顺序`, before.map(itemName), after.map(itemName));
      new Set([...beforeMap.keys(), ...afterMap.keys()]).forEach(id => {
        const oldItem = beforeMap.get(id), newItem = afterMap.get(id);
        diff(category, [...path, id], `${label} · ${itemName(newItem || oldItem)}`, oldItem, newItem, key, fieldLabels);
      });
    } else add(category, path, `${label}${!present(before) ? '（新增）' : !present(after) ? '（移除）' : ''}`, before, after, key);
  }
  ['name', 'description'].forEach(key => diff('metadata', [key], `项目${labels[key]}`, beforeProject[key], currentProject[key], key));

  const oldPages = oldState.pages, newPages = currentState.pages;
  const oldOrder = [...oldPages.keys()].filter(id => newPages.has(id));
  const newOrder = [...newPages.keys()].filter(id => oldPages.has(id));
  if (!equal(oldOrder, newOrder)) add('pages', ['order'], '页面排列顺序', [...oldPages.values()].map(page => page.name), [...newPages.values()].map(page => page.name));
  new Set([...oldPages.keys(), ...newPages.keys()]).forEach(id => {
    const before = oldPages.get(id), after = newPages.get(id), name = after?.name || before?.name || id;
    if (!before || !after) add('pages', [id], `页面「${name}」${after ? '（新增）' : '（移除）'}`, before, after);
    else {
      ['name', 'templateId'].forEach(key => diff('pages', [id, key], `页面「${name}」 · ${labels[key]}`, before[key], after[key], key));
      // Compare the resolved contract; a project override can legitimately hide an upstream template edit.
      const fieldLabels = Object.fromEntries([...array(before.template.blueprint?.fields), ...array(after.template.blueprint?.fields)].map(field => [field.id, field.label]));
      diff('pages', [id, 'template'], `页面「${name}」`, before.template, after.template, undefined, fieldLabels);
    }
  });
  const oldOverrides = beforeProject.themeOverrides || {}, newOverrides = currentProject.themeOverrides || {};
  new Set([...Object.keys(oldOverrides), ...Object.keys(newOverrides)]).forEach(id => {
    const token = array(currentProject.snapshot.tokens).find(item => item.id === id) || array(beforeProject.snapshot.tokens).find(item => item.id === id);
    diff('theme', [id], `项目主题 · ${token?.name || id}`, oldOverrides[id], newOverrides[id]);
  });
  Object.keys(assetLabels).forEach(layer => {
    const previous = oldState.assets[layer], current = currentState.assets[layer];
    new Set([...previous.keys(), ...current.keys()]).forEach(id => {
      const before = previous.get(id), after = current.get(id), name = after?.name || before?.name || id;
      diff('assets', [layer, id], `${assetLabels[layer]}「${name}」`, before && withoutAssetMetadata(before), after && withoutAssetMetadata(after));
    });
  });
  const checkView = (project, check) => ({
    name:check.name, description:check.description, pageId:check.pageId
      ? `${array(project.pages).find(page => page.id === check.pageId)?.name || '未知页面'}（${check.pageId}）` : '整个项目',
    dimension:check.dimension || '自定义检查', criterionKey:check.criterionKey,
    customCriterion:check.customCriterion === true, status:getCheckStatus(project, check),
    recordedStatus:check.status, evidence:check.evidence,
    baselineRevision:check.baselineRevision, designRevision:check.designRevision ?? 1,
  });
  const oldChecks = new Map(array(beforeProject.checks).map(check => [check.id, checkView(beforeProject, check)]));
  const newChecks = new Map(array(currentProject.checks).map(check => [check.id, checkView(currentProject, check)]));
  new Set([...oldChecks.keys(), ...newChecks.keys()]).forEach(id => {
    const before = oldChecks.get(id), after = newChecks.get(id);
    diff('checks', [id], `检查「${after?.name || before?.name || id}」`, before, after);
  });
  return { changed:changes.length > 0, summary, changes };
}
