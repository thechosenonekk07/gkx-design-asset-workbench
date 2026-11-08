/** Workbench-owned semantic and React Aria compositions, not upstream exports. */
export const EXTENDED_ENUM_OPTIONS = {
  level: [['body','正文'],['title','标题'],['caption','辅助文字']],
  indicator: [['spinner','旋转指示'],['dots','点状指示']],
  placement: [['right','右侧'],['left','左侧']],
  orientation: [['horizontal','横向'],['vertical','纵向']],
};
export const EXTENDED_CAPABILITY_LABELS = {level:'文字层级',bordered:'显示边框',dot:'圆点提示',closable:'允许关闭',rows:'显示行数',columns:'列数',animated:'启用动效',avatar:'显示头像占位',total:'总条数',pageSize:'每页条数',maxLength:'最大字数',indicator:'指示样式',placement:'抽屉位置',width:'抽屉宽度',gap:'元素间距',sidebar:'显示侧栏'};
const labels = {label:'组件可访问名称或主要文案',description:'补充说明',value:'初始值',theme:'语义主题',size:'组件尺寸',shape:'头像形状',options:'列表内容；每行一项',disabled:'禁用操作',required:'必填',invalid:'显示校验失败',errorMessage:'校验错误说明',confirmLabel:'操作按钮文字',cancelLabel:'取消按钮文字',max:'计数显示上限',...EXTENDED_CAPABILITY_LABELS};
const enumTypes = {theme:'"default" | "primary" | "success" | "warning" | "danger"',size:'"small" | "medium" | "large"',shape:'"square" | "circle"',...Object.fromEntries(Object.entries(EXTENDED_ENUM_OPTIONS).map(([key,options])=>[key,options.map(([value])=>`"${value}"`).join(' | ')]))};
function asset(kind,name,en,category,implementation,description,config,guide) {
  const capabilities=Object.keys(config);
  const docs=`https://tdesign.tencent.com/vue-next/components/${kind}`;
  return {kind,name,en,category,implementation,addedIn:2,description,docs,config,capabilities,...(['tag','alert'].includes(kind)?{bindings:{success:'color.success',warning:'color.warning'}}:{}),spec:{
    schemaRevision:4,completeness:'场景规范样板',purpose:description,
    usage:guide.use,whenToUse:guide.use,avoid:guide.avoid,anatomy:guide.anatomy,
    states:guide.states.map(([name,note])=>({name,note})),keyboard:guide.keyboard,
    accessibility:guide.accessibility,acceptance:guide.acceptance,
    api:capabilities.map(key=>({name:key,type:enumTypes[key]||(Array.isArray(config[key])?'string[]':typeof config[key]),description:labels[key]||key,defaultValue:config[key],required:key==='label'})),
    tokens:guide.tokens,related:guide.related,
    examples:guide.examples.map(([name,note,overrides])=>({name,note,config:{...config,...overrides}})),
    sources:[{label:`TDesign ${en} 整理参考`,href:docs}],
  }};
}
export const EXTENDED_COMPONENT_CATALOG = [
  asset('typography','文本','Typography','基础','semantic','用标题、正文与辅助文字组织信息层级。',
    {label:'让信息清楚地被阅读',description:'用明确的层级与适当的行距，帮助用户快速理解内容。',level:'body'},
    {use:'需要表达标题、段落或次要说明时，使用与内容层级一致的文本语义。',avoid:'不要只靠放大字号模拟标题，也不要让辅助文字承载必须阅读的操作条件。',anatomy:['语义文本','内容层级','补充段落'],states:[['标题','使用标题元素呈现当前内容标题。'],['正文','保持可读行宽与行距。'],['辅助文字','降低权重但不隐藏重要信息。']],keyboard:['文本可按浏览器方式选择和复制，无独立键盘操作。'],accessibility:['标题语义与内容层级一致。','正文允许换行和缩放。'],acceptance:['切换层级同时改变视觉与 HTML 语义。','长文本换行，不超出容器。'],tokens:['text','muted','fontFamily','fontSize','fontWeight','lineHeight','gap'],related:['card','descriptions'],examples:[['正文与说明','适合内容详情及操作解释。',{}],['区块标题','标题表达主题，段落补充上下文。',{level:'title',label:'项目概览'}],['辅助说明','适合表单提示与次要信息。',{level:'caption',label:'最近更新于今天',description:''}]]}),
  asset('avatar','头像','Avatar','展示','semantic','以姓名缩写识别人或团队，支持圆形与方形。',
    {label:'林青',shape:'circle',size:'medium'},
    {use:'列表、评论和成员信息中，为人物或团队提供稳定的识别标记。',avoid:'不要把头像本身默认当作可点击入口；需要操作时另配有名称的按钮。',anatomy:['识别标记','可访问姓名'],states:[['圆形','适合人物身份。'],['方形','适合组织与团队。']],keyboard:['纯展示无 Tab 停靠点。'],accessibility:['完整姓名通过可访问名称提供。','可视缩写只做身份辅助。'],acceptance:['缩写与完整姓名同步更新。','长姓名不会撑开头像。'],tokens:['primary','surface','radius','fontSize'],related:['badge','grid-list'],examples:[['人物头像','圆形标记个人。',{}],['团队头像','方形标记组织。',{label:'设计团队',shape:'square',size:'large'}],['紧凑头像','适合密集成员列表。',{label:'周宁',size:'small'}]]}),
  asset('badge','徽标','Badge','展示','semantic','在对象旁表达待处理数量或未读提示。',
    {label:'消息',value:8,max:99,dot:false},
    {use:'在消息、任务等有待处理信息的对象上补充数量或提示。',avoid:'不要用徽标代替完整状态说明，不应显示没有业务含义的随机数字。',anatomy:['关联对象','计数或圆点','完整数量说明'],states:[['计数','超过上限以加号标记。'],['圆点','表达有新内容，但仍保留可访问说明。'],['零值','不显示徽标，关联对象仍在。']],keyboard:['展示内容无独立键盘操作。'],accessibility:['屏幕阅读器获得完整数量，而非截断的显示值。','圆点模式提供文字状态。'],acceptance:['超过上限显示 max+，完整数量仍可读。','数量为零时移除徽标。'],tokens:['danger','onPrimary','text','surface','border','radius','fontSize'],related:['avatar','tag'],examples:[['未读计数','展示明确的待处理数量。',{}],['上限处理','视觉显示 99+，保留真实数量。',{value:128}],['圆点提示','只表达有新内容。',{dot:true,value:1}]]}),
  asset('tag','标签','Tag','展示','composed','表达对象属性或状态，可选提供独立的移除动作。',
    {label:'设计规范',theme:'primary',closable:false},
    {use:'用于简短的类别、对象属性、结果状态或已选条件。',avoid:'不要把不可交互标签做成按钮；多选集合使用标签组管理。',anatomy:['标签文本','语义色调','可选移除按钮'],states:[['普通','表达对象属性。'],['语义状态','文字和颜色共同表达状态。'],['已移除','提供恢复入口，便于验证交互。']],keyboard:['Tab 进入移除或恢复按钮。','Enter / Space 移除标签或恢复。'],accessibility:['移除按钮有包含标签名称的可访问名称。','状态不依赖颜色单独表达。'],acceptance:['移除后不残留空标签。','恢复入口可用键盘访问。'],tokens:['primary','success','warning','danger','surface','border','radius','fontSize','focus'],related:['tag-group','badge'],examples:[['内容分类','普通分类标签。',{}],['成功状态','用文字明确状态。',{label:'已发布',theme:'success'}],['可移除条件','适合筛选条件回显。',{label:'设计团队',closable:true}]]}),
  asset('card','卡片','Card','展示','semantic','将同一对象的标题、说明和属性组织成信息单元。',
    {label:'共享设计规范',description:'为多个项目提供一致的颜色、文字和交互规则。',options:['12 项基础规范','3 个项目采用'],bordered:true},
    {use:'用于概览页或结果列表中边界清晰、结构相近的对象。',avoid:'不要给每一小段文字增加卡片，也不要整卡嵌套多个冲突点击区域。',anatomy:['标题','摘要','属性列表','可选边框'],states:[['有边框','在同色背景中区分对象。'],['无边框','通过留白组织内容。']],keyboard:['静态卡片不增加 Tab 停靠点。'],accessibility:['标题与卡片内容在语义上关联。','信息顺序与视觉顺序一致。'],acceptance:['长标题、长描述能正常换行。','属性内容可配置并按顺序展示。'],tokens:['surface','text','muted','border','radius','gap','fontSize'],related:['avatar','tag','descriptions'],examples:[['信息卡片','展示对象摘要及主要属性。',{}],['无边框卡片','适合已有分区背景的内容。',{bordered:false,label:'版本记录',description:'当前采用的共享资产版本。',options:['版本 v1.2','更新于今天']}]]}),
  asset('descriptions','描述列表','Descriptions','展示','semantic','按名称和值成对呈现对象详情。',
    {label:'项目信息',options:['项目名称：设计资产工作台','负责人：林青','状态：进行中','版本：v1.2'],columns:2,bordered:true},
    {use:'用于详情页或弹层中数量有限的静态属性。',avoid:'不要用于需要按多行比较或排序的大数据集合，那些场景应使用表格。',anatomy:['列表标题','属性名','属性值','可选边框'],states:[['单列','适合窄容器与较长内容。'],['多列','适合宽容器中的简短属性。'],['缺少值','用破折号占位，不伪造数据。']],keyboard:['按文档顺序阅读，无独立键盘操作。'],accessibility:['使用 dl / dt / dd 表达名称和值。','字段值缺失时有可读占位。'],acceptance:['每项按第一个冒号分隔名称和值。','窄屏回退单列，不裁切长内容。'],tokens:['surface','text','muted','border','radius','gap','fontSize'],related:['table','card'],examples:[['双列详情','用于项目概览。',{}],['纵向属性','长值在单列中易读。',{columns:1,bordered:false,options:['维护团队：产品设计中心','说明：共享规范用于建立项目一致性','更新时间：']}]]}),
  asset('empty','空状态','Empty','反馈','composed','说明当前没有内容的原因，并给出可执行的下一步。',
    {label:'暂无资产',description:'创建第一项资产后，可以在这里集中维护。',confirmLabel:'创建示例'},
    {use:'用于首次使用、筛选无结果或数据已清空的列表区域。',avoid:'不要把请求失败展示为空状态；错误应说明失败原因并提供重试。',anatomy:['状态图形','原因说明','可选下一步'],states:[['首次使用','引导创建内容。'],['无匹配结果','提示修改筛选条件。']],keyboard:['Tab 聚焦下一步按钮。','Enter / Space 触发并显示本地反馈。'],accessibility:['图形仅装饰，含义通过文字表达。','下一步按钮具有具体动作名称。'],acceptance:['没有按钮文案时不渲染空按钮。','点击下一步产生明确本地事件反馈。'],tokens:['text','muted','primary','surface','border','radius','fontSize','gap','focus'],related:['alert','skeleton'],examples:[['首次使用','引导创建。',{}],['无匹配结果','保留恢复查询的方向。',{label:'没有找到相关资产',description:'试试其他关键词，或放宽筛选条件。',confirmLabel:'清除筛选'}],['静态空状态','没有可提供的动作时只说明原因。',{label:'暂无版本记录',description:'发布新版本后会在此保留记录。',confirmLabel:''}]]}),
  asset('skeleton','骨架屏','Skeleton','反馈','semantic','内容加载期间保留预期结构，降低布局跳动。',
    {label:'内容加载中',rows:3,avatar:true,animated:false},
    {use:'已知内容结构、短时间加载的卡片或列表区域。',avoid:'不要在无法完成或已失败的请求中无限展示骨架，也不要把它当作真实内容。',anatomy:['占位结构','可选头像占位','文本行占位','加载说明'],states:[['静态占位','保留内容结构。'],['动态占位','轻量提示进行中，尊重减少动态设置。']],keyboard:['加载占位不获取焦点。'],accessibility:['结构标记 aria-hidden，容器提供加载说明。','系统偏好减少动态效果时停止动画。'],acceptance:['行数与头像占位可配置。','不会产生虚假的可点击元素。'],tokens:['border','surface','radius','gap'],related:['loading','card','empty'],examples:[['列表占位','包含头像与三行文字。',{}],['文章占位','多行内容而无头像。',{rows:5,avatar:false}],['动态占位','系统减少动态偏好优先。',{animated:true}]]}),
  asset('loading','加载','Loading','反馈','semantic','用非确定进度指示表达正在处理。',
    {label:'正在加载',indicator:'spinner',size:'medium'},
    {use:'无法提供准确百分比的短时任务或内容加载。',avoid:'能获得真实进度时使用进度条；错误发生后应切换为错误反馈。',anatomy:['进行中指示','状态说明'],states:[['旋转指示','适合单一区域加载。'],['点状指示','适合简短等待提示。']],keyboard:['加载状态无独立键盘操作。'],accessibility:['状态文字通过 status 语义提供。','减少动态偏好下仍保留文字和静态形状。'],acceptance:['不同样式均保留可读状态文案。','无虚构进度百分比。'],tokens:['primary','border','text','gap','fontSize'],related:['progress-bar','skeleton'],examples:[['区域加载','表达未知时长等待。',{}],['点状等待','较轻的处理反馈。',{indicator:'dots',label:'正在处理'}],['小尺寸加载','适合紧凑区域。',{size:'small',label:'更新中'}]]}),
  asset('alert','警告提示','Alert','反馈','composed','在当前上下文提供持续可见的说明或操作结果。',
    {label:'资产已更新',description:'共享规范已保存，项目可按需采用新版本。',theme:'success',closable:true},
    {use:'用于当前页面需要持续阅读的成功、说明、警告与错误信息。',avoid:'不要将普通说明做成强打断弹窗，也不要只用颜色区分严重程度。',anatomy:['状态图标','标题','说明','可选关闭入口'],states:[['成功','明确结果及影响。'],['警告','说明风险与可恢复动作。'],['错误','解释问题与修复方向。'],['已关闭','提供恢复示例的入口。']],keyboard:['Tab 聚焦关闭或重新显示。','Enter / Space 执行。'],accessibility:['状态图标与文字共同表达语义。','普通反馈使用 status，错误使用 alert。'],acceptance:['可关闭选项关闭后隐藏整条信息。','恢复入口可回到初始状态。'],tokens:['primary','success','warning','danger','text','muted','surface','border','radius','fontSize','focus'],related:['dialog','empty','tag'],examples:[['成功反馈','说明结果与后续动作。',{}],['风险提示','可持续阅读的提醒。',{label:'存在待处理变更',description:'请检查受影响的组件，再升级项目版本。',theme:'warning',closable:false}],['错误反馈','说明修复方式。',{label:'保存未完成',description:'内容未丢失，请检查配置后重新保存。',theme:'danger'}]]}),
  asset('pagination','分页','Pagination','导航','composed','在有限数据集合中定位页码并切换结果范围。',
    {label:'资产列表分页',total:120,pageSize:10,value:1,disabled:false},
    {use:'适合结果量已知、需要在多页之间反复定位的数据列表。',avoid:'不要让页码变化却保持结果范围文案不变；总数未知时不应虚构页数。',anatomy:['总数与范围','上一页','页码','下一页'],states:[['首页','上一页不可用。'],['中间页','前后翻页均可用。'],['末页','下一页不可用。'],['空集合','显示零条，禁止翻页。']],keyboard:['Tab 在页码按钮间移动。','Enter / Space 切换页码。'],accessibility:['当前页使用 aria-current=page。','前后翻页有具体名称，并在边界禁用。'],acceptance:['页码始终处于实际页数范围内。','切换页码同时更新数据范围与事件反馈。','每页条数与总数变化后页码会重新约束。'],tokens:['primary','onPrimary','surface','text','muted','border','radius','height','fontSize','focus','disabledOpacity'],related:['table','grid-list'],examples:[['标准分页','120 条数据按每页 10 条浏览。',{}],['末页边界','最后一页只展示剩余条数。',{total:23,pageSize:10,value:3}],['空结果','没有可翻页数据。',{total:0,value:1}]]}),
  asset('steps','步骤条','Steps','导航','composed','表达有限步骤的完成进度并引导前进或返回。',
    {label:'创建资产',options:['填写信息','确认规范','完成创建'],value:1,orientation:'horizontal'},
    {use:'有清晰开始和结束、顺序明确的多步任务。',avoid:'不要用步骤条代替页面导航，也不要把当前未完成步骤标成已完成。',anatomy:['步骤序列','当前步骤','完成标记','前进与返回'],states:[['未开始','排在当前步骤之后。'],['进行中','当前任务清晰突出。'],['已完成','在当前步骤之前的任务。'],['流程完成','明确完成，并提供重新演示入口。']],keyboard:['Tab 在返回和下一步按钮间移动。','Enter / Space 前进或返回。'],accessibility:['有序列表表达顺序。','当前步骤使用 aria-current=step。'],acceptance:['当前步骤始终在有效范围内。','首步不能返回，最后一步可完成并重新开始。'],tokens:['primary','onPrimary','surface','text','muted','border','radius','gap','fontSize','focus','disabledOpacity'],related:['progress-bar','tabs','button'],examples:[['横向流程','适合简短步骤。',{}],['纵向流程','适合侧栏或窄容器。',{orientation:'vertical',value:2}],['两步确认','调整流程长度。',{options:['检查内容','确认发布'],value:1}]]}),
  asset('textarea','多行输入','Textarea','输入','composed','收集较长文本，提供字数约束、说明与错误反馈。',
    {label:'资产说明',placeholder:'说明组件的使用场景',description:'建议写明用途、适用范围和注意事项。',value:'',rows:3,maxLength:120,required:false,invalid:false,errorMessage:'请补充资产说明。',disabled:false},
    {use:'用于备注、详细说明、反馈等有换行需求的文本内容。',avoid:'不要用占位符替代可见标签，也不要把长文本塞进单行输入。',anatomy:['标签','多行输入区','辅助说明','字数反馈','错误说明'],states:[['空值','标签和占位提示同时可辨识。'],['已填写','保留换行与已输入内容。'],['错误','解释如何修改。'],['禁用','保留值，禁止编辑。']],keyboard:['Tab 聚焦输入区。','Enter 插入换行，不提交页面。'],accessibility:['标签、说明与错误通过 React Aria 关联。','达到字数上限仍保留已输入内容。'],acceptance:['输入可编辑并显示当前字数。','字数限制、必填与错误状态生效。','编辑配置值后重建预览，不将交互中的临时值写回资产。'],tokens:['surface','text','muted','border','radius','fontSize','lineHeight','focus','danger','disabledOpacity'],related:['text-field','dialog'],examples:[['备注输入','适合填写自由文本。',{}],['已有长文','保留换行和字数。',{value:'适合提交与保存操作。\n同屏仅保留一个主操作。',maxLength:200}],['必填错误','明确需要补充的内容。',{required:true,invalid:true,errorMessage:'请描述这个组件的主要用途。'}]]}),
  asset('drawer','抽屉','Drawer','反馈','composed','从页面边缘展开补充详情，完成后返回原上下文。',
    {label:'查看资产详情',description:'这里展示当前资产的使用说明与维护信息。',confirmLabel:'完成查看',cancelLabel:'关闭',placement:'right',width:400},
    {use:'需要保留底层页面上下文，同时查看较长详情或完成辅助任务。',avoid:'不宜层层嵌套抽屉；确认危险动作应使用明确的确认弹窗。',anatomy:['触发按钮','遮罩','侧边面板','标题与内容','关闭动作'],states:[['关闭','仅保留触发入口。'],['打开','焦点进入面板，并限制在当前模态区域。'],['退出','恢复触发点焦点。']],keyboard:['Enter / Space 打开抽屉。','Tab 在抽屉内循环。','Escape 关闭并返回触发点。'],accessibility:['使用 React Aria Modal / Dialog 管理焦点。','标题与对话区域关联，所有关闭动作可用键盘操作。'],acceptance:['左右位置和宽度可配置。','关闭后焦点返回触发按钮。','浮层继承当前预览的共享变量。'],tokens:['surface','text','muted','border','radius','shadow','primary','onPrimary','height','fontSize','focus'],related:['dialog','popover'],examples:[['右侧详情','保留底层上下文。',{}],['左侧辅助面板','适合左侧入口打开的内容。',{placement:'left',width:340,label:'查看目录说明'}],['宽内容面板','宽度仍受到视口限制。',{width:520,label:'查看维护说明',description:'该组件由设计团队维护；改动时需同步检查引用它的页面模板。'}]]}),
  asset('space','间距','Space','布局','semantic','通过统一间距组织一组同级内容。',
    {label:'操作分组',options:['项目概览','资产规范','版本记录'],gap:12,orientation:'horizontal'},
    {use:'一组同级元素需要稳定的水平或垂直间距时。',avoid:'不要用空格或空节点撑开布局；不同任务分组不应只靠间距区分。',anatomy:['内容容器','同级内容项','间距'],states:[['水平排列','空间不足时换行。'],['垂直排列','保持从上到下的阅读顺序。']],keyboard:['布局容器不获取焦点，内部交互由内容自身定义。'],accessibility:['视觉顺序与 DOM 顺序一致。','缩放后内容允许换行。'],acceptance:['间距和方向改变立即反映在预览。','窄容器不产生横向溢出。'],tokens:['surface','text','border','radius','fontSize'],related:['layout','separator','toolbar'],examples:[['水平分组','12px 间距用于同级内容。',{}],['纵向列表','适合侧栏和窄区域。',{orientation:'vertical',gap:8}],['宽松间距','明确组内留白。',{gap:24}]]}),
  asset('layout','布局','Layout','布局','semantic','组合页头、侧栏、内容区与页脚，建立页面骨架。',
    {label:'项目工作区',description:'主要内容区域',sidebar:true,gap:12},
    {use:'建立同类页面统一的区域结构，再将具体组件放入内容区域。',avoid:'布局只定义区域关系，不应包含特定业务操作或伪造项目数据。',anatomy:['页头','可选侧栏','主内容区','页脚'],states:[['带侧栏','适合多级导航与内容并列。'],['单栏','适合聚焦内容。'],['窄容器','区域保持清晰，文字可换行。']],keyboard:['容器无独立操作，阅读顺序为页头、侧栏、内容和页脚。'],accessibility:['页面骨架用命名区域表达结构。','示例不嵌套第二个全局 main 地标。'],acceptance:['关闭侧栏后主内容自动扩展。','组件间距配置调整后，各区域间距同步。'],tokens:['surface','text','muted','border','radius','fontSize'],related:['space','card','breadcrumbs'],examples:[['工作台布局','页头、侧栏与内容并列。',{}],['聚焦内容','隐藏侧栏用于详情阅读。',{sidebar:false,label:'内容详情'}],['紧凑布局','降低区域间距。',{gap:6,label:'数据管理'}]]}),
];
export const EXTENDED_KINDS = new Set(EXTENDED_COMPONENT_CATALOG.map(item=>item.kind));
const finite=(value,fallback,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Math.trunc(Number(value)):fallback));
/** Bounds prevent user-authored configuration from creating broken previews. */
export function normalizeExtendedConfig(kind,input={}) {
  const item=EXTENDED_COMPONENT_CATALOG.find(asset=>asset.kind===kind);
  const c={...item?.config,...input};
  for(const [key,options] of Object.entries(EXTENDED_ENUM_OPTIONS)) if(key in c&&!options.some(([option])=>option===c[key])) c[key]=item?.config[key]||options[0][0];
  if('options' in c)c.options=Array.isArray(c.options)?c.options.map(String).map(s=>s.trim()).filter(Boolean):[];
  if(kind==='pagination'){c.total=finite(c.total,120,0,1000000);c.pageSize=finite(c.pageSize,10,1,1000);c.value=finite(c.value,1,1,Math.max(1,Math.ceil(c.total/c.pageSize)));}
  if(kind==='steps'){if(!c.options.length)c.options=['开始'];c.value=finite(c.value,1,1,c.options.length);}
  if(kind==='textarea'){c.rows=finite(c.rows,3,2,12);c.maxLength=finite(c.maxLength,120,1,10000);c.value=String(c.value??'').slice(0,c.maxLength);}
  if(kind==='skeleton')c.rows=finite(c.rows,3,1,8);
  if(kind==='descriptions')c.columns=finite(c.columns,2,1,3);
  if(kind==='badge'){c.value=finite(c.value,8,0,1000000);c.max=finite(c.max,99,1,9999);}
  if(kind==='drawer')c.width=finite(c.width,400,260,800);
  if(['space','layout'].includes(kind))c.gap=finite(c.gap,12,0,64);
  return c;
}
