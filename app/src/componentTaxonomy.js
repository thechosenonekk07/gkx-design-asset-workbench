/** User-facing categories describe a task, independently of renderer primitives. */
export const COMPONENT_GROUPS = [
  {name:'基础', description:'文字与操作入口', guide:'建立清晰的文字层级，表达动作与目的地。'},
  {name:'布局', description:'空间与内容结构', guide:'组织页面区域、分隔关系和元素间距。'},
  {name:'导航', description:'位置与流程切换', guide:'告诉用户所在位置、可去哪里，以及下一步是什么。'},
  {name:'输入', description:'信息填写与选择', guide:'收集信息、选择条件，并提供标签、约束和错误反馈。'},
  {name:'展示', description:'数据与对象呈现', guide:'呈现可比较、可理解的数据与内容对象。'},
  {name:'反馈', description:'状态与操作结果', guide:'说明当前状态、操作结果和可恢复的下一步。'},
];
const families = [
  ['基础','操作入口','button toggle-button link'],
  ['基础','文字表达','typography'],
  ['布局','布局结构','layout space separator toolbar'],
  ['导航','页面与流程','breadcrumbs tabs menu pagination steps'],
  ['输入','文本与数值','text-field textarea search-field number-field slider range-slider'],
  ['输入','选项与集合','checkbox checkbox-group radio-group switch select combo-box list-box'],
  ['输入','日期与时间','calendar range-calendar date-field date-picker date-range-picker time-field'],
  ['输入','颜色编辑','color-picker color-area color-slider color-field color-swatch color-swatch-picker'],
  ['输入','文件选择','file-trigger drop-zone'],
  ['展示','数据组织','table grid-list tree descriptions'],
  ['展示','内容与标记','avatar badge tag tag-group card disclosure disclosure-group meter'],
  ['反馈','提示与状态','alert loading progress-bar skeleton empty tooltip'],
  ['反馈','弹层与确认','dialog alert-dialog drawer popover'],
];
const indexed = Object.fromEntries(families.flatMap(([category,family,kinds])=>kinds.split(' ').map(kind=>[kind,{category,family}])));
const aliases = {'text-field':'输入框 Input 文本框','number-field':'数字输入框 InputNumber 计数器','combo-box':'自动完成 AutoComplete 搜索选择','menu':'下拉菜单 Dropdown','separator':'分割线 Divider','disclosure':'折叠面板 Collapse','disclosure-group':'手风琴 Accordion','progress-bar':'Progress 进度','file-trigger':'上传 Upload','drop-zone':'拖拽上传 Upload','popover':'气泡 Popup','alert-dialog':'确认弹窗 Popconfirm','time-field':'时间选择 TimePicker','color-picker':'拾色器','typography':'排版 Text 标题 正文','empty':'空数据 缺省页','loading':'加载 Spin'};

export function componentTaxonomy(component) {
  return indexed[component.kind] || {category:COMPONENT_GROUPS.some(g=>g.name===component.category)?component.category:'基础',family:'其他'};
}
export function normalizeCatalogEntry(component) {
  return {...component,...componentTaxonomy(component),implementation:component.implementation || (['range-slider','color-picker'].includes(component.kind)?'composed':'aria')};
}
export function matchesComponent(component, query) {
  const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const {category,family}=componentTaxonomy(component);
  const haystack=[component.name,component.en,component.kind,component.description,category,family,aliases[component.kind]||''].join(' ').toLowerCase();
  return words.every(word=>haystack.includes(word));
}

