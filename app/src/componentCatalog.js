// These entries correspond to executable React Aria examples in ComponentPreview.jsx.
// The `spec` block intentionally mirrors the useful, portable part of Arco/TDesign
// component documentation: purpose, anatomy, states, keyboard behaviour, API and
// design-token roles. It is data, rather than page copy, so the same contract can
// power the catalog, a future docs page and project acceptance checks.
const propLabels = {
  label: ['string', '可访问名称或展示文案'], placeholder: ['string', '输入为空时的提示'], value: ['string | number | boolean', '初始值或受控值'],
  options: ['string[]', '可供选择的选项'], disabled: ['boolean', '是否禁用交互'], required: ['boolean', '是否要求填写'], multiple: ['boolean', '是否允许多选'],
  variant: ['"base" | "outline" | "dashed" | "text"', '外观变体（参考 TDesign）'], size: ['"small" | "medium" | "large"', '控件尺寸'],
  theme: ['"default" | "primary" | "success" | "warning" | "danger"', '语义主题'], shape: ['"rectangle" | "square" | "round" | "circle"', '控件形状'],
  type: ['"button" | "submit" | "reset"', '原生按钮行为'], tag: ['"button" | "a" | "div"', '渲染语义元素'], block: ['boolean', '是否占满容器宽度'], loading: ['boolean', '是否处于加载状态'], ghost: ['boolean', '是否使用透明表面'],
  href: ['string', '链接目的地'], target: ['"_self" | "_blank"', '打开目的地的窗口'], rel: ['string', '链接关系声明'], external: ['boolean', '是否为外部目的地'], icon: ['boolean | Icon', '是否显示前置图标'], suffix: ['boolean | Icon', '是否显示后置图标'], status: ['"normal" | "success" | "warning" | "error"', '链接状态'], hoverable: ['boolean', '是否响应悬停反馈'], underline: ['"always" | "hover" | "none"', '下划线策略'],
  min: ['number', '允许的最小值'], max: ['number', '允许的最大值'], step: ['number', '步进值'], orientation: ['"horizontal" | "vertical"', '排列方向'], description: ['string', '补充说明'], invalid: ['boolean', '是否显示校验错误'], errorMessage: ['string', '校验错误文案'], confirmLabel: ['string', '确认操作文案'], cancelLabel: ['string', '取消操作文案'], fieldLabel: ['string', '弹窗内字段标签'], tone: ['"danger" | "primary"', '确认操作的语义强调'],
};
const tokenRolesByKind = {
  button: ['primary', 'primaryHover', 'primaryPressed', 'onPrimary', 'success', 'warning', 'danger', 'radius', 'height', 'fontSize', 'focus', 'disabledOpacity'],
  link: ['primary', 'primaryHover', 'primaryPressed', 'success', 'warning', 'danger', 'focus', 'fontSize', 'disabledOpacity', 'gap'], 'text-field': ['surface', 'border', 'focus', 'radius', 'height', 'fontSize', 'disabledOpacity'],
  select: ['surface', 'border', 'primary', 'focus', 'radius', 'height', 'shadow'], dialog: ['surface', 'text', 'muted', 'shadow', 'radius'],
  tabs: ['text', 'muted', 'primary', 'border', 'focus', 'fontSize'], table: ['surface', 'text', 'muted', 'border', 'primary', 'focus', 'fontSize'],
};
const sourceByKind = {
  link: [{ label: 'Arco Link 设计规范', href: 'https://arco.design/docs/spec/link' }],
  button: [{ label: 'TDesign Button 组件规范', href: 'https://tdesign.tencent.com/vue-next/components/button' }],
};
const relatedByKind = {
  button: ['toggle-button', 'link'], 'toggle-button': ['button', 'switch'], link: ['button', 'breadcrumbs'], breadcrumbs: ['link', 'tabs'], tabs: ['breadcrumbs', 'disclosure-group'],
  'text-field': ['search-field', 'number-field'], 'search-field': ['text-field', 'combo-box'], select: ['combo-box', 'list-box'], 'combo-box': ['select', 'list-box'],
  checkbox: ['checkbox-group', 'switch'], 'checkbox-group': ['radio-group', 'tag-group'], 'radio-group': ['checkbox-group', 'select'], dialog: ['alert-dialog', 'popover'], 'alert-dialog': ['dialog'], table: ['grid-list', 'list-box'],
  calendar: ['date-picker', 'range-calendar'], 'date-picker': ['calendar', 'date-range-picker'], slider: ['range-slider'], 'range-slider': ['slider'],
};
const useGuidance = {
  '基础操作': '用于触发一个可预期的动作；同一视图只保留一个最主要动作。', '导航组织': '用于表达位置、层级或在同一上下文中切换内容。', '表单输入': '用于收集或调整用户输入，并配合标签与错误反馈。',
  '选择集合': '用于从有限集合中选择一项或多项，选项应可被键盘访问。', '数据展示': '用于呈现结构化信息；需要提供空、加载和错误状态。', '内容组织': '用于分组和渐进披露内容，避免隐藏关键操作。',
  '反馈浮层': '用于反馈、补充说明或需要用户确认的上下文内容。', '日期时间': '用于输入或选择日期时间，并明确格式和时区。', '颜色编辑': '用于编辑颜色值，需同步文本输入和视觉预览。', '文件操作': '用于选择或拖放本地文件，并明确文件限制。',
};
const examplesByKind = {
  button: [
    { name: '主要提交', note: '用于页面唯一的主动作。', config: { label: '保存设置', variant: 'base', theme: 'primary', icon: 'save', suffix: 'none' } },
    { name: '次要操作', note: '与主动作并列时降低视觉权重。', config: { label: '取消', variant: 'outline', theme: 'default', icon: 'none', suffix: 'none' } },
    { name: '危险操作', note: '删除、归档等有影响的动作需要明确后果。', config: { label: '删除项目', variant: 'base', theme: 'danger', icon: 'trash', suffix: 'none' } },
    { name: '加载提交', note: '提交后暂时阻止重复操作。', config: { label: '发布版本', variant: 'base', theme: 'primary', loading: true, icon: 'none', suffix: 'none' } },
    { name: '图标按钮', note: '仅在图标含义明确时使用，并保留可访问名称。', config: { label: '新增', variant: 'base', theme: 'primary', shape: 'square', icon: 'plus', suffix: 'none' } },
  ],
  link: [
    { name: '同站导航', note: '指向工作区中的页面或资源。', config: { label: '查看项目详情', href: '/projects/1', status: 'normal', hoverable: true, underline: 'hover', target: '_self', external: false, icon: false, suffix: true } },
    { name: '外部资源', note: '离开当前工作区时标识外部目的地。', config: { label: '查看 React Aria 文档', href: 'https://react-aria.adobe.com/', status: 'normal', hoverable: true, underline: 'hover', target: '_blank', external: true, icon: false, suffix: false } },
    { name: '状态链接', note: '状态色用于补充语义，不能取代链接文本。', config: { label: '检查失败 · 查看详情', href: '/checks/failed', status: 'error', hoverable: true, underline: 'always', target: '_self', external: false, icon: false, suffix: true } },
    { name: '弱化链接', note: '在辅助说明中降低视觉强调，但仍应保持可发现。', config: { label: '了解更多', href: '/docs', status: 'normal', hoverable: false, underline: 'none', target: '_self', external: false, icon: false, suffix: false } },
  ],
  'text-field': [
    { name: '普通输入', note: '标签说明输入内容，适合名称、标题等单行信息。', config: { label: '项目名称', placeholder: '例如：设计资产工作台', value: '', required: false, description: '使用清晰、可识别的项目名称。', invalid: false, errorMessage: '' } },
    { name: '必填输入', note: '必填字段在标签中说明要求，并保留错误反馈位置。', config: { label: '联系人邮箱', placeholder: 'name@example.com', value: '', required: true, description: '用于发送项目通知。', invalid: false, errorMessage: '' } },
    { name: '已有内容', note: '编辑场景保留已保存内容，让用户知道当前值。', config: { label: '资产名称', placeholder: '输入资产名称', value: '标准按钮', required: false, description: '修改后保存即可更新引用。', invalid: false, errorMessage: '' } },
    { name: '错误反馈', note: '校验失败时同时保留错误文案和输入位置。', config: { label: '联系人邮箱', placeholder: 'name@example.com', value: 'name@', required: true, description: '请输入可接收通知的邮箱地址。', invalid: true, errorMessage: '请输入完整的邮箱地址。' } },
  ],
  select: [
    { name: '单选下拉', note: '选项数量有限且不适合同时展示时使用。', config: { label: '资产类型', placeholder: '选择资产类型', options: ['组件', '交互模式', '页面模板'], value: '', description: '选择一种资产类型。', disabled: false, required: false } },
    { name: '已有选择', note: '编辑场景显示当前选择，并允许重新选择。', config: { label: '所属团队', placeholder: '选择团队', options: ['设计团队', '产品团队', '研发团队'], value: '设计团队', description: '当前资产所属的维护团队。', disabled: false, required: false } },
    { name: '禁用选择', note: '依赖前置条件尚未满足时禁用，并解释原因。', config: { label: '发布渠道', placeholder: '请先选择项目', options: ['设计评审', '开发交付'], value: '', description: '请先选择项目后再选择发布渠道。', disabled: true, required: false } },
  ],
  tabs: [
    { name: '内容分组', note: '在同一上下文内切换相关内容，不用于跨任务导航。', config: { label: '项目设置', options: ['基本信息', '成员权限', '版本记录'], value: '基本信息', disabled: false } },
    { name: '键盘切换', note: '焦点进入标签列表后，使用方向键切换并保留当前面板。', config: { label: '资产详情', options: ['预览', '规范', '引用'], value: '规范', disabled: false } },
  ],
  dialog: [
    { name: '编辑个人资料', note: '聚焦一项明确任务，完成后返回触发位置。', config: { label: '编辑个人资料', description: '更新后将同步到当前工作区。', fieldLabel: '显示名称', value: '林青', confirmLabel: '保存修改' } },
    { name: '编辑资产名称', note: '短表单只保留完成任务所需的字段和操作。', config: { label: '编辑资产名称', description: '名称会同步更新引用位置。', fieldLabel: '资产名称', value: '标准按钮', confirmLabel: '保存名称' } },
  ],
  'alert-dialog': [
    { name: '归档确认', note: '说明归档后的可恢复路径，再提供确认与取消。', config: { label: '归档资产', description: '归档后可在归档列表中恢复。', confirmLabel: '确认归档', cancelLabel: '取消', tone: 'primary' } },
    { name: '删除确认', note: '不可逆操作需要明确后果，并使用危险语义强调。', config: { label: '删除资产', description: '删除后无法恢复，请确认是否继续。', confirmLabel: '确认删除', cancelLabel: '取消', tone: 'danger' } },
  ],
  table: [
    { name: '可排序成员', note: '列头提供姓名和角色的排序反馈，行内数据保持稳定。', config: { label: '成员列表', options: ['林青', '陈默', '周宁'], disabled: false } },
    { name: '批量选择成员', note: '选择后只反馈已选数量，并提供取消选择路径。', config: { label: '成员列表', options: ['林青', '陈默', '周宁'], disabled: false } },
  ],
};
// Reference examples express supported configurations, never unimplemented product flows.
const example = (name, note, config, group = '使用场景') => ({name, note, config, group});
examplesByKind.button = [
  ...examplesByKind.button.map((item, index) => ({...item, group: ['基础形式', '基础形式', '主题', '状态', '形状尺寸'][index]})),
  example('虚线按钮', '用于添加可重复的内容，与已有实体区分。', {label:'添加一项',variant:'dashed',theme:'primary',icon:'plus'}, '基础形式'),
  example('文字按钮', '适合表格行内或辅助动作，保留可见焦点。', {label:'编辑',variant:'text',theme:'primary'}, '基础形式'),
  example('默认主题', '使用中性表面表达常规动作。', {label:'查看记录',theme:'default'}, '主题'),
  example('成功主题', '已明确语境的完成动作，使用文案与图标辅助语义。', {label:'确认完成',theme:'success',icon:'check'}, '主题'),
  example('警示主题', '提醒用户动作需要关注，说明不能只依赖颜色。', {label:'重新检查',theme:'warning'}, '主题'),
  example('圆角按钮', '在相同任务中保持形状策略一致。', {label:'关注',shape:'round'}, '形状尺寸'),
  example('圆形图标按钮', '用于紧凑操作，标签仍作为可访问名称。', {label:'搜索',shape:'circle',icon:'search'}, '形状尺寸'),
  example('小尺寸', '适用于密集列表或工具栏。', {label:'批量操作',size:'small'}, '形状尺寸'),
  example('大尺寸', '用于空间充足的关键操作区。', {label:'开始创建',size:'large'}, '形状尺寸'),
  example('禁用状态', '前置条件未满足时阻止操作，业务页面还需解释原因。', {label:'请先选择文件',disabled:true}, '状态'),
  example('透明表面', '透明表面保留边框和主题文字，需检查宿主背景对比度。', {label:'查看详情',ghost:true,variant:'outline'}, '图标组合'),
  example('宽度铺满', '适合窄容器中的明确主操作。', {label:'继续',block:true,suffix:'arrow-right'}, '图标组合'),
  example('前后图标', '图标辅助动作含义；标签承担主要语义。', {label:'下载文件',icon:'download',suffix:'arrow-right'}, '图标组合'),
];
Object.assign(examplesByKind, {
  'toggle-button': [example('未收藏', '允许用户主动选择收藏，预览只改变本地选中状态。', {label:'收藏',value:false}, '选择状态'), example('已收藏', '再次触发取消收藏，勾选反馈保持可见。', {label:'收藏',value:true}, '选择状态')],
  breadcrumbs: [example('资源层级', '末项表示当前位置，上游项演示返回路径。', {label:'资源路径',options:['资源库','组件','按钮']}, '层级'), example('两级路径', '路径较短时保留上游与当前位置即可。', {label:'设置路径',options:['工作区','团队设置']}, '层级')],
  menu: [example('资源操作', '收纳低频动作，预览反馈动作名称。', {label:'更多操作',options:['复制链接','创建副本','归档']}, '操作集合'), example('导出选项', '用动作名称区分输出方式；当前只演示选择，不生成文件。', {label:'导出',options:['导出图片','导出配置','复制说明']}, '操作集合')],
  toolbar: [example('文字格式', '多个格式可以独立开启或关闭。', {label:'文字格式',options:['加粗','斜体','下划线']}, '组合操作'), example('辅助视图', '同一区域的视图开关放入一个工具栏。', {label:'画布辅助',options:['网格','参考线','标尺']}, '组合操作')],
  'search-field': [example('空搜索', '输入关键词后按 Enter，当前样本报告关键词。', {label:'搜索资产',placeholder:'输入名称或关键词',value:''}, '输入状态'), example('继续搜索', '保留已有关键词，允许修改或清空。', {label:'搜索文件',placeholder:'输入文件名称',value:'设计规范'}, '输入状态')],
  'number-field': [example('整数数量', '按 1 增减，达到边界后对应按钮不可继续增减。', {label:'成员数量',value:5,min:0,max:20,step:1}, '数值约束'), example('固定步长', '以 5 为步长调整批次数量。', {label:'每批数量',value:20,min:5,max:100,step:5}, '数值约束')],
  checkbox: [example('未勾选', '独立勾选是否接收邮件通知。', {label:'接收邮件通知',value:false}, '选择状态'), example('已勾选', '编辑场景显示已有偏好，允许取消。', {label:'接收邮件通知',value:true}, '选择状态')],
  'checkbox-group': [example('通知渠道', '可同时选择多个独立渠道。', {label:'通知渠道',options:['站内通知','电子邮件','移动推送'],required:false}, '选项集合'), example('导出内容', '从待导出内容中勾选多个，预览报告当前集合。', {label:'包含内容',options:['组件规范','变量配置','引用关系'],required:false}, '选项集合')],
  'radio-group': [example('访问范围', '互斥选项保持全部可见，默认选中第一项。', {label:'访问范围',options:['仅自己','团队成员','公开'],required:false}, '选项集合'), example('交付格式', '同一次选择只保留一种格式。', {label:'交付格式',options:['设计说明','组件配置','演示页面'],required:false}, '选项集合')],
  switch: [example('关闭偏好', '切换立即修改样本状态，无需单独提交。', {label:'桌面通知',value:false}, '选择状态'), example('启用偏好', '显式展示已启用状态，标签保持不变。', {label:'桌面通知',value:true}, '选择状态')],
  'combo-box': [example('查找成员', '在有限人员集合中输入过滤并选中。', {label:'查找成员',placeholder:'输入成员名称',options:['林青','陈默','周宁']}, '搜索选择'), example('查找地区', '输入文本缩小可选范围，当前不接受集合外的新值。', {label:'所在地区',placeholder:'输入城市',options:['北京','上海','深圳','杭州']}, '搜索选择')],
  'list-box': [example('文件夹单选', '选项持续可见，选择后报告当前条目。', {label:'选择文件夹',options:['个人文件','团队文件','共享资源']}, '可见单选'), example('主题方案', '直接比较几个短选项，无需展开浮层。', {label:'选择主题',options:['跟随系统','浅色','深色']}, '可见单选')],
  'grid-list': [example('成员多选', '使用行内复选框选择多位成员。', {label:'团队成员',options:['林青 · 设计师','陈默 · 产品经理','周宁 · 工程师']}, '行选择'), example('维护人多选', '选择多位维护人；当前行内头像由名称首字生成。', {label:'选择维护人',options:['顾安 · 设计维护','宋晓 · 文档维护','周然 · 开发维护','叶清 · 测试维护']}, '行选择')],
  tree: [example('项目目录', '根节点下展示一层文件，可折叠和单选。', {label:'项目文件',options:['设计稿','需求说明','交付文档']}, '层级选择'), example('团队目录', '保留根目录与直接子项，当前不支持自定义任意深度。', {label:'团队资料',options:['品牌规范','组件说明']}, '层级选择')],
  'tag-group': [example('筛选条件', '移除已选条件，全部移除后显示空提示。', {label:'已选条件',options:['已发布','基础组件','本周更新']}, '移除操作'), example('关键词', '将短关键词作为可移除条目展示。', {label:'关键词',options:['设计系统','无障碍','组件规范']}, '移除操作')],
  disclosure: [example('默认收起', '补充内容按需展开，主任务不依赖隐藏内容。', {label:'查看使用说明',value:false}, '展开状态'), example('默认展开', '重要说明在首次进入时直接可见。', {label:'使用注意事项',value:true}, '展开状态')],
  'disclosure-group': [example('常见问题', '多个题目按组组织，面板内容为当前样本固定说明。', {label:'常见问题',options:['如何添加成员？','如何修改权限？','如何导出文件？']}, '分组展开'), example('交付帮助', '以短标题区分说明区块，保持触发区清晰。', {label:'交付帮助',options:['查看资产说明','了解版本策略']}, '分组展开')],
  tooltip: [example('补充说明', '悬停或键盘聚焦显示简短提示，不承载交互操作。', {label:'自动保存',description:'修改会保留在当前工作区。'}, '轻量说明'), example('术语解释', '为专业术语提供一句解释，不替代主内容。', {label:'共享变量',description:'被多个组件共同引用的设计值。'}, '轻量说明')],
  popover: [example('成员说明', '在触发点附近显示成员信息，点击外部可关闭。', {label:'查看成员信息',description:'林青 · 设计师 · 当前在线'}, '上下文信息'), example('维护人说明', '对另一位成员提供上下文说明，弹层标题固定为成员信息。', {label:'查看维护人',description:'周宁 · 工程师 · 组件维护人'}, '上下文信息')],
  slider: [example('连续比例', '在 0 到 100 内以 1 为步长调整。', {label:'缩放比例',value:60,min:0,max:100,step:1}, '数值约束'), example('分级调整', '使用固定步长 10 表达等级调整。', {label:'预览强度',value:30,min:0,max:100,step:10}, '数值约束')],
  'range-slider': [example('常规区间', '两个滑块分别控制开始值和结束值。', {label:'显示范围',value:[20,80],min:0,max:100,step:1}, '范围约束'), example('价格区间', '以 50 为步长调整起止值，滑块不互相越过。', {label:'价格范围',value:[100,350],min:0,max:500,step:50}, '范围约束')],
  'progress-bar': [example('处理中', '展示已知百分比的任务进度，数据由配置提供。', {label:'文件整理',value:64}, '进度阶段'), example('已完成', '100 表示样本进度完成；不会实际运行任务。', {label:'文件整理',value:100}, '进度阶段')],
  meter: [example('常规占用', '度量当前资源占用，不表示任务执行进度。', {label:'存储空间占用',value:42}, '测量值'), example('较高占用', '显示较高的度量值；阈值报警不在当前实现中。', {label:'存储空间占用',value:88}, '测量值')],
  separator: [example('横向分组', '分隔上下两组内容，当前示例内容为固定文案。', {label:'内容分隔',orientation:'horizontal'}, '方向'), example('纵向分组', '分隔并排内容，不充当交互控件。', {label:'操作区分隔',orientation:'vertical'}, '方向')],
  calendar: [example('单日选择', '日历直接展开，方向键移动日期后确认。', {label:'选择日期',value:'2026-09-17'}, '日期选择'), example('跨月浏览', '从另一月份开始，使用前后按钮切换月份。', {label:'交付日期',value:'2026-10-08'}, '日期选择')],
  'range-calendar': [example('计划周期', '初始区间为起始日到七天后，进入样本可重新选择起止日期。', {label:'计划日期范围',value:'2026-09-17'}, '范围选择'), example('下一期安排', '改变初始起点；当前配置不单独保存初始结束日。', {label:'下一期日期范围',value:'2026-10-08'}, '范围选择')],
  'date-field': [example('分段录入', '逐段输入年、月、日，格式由中文区域规则呈现。', {label:'开始日期',value:'2026-09-17',required:false}, '日期输入'), example('必填日期', '标记必填语义，完整提交校验由业务表单负责。', {label:'交付日期',value:'2026-10-08',required:true}, '日期输入')],
  'date-picker': [example('日期预约', '支持分段输入，也可打开日历选择。', {label:'预约日期',value:'2026-09-17',required:false}, '日期输入'), example('锁定日期', '保留当前日期但阻止编辑和展开。', {label:'已锁定的交付日期',value:'2026-10-08',disabled:true}, '日期输入')],
  'date-range-picker': [example('有效周期', '初始结束日为起点七天后，输入和日历选择共享区间。', {label:'有效日期',value:'2026-09-17',required:false}, '范围输入'), example('审核周期', '进入样本后可修改两个日期；配置当前只持久化初始起点。', {label:'审核日期',value:'2026-10-08',required:true}, '范围输入')],
  'time-field': [example('上午提醒', '仅输入小时和分钟，不包含日期或时区。', {label:'提醒时间',value:'09:30',required:false}, '时间输入'), example('下午提醒', '使用 24 小时输入值，由中文区域规则格式化显示。', {label:'每日提醒',value:'18:00',required:false}, '时间输入')],
  'color-area': [example('品牌蓝调色', '二维区域调整饱和度和亮度，下方同步十六进制值。', {label:'调整蓝色',value:'#315BD6'}, '颜色通道'), example('强调色调色', '从绿色开始调整，色相保持初始色相。', {label:'调整绿色',value:'#168566'}, '颜色通道')],
  'color-slider': [example('蓝色色相', '色相通道滑条保留其他颜色通道。', {label:'品牌色色相',value:'#315BD6'}, '颜色通道'), example('暖色色相', '从暖色开始拖动色相，预览报告十六进制结果。', {label:'强调色色相',value:'#CF7130'}, '颜色通道')],
  'color-field': [example('颜色文本输入', '以十六进制值编辑颜色，无效文本不会直接变成新颜色。', {label:'品牌色',value:'#315BD6'}, '颜色输入'), example('锁定色值', '只展示已确定的色值，不允许编辑。', {label:'锁定品牌色',value:'#168566',disabled:true}, '颜色输入')],
  'color-picker': [example('品牌色编辑', '二维区域、色相滑条和文本输入同步同一个颜色。', {label:'主题颜色',value:'#315BD6'}, '联动调色'), example('状态色编辑', '更改初始颜色后验证三个输入入口的联动。', {label:'成功颜色',value:'#168566'}, '联动调色')],
  'color-swatch': [example('品牌色展示', '同时显示色块、名称和十六进制值，不响应选择。', {label:'品牌蓝',value:'#315BD6'}, '静态展示'), example('语义色展示', '颜色名称传达语义，避免只凭颜色区分。', {label:'成功绿',value:'#168566'}, '静态展示')],
  'color-swatch-picker': [example('品牌预设', '在已提供色值中选一个，选中状态有轮廓反馈。', {label:'常用颜色',value:'#315BD6',options:['#315BD6','#168566','#CF7130','#A1467B']}, '预设选择'), example('中性色预设', '展示中性色方案，初始值来自选项集合。', {label:'文字颜色',value:'#334155',options:['#0F172A','#334155','#64748B','#94A3B8']}, '预设选择')],
  'file-trigger': [example('选择单个文件', '打开系统选择器，样本仅显示所选文件名称。', {label:'选择文件',multiple:false}, '文件数量'), example('选择多个文件', '允许一次多选，当前不上传、不保存文件内容。', {label:'选择多个文件',multiple:true}, '文件数量')],
  'drop-zone': [example('单文件拖放', '接收一个文件，多文件拖入时只保留第一项。', {label:'拖放一个文件到这里',multiple:false}, '文件数量'), example('批量拖放', '同时接受多个文件，也可使用浏览按钮。', {label:'拖放多个文件到这里',multiple:true}, '文件数量')],
});
examplesByKind.table[1] = example('批量选择成员', '选中多位成员后检查已选数量，并使用取消选择恢复。', {label:'交付团队',options:['林青','陈默','周宁','叶清','宋晓'],disabled:false}, '行选择');
examplesByKind.table.push(example('空数据', '没有成员时保留列头并显示空提示。', {label:'待加入成员',options:[],disabled:false}, '数据状态'));

// Dedicated documentation samples are fixtures. They must not inherit a draft's
// transient disabled/value/loading state when a user is editing another variant.
const exampleDefaultsByKind = {
  button: { label: '保存设置', variant: 'base', theme: 'primary', size: 'medium', shape: 'rectangle', type: 'button', block: false, loading: false, ghost: false, disabled: false, icon: 'none', suffix: 'none' },
  link: { label: '查看详情', href: '/docs', status: 'normal', hoverable: true, underline: 'hover', target: '_self', rel: '', external: false, icon: false, suffix: true, disabled: false },
  'text-field': { label: '显示名称', placeholder: '请输入', value: '', required: false, description: '', invalid: false, errorMessage: '', disabled: false, size: 'medium' },
  select: { label: '请选择', placeholder: '请选择', options: ['选项一', '选项二', '选项三'], value: '', description: '', disabled: false, required: false, size: 'medium' },
  tabs: { label: '内容导航', options: ['概览', '规范', '引用'], value: '概览', disabled: false },
  dialog: { label: '编辑资产', description: '更新后将同步到当前工作区。', fieldLabel: '名称', value: '', confirmLabel: '保存修改', disabled: false },
  'alert-dialog': { label: '确认操作', description: '请确认是否继续。', confirmLabel: '确认', cancelLabel: '取消', tone: 'primary', disabled: false },
  table: { label: '成员列表', options: ['林青', '陈默', '周宁'], disabled: false },
};
// Contracts describe the local executable sample. General library capabilities are
// deliberately not advertised as if this workbench already implemented them.
const contract = (whenToUse, avoid, anatomy, keyboard, acceptance, states) => ({
  whenToUse, avoid, anatomy: anatomy.split('|'), keyboard: keyboard.split('|'), acceptance: acceptance.split('|'),
  states: states.split('|').map(item => { const [name, note] = item.split('：'); return {name, note}; }),
});
const contractsByKind = {
  button: contract('在当前上下文执行保存、提交、确认等明确动作；外观与语义主题分别选择。','导航使用链接；同一区域避免多个主动作争抢注意力；图标按钮必须有名称。','原生按钮|文案|可选前后图标|加载指示|焦点环','Tab 聚焦|Enter / Space 触发|禁用不触发，加载不重复提交','四种外观与五种主题可独立组合。|同一操作区按主次和任务顺序排布；低频次要动作收纳到菜单，避免多个主按钮竞争。|仅图标形状仍提供可访问名称。|加载与禁用阻止重复动作；样本报告本地事件。','默认：清楚显示操作名称。|悬停：表面反馈保持尺寸稳定。|键盘聚焦：可见焦点环指示当前操作。|加载中：显示进行中指示并阻止重复操作。|禁用：保留名称且不能触发。'),
  link: contract('前往有明确地址的页面、资源或外部文档。','不要承载删除、保存等动作；不得以状态颜色代替目的地说明。','链接文案|href 目的地|可选图标|外部标识|焦点环','Tab 聚焦|Enter 触发导航演示；预览不会离开工作台','外部新窗口链接包含明确标识和安全关系。|禁用时不能触发导航。|修改状态或下划线不改变 href。','默认：文字说明目的地。|悬停：按配置呈现下划线或反馈。|键盘聚焦：焦点可见且不依赖悬停。|禁用：目的地不可操作。|外部 / 状态：图标和文案补充颜色语义。'),
  'toggle-button': contract('用紧凑按钮切换一个独立的开关状态，如收藏。','不要把瞬时动作做成切换状态，也不要用同一按钮选择多个互斥项。','按钮标签|勾选指示|按下状态','Tab 聚焦|Enter / Space 切换选中','选中和未选中都保持同一标签。|重复触发可恢复初始状态，并反馈收藏结果。','未选中：不显示勾选。|已选中：显示勾选并暴露按下语义。|禁用：保持当前选择且不切换。'),
  breadcrumbs: contract('在有明确父子层级的资源页表达位置，并返回上级。','不要用面包屑表示步骤进度；当前样本只报告层级，不执行真实路由。','路径容器|上游链接|分隔符|当前位置','Tab 移动至可操作路径项|Enter 触发上游位置演示','末项表达当前位置。|路径顺序与实际层级一致；触发后显示对应项名称。','当前位置：末项提供当前位置语义。|上游项：可聚焦并演示返回位置。'),
  tabs: contract('在同一任务中切换彼此相关的内容面板。','不要代替跨页面路由；每个标签必须有对应面板。','标签列表|标签项|选中指示|关联面板','Tab 进入标签组|← / → 切换横向标签','value 指定有效初始标签；无效值回退至首项。|切换标签后仅对应面板展示，焦点与选中状态可辨认。','默认：首项或指定项对应的面板可见。|选中：标签与面板关联一致。|禁用：整组标签不可切换。'),
  menu: contract('将同一对象的低频动作收纳到一个触发按钮下。','不要让常用主动作只存在于菜单；样本动作只反馈名称。','触发按钮|弹出菜单|操作项','Enter / Space 打开|↑ / ↓ 移动，Enter 执行|Escape 关闭','打开后可用方向键访问每个动作。|执行动作显示对应名称，关闭后返回触发上下文。','关闭：只展示触发按钮。|展开：动作列表可访问。|禁用：触发器不可打开。'),
  toolbar: contract('集中安排同一编辑区域的多个独立格式或视图开关。','不要将这些开关当作单选组；每项均独立切换。','工具栏容器|切换按钮|各项选中状态','Tab 进入工具栏|← / → 移动按钮|Enter / Space 切换当前项','每个工具拥有明确名称。|切换一项不强制清除其他项；事件指出开关结果。','默认：工具独立未选中。|已选中：相应工具保留按下状态。|禁用：全部工具不能切换。'),
  'text-field': contract('录入名称、标题等短文本，需要明确标签和辅助说明。','占位符不能替代标签；本地样本的 invalid 是外部配置，未执行邮箱等业务校验。','字段标签|输入框|辅助说明|错误文案','Tab 聚焦|输入或编辑文本','输入变化能在样本反馈中识别。|invalid 为真时显示指定错误文案且保留输入。|必填语义交给所属表单完成提交校验。','空值：展示占位提示。|有值：显示完整可编辑文本。|错误：错误文案与字段关联。|禁用：保留值且不能编辑。'),
  'search-field': contract('输入查询关键词，提交后执行搜索或清空重新输入。','当前样本没有搜索结果、建议列表或远程请求，不能当成完整搜索页。','字段标签|搜索图标|输入框|清除按钮','Tab 聚焦|Enter 提交当前关键词|Escape 清空已有关键词','Enter 反馈实际关键词，空词提示补充输入。|清除后输入内容为空。','空值：展示输入提示。|有值：可提交或清除关键词。|禁用：不能修改或提交。'),
  'number-field': contract('输入有上下界和步长的数量，允许精确键入或逐步调整。','不要用于手机号、编号等非算术字符串；业务单位需由页面说明。','字段标签|减量按钮|数字输入|增量按钮','Tab 聚焦数字输入|↑ / ↓ 按步长调整|可直接键入数值','增减遵循 min、max 与 step。|到边界后对应方向不能继续增减。','可编辑：数值可键入或步进。|边界：最小最大值约束生效。|禁用：输入与步进操作不可用。'),
  checkbox: contract('表达一个可独立勾选或取消的选项。','即时系统启停优先使用开关；不可只显示一个无标签小方框。','勾选框|勾选指示|标签','Tab 聚焦|Space 勾选或取消','标签与控件关联。|value 的布尔值准确初始化勾选状态，重复触发可取消。','未选中：框内无勾选。|已选中：框内显示勾选。|禁用：保留值但不能改变。'),
  'checkbox-group': contract('让用户从可见集合中选择任意多个独立项。','互斥选项使用单选组；当前配置不支持预置已选集合。','组标签|多个复选项|组级校验位置','Tab 依次访问选项|Space 勾选或取消当前项','多项可以同时被选中。|取消最后一项后事件报告无选择。','无选择：全部选项未勾选。|多选：多个勾选同时存在。|禁用：整组不能修改。'),
  'radio-group': contract('提供少量互斥选项，允许用户同时比较。','不要用于可多选内容；当前默认选择第一项，没有配置独立的默认选中值。','组标签|单选项|唯一选中指示','Tab 进入单选组|方向键在选项间移动并选择','每次只选中一个条目。|初始第一项有选中语义，切换后事件给出新值。','默认选中：首项被选中。|切换：选中值与焦点同步。|禁用：整组保持选择且不能修改。'),
  switch: contract('立即启用或停用一项偏好，不需要额外提交。','需要先收集多个选项再提交时使用复选框；标签不随启停变为相反含义。','开关轨道|滑块|标签','Tab 聚焦|Space 切换启用状态','开关位置与选中语义一致。|value 初始化生效，切换后报告布尔结果。','关闭：滑块位于起点。|开启：滑块位于终点并提供选中语义。|禁用：保持当前值。'),
  select: contract('从有限集合选择一项，在保持页面紧凑的同时显示当前值。','需要搜索时使用组合框；不要用占位项伪装成有效选项。','标签|触发器|当前值 / 占位|弹出列表|选项|帮助说明','Enter / Space 打开列表|↑ / ↓ 移动，Enter 选择|Escape 关闭列表','value 必须来自 options，否则显示占位。|空 options 时显示暂无选项。|选择结果可重新修改。','未选择：占位提示可见。|已选择：当前选项可见。|展开：选项可用键盘选择。|禁用：触发器不可操作。'),
  'combo-box': contract('从已知选项中通过输入过滤后选择，适合较长集合。','不是自由输入新标签的控件，也未实现异步远程搜索。','标签|文本输入|展开按钮|过滤列表','输入文字过滤|↑ / ↓ 移动，Enter 选择|Escape 收起列表','输入后只显示匹配选项。|无匹配时显示空提示，选择后反馈该选项。','空输入：展示可选集合。|过滤：列表随关键词变化。|无匹配：显示没有匹配结果。|禁用：不能输入和选择。'),
  'list-box': contract('让有限选项持续可见并选择一项。','多选需求使用网格列表等已支持多选的组件；当前未提供已选值配置。','列表容器|可选择项|选中反馈','方向键移动列表焦点|Enter / Space 选择当前项','一次只选择一个条目。|再次选另项时旧选择被替换，反馈显示新项。','未选中：条目可浏览。|选中：唯一当前项可辨认。|禁用：全部条目不可选择。'),
  'grid-list': contract('展示带复选框、首字头像与文字的多选列表。','当前行结构固定，不宣称支持自定义卡片栅格或任意行内操作。','列表行|复选框|首字头像|名称','方向键移动行焦点|Space 选择|Tab 可访问行内选择控件','多个行可同时选择。|复选框与行选择结果一致，禁用后不能改变集合。','未选择：全部行未勾选。|多选：选择集合包含多个条目。|禁用：列表项不可选择。'),
  table: contract('按姓名与角色两列比较成员，并进行排序和多行选择。','当前表头与角色示例固定；任意列配置、远程分页和加载不属于当前能力。','表头|姓名列|角色列|行复选框|全选控件|已选数量','方向键访问行列|Space 选择行|聚焦可排序列头后 Enter 排序','排序有明确方向标识。|多选数量准确，取消选择可恢复为空。|options 为空时保留表头并显示暂无成员。','有数据：表头与数据行对应。|排序：行顺序和排序方向同步。|多选：已选数量可见。|空数据：显示暂无成员。'),
  tree: contract('浏览与选择一个根目录下的直接子项。','当前不接受任意深度的树数据，也不支持拖动排序。','根目录|展开按钮|子项|选择状态','↑ / ↓ 移动节点|← / → 折叠或展开|Enter / Space 选择','根节点可展开与折叠。|子项选择报告明确名称，禁用时不能选择。','展开：显示直接子项。|收起：隐藏子项而保留根节点。|选中：当前节点可辨认。|禁用：节点不可选择。'),
  'tag-group': contract('展示已经选定的筛选条件、关键词，并允许逐项移除。','不提供新增标签或自由输入，不能替代完整标签编辑器。','组标签|标签列表|标签文本|移除按钮|空提示','方向键在标签间移动|聚焦移除按钮后 Enter / Space 移除|Delete / Backspace 可移除当前标签','移除项立即从集合消失。|移除全部后出现空提示，禁用标签无法移除。','有标签：显示可移除项。|空集合：显示已移除全部标签。|禁用：不能移除标签。'),
  disclosure: contract('将不影响主任务的补充说明按需展开。','不要折叠完成任务必需的信息；当前面板正文为固定样本文案。','标题|展开触发器|关联内容面板','Tab 聚焦触发器|Enter / Space 展开或收起','value 控制初始展开状态。|收起时内容不参与可见布局，展开反馈可识别。','展开：关联说明可见。|收起：仅保留标题。|禁用：不能改变展开状态。'),
  'disclosure-group': contract('将相关的多个说明标题作为一组按需展开。','当前仅可编辑标题集合，不能配置任意富文本正文或展开策略。','说明组|多个标题触发器|各自内容面板','Tab 访问各标题|Enter / Space 展开当前项','标题与对应面板关联。|切换展开项后事件报告当前集合。','收起：展示所有标题。|展开：展示当前项的说明。|禁用：整组不可切换。'),
  dialog: contract('短暂聚焦一项单字段编辑任务，保存或取消后回到原页面。','当前只有本地单字段编辑，没有异步提交、字段业务校验或未保存确认。','触发按钮|模态遮罩|标题|说明|输入字段|取消与保存','Tab 在弹窗内部移动|Escape 关闭|关闭后焦点回到触发器','取消不会保存本次编辑。|保存后本地样本保留新值并报告结果。|弹窗打开时背景不参与焦点移动。','关闭：显示触发器。|编辑：字段可输入，焦点留在弹窗内。|保存：记录本地字段值后关闭。|禁用：触发器不能打开弹窗。'),
  'alert-dialog': contract('归档、删除等重要动作执行前，先解释后果再确认。','不用于普通信息提示；当前只演示确认结果，不执行真实删除。','触发按钮|警示对话框|后果说明|取消按钮|确认按钮','打开时焦点落到取消按钮|Tab 在弹窗内移动|Escape 关闭','确认动作的文案具体，危险色不能替代后果说明。|点击背景不关闭对话框。|确认与取消分别反馈，关闭后焦点返回触发点。','等待确认：取消先获得焦点。|危险主题：确认按钮使用 danger 语义。|关闭：确认或取消后回到触发上下文。'),
  tooltip: contract('对已有控件补充一句简短解释，辅助理解术语或行为。','不能承载按钮、链接或完成任务必需的内容；触屏关键说明需另有可见方式。','触发按钮|提示浮层|说明文本','Tab 聚焦触发器显示提示|Escape 关闭提示','悬停与键盘聚焦都能看到同一句提示。|离开触发器后提示收起，不劫持焦点。','隐藏：仅显示触发器。|显示：短说明靠近触发器。|禁用：触发器不可操作。'),
  popover: contract('在成员触发位置附近临时查看相关信息。','当前弹层标题固定为成员信息，不作为任意任务编辑器。','触发按钮|定位浮层|标题|说明','Enter / Space 打开|Escape 关闭并返回触发点','展开与收起有本地反馈。|浮层展示当前 description，外部点击可收起。','关闭：内容不占用页面空间。|打开：成员说明靠近触发点。|禁用：不能打开浮层。'),
  slider: contract('调整有明确范围的连续或分级数值，重视范围感知。','精确长数字录入优先数字输入；当前无独立刻度标签配置。','标签|数值输出|轨道|单个滑块','Tab 聚焦滑块|方向键按步长调整|Home / End 到范围端点','数值限制在 min 与 max 之间。|键盘调整和拖动都遵循 step，输出值同步。','默认：滑块位置对应数值。|拖动 / 聚焦：可调整且有可见焦点。|禁用：不能改变数值。'),
  'range-slider': contract('在同一数值轴上定义起止范围，如价格筛选。','不适合表示两个不相关数值；当前固定两个滑块。','标签|区间输出|共用轨道|起始滑块|结束滑块','Tab 在两个滑块间移动|方向键调整当前滑块','起始值不越过结束值。|两个滑块具有不同名称，区间输出同步更新。','默认：两个滑块表达区间。|调整：只改变当前端点。|禁用：两个端点均不可操作。'),
  'progress-bar': contract('展示任务已完成部分占总体的百分比。','不能作为可拖动输入，也不表示资源占用；当前只支持已知百分比。','任务标签|百分比文字|进度轨道|已完成填充','展示资产，无独立键盘操作。','value 以 0 到 100 的百分比展示。|文本、填充比例和进度语义一致。','进行中：展示配置的完成比例。|完成：100% 填满轨道。'),
  meter: contract('度量固定范围内的资源使用量，例如存储占比。','不要用来表示异步任务进度；当前没有警戒阈值或颜色分级。','度量标签|数值文字|测量轨道|数值填充','展示资产，无独立键盘操作。','使用 meter 度量语义。|显示值与填充比例一致，不发生自发进度变化。','常规值：按配置展示度量。|边界值：0 与 100 表示量程端点。'),
  separator: contract('区分同一页面中相关但独立的内容组。','不承载点击和拖动；不要为每个相邻元素都添加分隔线。','前后示例内容|分隔线|方向语义','展示资产，无独立键盘操作。','横向与纵向外观符合方向配置。|保持 separator 语义，不生成无意义焦点。','横向：分隔上下内容。|纵向：分隔并排内容。'),
  calendar: contract('需要直接比较日期位置并选择单个日期。','当前没有禁选日期、日期上下界或事件日历；不要承诺这些业务能力。','月份标题|前后月按钮|星期列头|日期网格|选中日期','方向键移动日期|Enter / Space 选择日期|Tab 访问月份操作','选择日期后返回对应日历值。|月份切换可恢复，选中状态和可见焦点可区分。','单日选中：只有一个日期被选中。|月份切换：标题与日期网格同步。|禁用：不能修改选择。'),
  'range-calendar': contract('通过日历网格选择连续起止日期。','初始配置仅保存起点，终点取七天后；不宣称可配置业务黑名单。','月份导航|日期网格|起点|终点|区间填充','方向键移动日期|Enter / Space 设置区间端点','选择后事件报告实际起止日期。|区间填充与端点一致，不能混淆当前焦点与已选日期。','初始区间：起点与七天后构成范围。|范围选择：用户可重新设定端点。|禁用：不能改变区间。'),
  'date-field': contract('知道具体日期且需要快速按年、月、日输入。','只处理日历日期，不包括时区或时刻；完整提交校验由业务表单接入。','字段标签|年 / 月 / 日分段|分隔字符|校验位置','Tab 进入日期分段|← / → 切换分段|数字输入，↑ / ↓ 调整当前段','分段输入反映有效日期。|清空日期后事件报告未设置，不伪造已选值。','有值：分段展示日期。|编辑：每段可独立调整。|禁用：全部分段不可编辑。'),
  'date-picker': contract('既允许输入精确日期，又需要日历辅助选择。','不内置时区、节假日或可选日期范围规则。','标签|日期分段|日历按钮|弹出日历|校验位置','日期分段支持方向键与数字输入|Enter / Space 打开日历按钮|Escape 关闭日历','输入与日历反映同一日期值。|关闭日历后返回原上下文，禁用时不能展开。','输入：分段编辑日期。|展开：日历支持单日选择。|禁用：输入与展开均不可用。'),
  'date-range-picker': contract('通过起止日期输入或日历选择一段连续有效期。','初始终点由起点加七天生成，当前配置没有独立的 end 字段；不含时区。','标签|开始日期分段|结束日期分段|日历按钮|范围日历','Tab 在起止分段间移动|数字与方向键编辑日期|Escape 收起日历','样本内两种输入方式保持区间同步。|清空时报告未设置日期范围，选择后反馈起止日期。','初始区间：由起点生成七天区间。|编辑范围：允许在样本内修改两个日期。|禁用：输入与日历均不可编辑。'),
  'time-field': contract('设置不含日期的小时与分钟，如每日提醒时间。','不代表带时区的绝对时刻；不提供时区转换或日期选择。','标签|小时分段|分钟分段|时间分隔','Tab 进入时间分段|← / → 切换分段|数字与↑ / ↓编辑当前段','输入值按 HH:mm 解析。|无效时刻不能作为有效时间，修改后事件报告新值。','有值：显示小时与分钟。|编辑：分段调整时间。|禁用：时间分段不可编辑。'),
  'color-area': contract('在固定色相下同时调节颜色饱和度与亮度。','不是色相或透明度编辑器；其他通道需使用对应控件。','调色标签|二维色域|颜色滑块|十六进制输出','Tab 聚焦颜色滑块|方向键沿两个轴调整颜色','横轴对应饱和度，纵轴对应亮度。|颜色输出随调色变化，禁用后不能编辑。','默认：滑块表达初始色。|编辑：二维位置与色值同步。|禁用：色值保持不变。'),
  'color-slider': contract('在保留其他颜色通道的条件下调整色相。','当前 channel 固定为 hue，不提供透明度或亮度通道切换。','标签|色相轨道|颜色滑块','Tab 聚焦滑块|方向键调整色相','色相拖动后报告新的颜色。|禁用状态阻止拖动和键盘修改。','默认：色相位置对应初始色。|调整：只修改色相通道。|禁用：滑块不可操作。'),
  'color-field': contract('通过文本精确填写颜色值，并与共享颜色保持一致。','不要将无效输入直接保存成颜色；当前没有独立格式选择或错误文案配置。','字段标签|颜色文本输入','Tab 聚焦|输入或编辑颜色文本','有效颜色变化能够报告十六进制值。|禁用时保留色值，不能编辑。','有值：显示当前颜色。|编辑：输入有效颜色后更新。|禁用：不接受修改。'),
  'color-picker': contract('同时需要二维调色、色相调整与精确色值输入。','当前为常驻组合编辑区，不是带触发按钮的弹出选择器，也不含透明度。','颜色名称|饱和度亮度区域|色相滑条|颜色输入','Tab 在调色区、滑条与输入间移动|方向键调整聚焦颜色通道','三个输入共享同一个颜色状态。|任一入口改变颜色，另外两个入口同步；禁用全体生效。','初始色：各入口值一致。|联动编辑：任一入口同步其他入口。|禁用：所有颜色输入不可修改。'),
  'color-swatch': contract('在规范或说明中呈现色值、名称和颜色外观。','不能代替颜色选择器；静态色块不应该加入点击或选择状态。','色块|可访问颜色名|十六进制值','展示资产，无独立键盘操作。','名称与色值同时可读。|展示与实际 color 值一致，静态资产不产生交互状态。','展示：同时呈现色块、名称和色值。'),
  'color-swatch-picker': contract('从维护好的预置颜色集合里选择一个。','自由调色使用颜色选择器；options 中必须填写可解析颜色。','颜色组名称|预设色块项|选中轮廓','方向键访问色块|Enter / Space 选择当前色块','初始值应属于选项集合。|选中状态有非颜色指示，选新项时旧选中被替换。','未选项：显示预设颜色。|已选项：轮廓标明当前值。|禁用：全部预设项不可选择。'),
  'file-trigger': contract('通过系统文件选择器选取单个或多个本地文件。','当前仅显示文件名，不含上传、类型大小限制、进度或服务端存储。','选择按钮|系统文件选择器|文件名反馈','Tab 聚焦选择按钮|Enter / Space 打开系统选择器','multiple 控制系统选择器是否允许多选。|选择后仅显示文件名，不发起上传。','未选择：显示选择按钮。|已选择：报告名称与数量。|禁用：不能打开选择器。'),
  'drop-zone': contract('以拖放为快捷方式接收本地文件，同时提供按钮选择路径。','当前拒绝纯文本但未设置文件类型或大小限制，不提供网络上传。','拖放区域|提示文案|选择按钮|文件名反馈','Tab 访问浏览本地文件按钮|Enter / Space 打开系统选择器','拖入纯文本时给出不接收提示。|multiple 为假时拖入多文件只保留首个，按钮选择也为单选。','待接收：显示拖放提示。|已选择：显示本地名称。|禁用：拖放与选择均不可用。'),
};
const stableDefaultsByKind = new Map();
const stableDocsByKind = new Map();
const propertyDefaults = {disabled:false,required:false,size:'medium',placeholder:'',description:'',value:'',options:[],rel:'',invalid:false,errorMessage:'',multiple:false};
const clone = value => JSON.parse(JSON.stringify(value));
const valuesByProp = {
  size:['small','medium','large'], variant:['base','outline','dashed','text'], theme:['default','primary','success','warning','danger'],
  shape:['rectangle','square','round','circle'], type:['button','submit','reset'], target:['_self','_blank'], status:['normal','success','warning','error'],
  underline:['always','hover','none'], orientation:['horizontal','vertical'], tone:['primary','danger'],
};
const valueType = kind => ['checkbox','switch','toggle-button','disclosure'].includes(kind) ? 'boolean'
  : kind === 'range-slider' ? '[number, number]' : ['slider','number-field','meter','progress-bar'].includes(kind) ? 'number' : 'string';
const propertyDescription = (kind, key) => key === 'disabled' && kind === 'table' ? '禁用成员行选择；列排序仍可操作'
  : key === 'disabled' && kind === 'tree' ? '禁用目录项选择；展开层级与选择是独立行为'
  : key === 'required' ? '要求填写；完整提交校验由所属业务表单触发'
  : key === 'options' && kind === 'tree' ? '当前根目录的直接子项名称（仅一层）'
  : key === 'options' && kind === 'table' ? '成员姓名集合；当前表格列固定为姓名与示例角色'
  : key === 'options' && kind === 'color-swatch-picker' ? '预置颜色字符串集合；每项必须能解析为颜色'
  : propLabels[key]?.[1] || '组件配置项';
const valueDescription = kind => ['range-calendar','date-range-picker'].includes(kind) ? '初始开始日期 YYYY-MM-DD；结束日期初始化为七天后'
  : ['calendar','date-field','date-picker'].includes(kind) ? '初始日历日期 YYYY-MM-DD（不包含时区）'
  : kind === 'time-field' ? '初始时间 HH:mm（不包含日期和时区）'
  : kind === 'range-slider' ? '初始起止值 [开始值, 结束值]'
  : '初始值；预览交互只改变本地样本，保存配置后用于复用';
export function buildComponentSpec(kind, name, en, category, description, config = {}, capabilities = [], related = []) {
  const override = contractsByKind[kind] || {};
  const displayOnly = ['separator', 'color-swatch', 'progress-bar', 'meter'].includes(kind);
  const defaults = stableDefaultsByKind.get(kind) || exampleDefaultsByKind[kind] || config;
  const api = capabilities.map(key => {
    let type = propLabels[key]?.[0] || 'unknown';
    let supportedValues = valuesByProp[key];
    if (key === 'value') type = valueType(kind);
    if (['icon','suffix'].includes(key)) {
      if (kind === 'button') {type = '"none" | "plus" | "check" | "download" | "arrow-right" | "search" | "save" | "trash"'; supportedValues = ['none','plus','check','download','arrow-right','search','save','trash'];}
      else if (kind === 'link') {type = 'boolean'; supportedValues = [false,true];}
    }
    if (type === 'boolean') supportedValues = [false,true];
    return {name:key,type,description:key === 'value' ? valueDescription(kind) : propertyDescription(kind,key),required:key === 'label',defaultValue:clone(defaults[key] ?? propertyDefaults[key] ?? null),...(supportedValues ? {supportedValues:[...supportedValues]} : {})};
  });
  const dedicatedExamples = examplesByKind[kind];
  const exampleBase = Object.fromEntries(capabilities.map(key => [key, clone(defaults[key] ?? propertyDefaults[key] ?? null)]));
  return {
    schemaRevision: 4,
    completeness: dedicatedExamples ? '场景规范样板' : '基础说明',
    purpose: description,
    usage: override.whenToUse || useGuidance[category] || description,
    whenToUse: override.whenToUse || description,
    avoid: override.avoid || '使用前核对当前样本的实际配置与状态支持范围。',
    anatomy: override.anatomy || ['内容容器'],
    states: override.states || [{name:'默认',note:'展示当前配置的内容。'}],
    keyboard: override.keyboard || ['展示资产，无独立键盘操作。'],
    accessibility: displayOnly ? ['展示名称与含义清晰，不依赖颜色表达数据', '静态展示不加入无意义的键盘焦点'] : ['可访问名称说明当前操作或输入用途', '键盘操作与指针操作得到相同结果', '选中、错误与焦点状态提供可辨认的反馈'],
    acceptance: override.acceptance || ['当前样本的输入、输出与上述状态保持一致。'],
    api,
    tokens: displayOnly ? ['surface','text','border','fontSize',...(kind === 'separator' ? [] : ['primary'])] : tokenRolesByKind[kind] || ['surface', 'text', 'border', 'focus', 'radius', 'fontSize'],
    examples: (dedicatedExamples || [{name:'基础示例',note:'初始配置的可运行样本。',config:defaults}]).map(item => ({...item,group:item.group || '使用场景',config:clone({...exampleBase,...Object.fromEntries(Object.entries(item.config).filter(([key]) => capabilities.includes(key)))})})),
    related: related.length ? related : (relatedByKind[kind] || []),
    sources: sourceByKind[kind] || (stableDocsByKind.has(kind) ? [{label:`React Aria ${en}`,href:stableDocsByKind.get(kind)}] : []),
  };
}
const entry = (kind, name, en, category, description, config, capabilities, doc = en.replaceAll(' ', ''), related = []) => {
  stableDefaultsByKind.set(kind, clone(config));
  stableDocsByKind.set(kind, `https://react-aria.adobe.com/${doc}`);
  const spec = buildComponentSpec(kind, name, en, category, description, config, capabilities, related);
  // Modal and range controls use existing catalog document mappings rather than invented routes.
  if (!sourceByKind[kind]) spec.sources = [{label:`React Aria ${en}`,href:`https://react-aria.adobe.com/${doc}`}];
  return {kind,name,en,category,description,...(['button','link'].includes(kind) ? {bindings:{success:'color.success',warning:'color.warning'}} : {}),docs:`https://react-aria.adobe.com/${doc}`,config,capabilities,spec};
};
const basic = ['label', 'disabled', 'size'];
const field = [...basic, 'required', 'placeholder', 'value'];
const choice = [...basic, 'options'];
export const COMPONENT_CATALOG = [
  entry('button','按钮','Button','基础操作','执行一个明确的动作，支持鼠标、触控和键盘。',{label:'保存设置',variant:'base',theme:'primary',size:'medium',shape:'rectangle',type:'button',block:false,loading:false,ghost:false,disabled:false,icon:'none',suffix:'none'},[...basic,'variant','theme','shape','type','block','loading','ghost','icon','suffix']),
  entry('toggle-button','切换按钮','ToggleButton','基础操作','在选中与未选中之间切换。',{label:'收藏',value:false},[...basic,'value']),
  entry('link','链接','Link','导航组织','表达一个可访问的目的地，支持状态、外部跳转和可见焦点反馈。',{label:'查看个人资料',href:'/profile',status:'normal',hoverable:true,underline:'hover',target:'_self',rel:'',external:false,icon:false,suffix:true},['label','disabled','href','status','hoverable','underline','target','rel','external','icon','suffix']),
  entry('breadcrumbs','面包屑','Breadcrumbs','导航组织','表达页面所处位置；点击上游层级可返回。',{label:'文件路径',options:['工作区','文件','设计规范']},['label','options']),
  entry('tabs','标签页','Tabs','导航组织','在同一区域切换相关内容。',{label:'个人设置',options:['基本信息','通知设置','安全设置'],value:'基本信息',disabled:false},['label','options','value','disabled']),
  entry('menu','菜单','Menu','导航组织','展开一组相关操作，支持方向键选择。',{label:'更多操作',options:['复制链接','创建副本','归档']},choice),
  entry('toolbar','工具栏','Toolbar','基础操作','将相关操作组织为可用方向键移动的工具栏。',{label:'文本操作',options:['加粗','斜体','下划线']},choice),
  entry('text-field','文本输入','TextField','表单输入','输入文本，含标签、帮助说明与必填校验。',{label:'显示名称',placeholder:'输入你的名称',value:'',required:false,description:'用于在团队中展示你的身份。',invalid:false,errorMessage:''},[...field,'description','invalid','errorMessage']),
  entry('search-field','搜索框','SearchField','表单输入','输入、提交和清空搜索关键词。',{label:'查找文件',placeholder:'按名称搜索',value:''},field),
  entry('number-field','数字输入','NumberField','表单输入','支持键盘与步进按钮调整数字。',{label:'成员数量',value:5,min:0,max:100,step:1},[...basic,'required','value','min','max','step']),
  entry('checkbox','复选框','Checkbox','表单输入','表达独立的二元选择。',{label:'接收更新通知',value:true},[...basic,'required','value']),
  entry('checkbox-group','复选框组','CheckboxGroup','表单输入','从多个选项中选择一个或多个。',{label:'通知渠道',options:['站内通知','电子邮件','移动推送'],required:false},[...choice,'required']),
  entry('radio-group','单选框组','RadioGroup','表单输入','从互斥选项中选择一个。',{label:'可见范围',options:['仅自己','团队成员','公开'],required:false},[...choice,'required']),
  entry('switch','开关','Switch','表单输入','立即启用或停用一项偏好。',{label:'启用桌面通知',value:true},[...basic,'value']),
  entry('select','选择器','Select','选择集合','通过弹出列表选择一个选项。',{label:'所属团队',placeholder:'选择一个团队',options:['设计团队','产品团队','研发团队'],value:'',description:'选择当前资产所属团队。'},[...choice,'required','placeholder','value','description']),
  entry('combo-box','组合框','ComboBox','选择集合','输入关键词过滤并选择选项。',{label:'查找成员',placeholder:'输入成员名称',options:['林青','陈默','周宁']},[...choice,'required','placeholder']),
  entry('list-box','列表选择','ListBox','选择集合','在可见列表中选择，支持键盘导航。',{label:'选择文件夹',options:['个人文件','团队文件','共享资源']},['label','options','disabled']),
  entry('grid-list','网格列表','GridList','数据展示','在具有行语义的列表中选择项目。',{label:'团队成员',options:['林青 · 设计师','陈默 · 产品经理','周宁 · 工程师']},['label','options','disabled']),
  entry('table','数据表格','Table','数据展示','展示成员数据，支持多选与列排序。',{label:'成员列表',options:['林青','陈默','周宁'],disabled:false},['label','options','disabled']),
  entry('tree','树形列表','Tree','导航组织','在有层级的文件结构中展开与选择。',{label:'文件目录',options:['项目文件','设计稿','规范文档']},['label','options','disabled']),
  entry('tag-group','标签组','TagGroup','选择集合','显示可移除的已选条件或标签。',{label:'已选标签',options:['设计系统','通用组件','已评审']},['label','options','disabled']),
  entry('disclosure','折叠面板','Disclosure','内容组织','按需展开一段补充说明。',{label:'使用说明',value:true},['label','disabled','value']),
  entry('disclosure-group','折叠面板组','DisclosureGroup','内容组织','管理多个说明区块的展开状态。',{label:'常见问题',options:['如何添加成员？','如何修改权限？','如何导出文件？']},['label','options','disabled']),
  entry('dialog','对话框','Dialog','反馈浮层','管理模态焦点，支持 Escape 关闭与焦点返回。',{label:'编辑个人资料',description:'更新后将同步到当前工作区。',fieldLabel:'显示名称',value:'林青',confirmLabel:'保存修改',disabled:false},['label','description','fieldLabel','value','confirmLabel','disabled'],'Modal'),
  entry('alert-dialog','确认对话框','AlertDialog','反馈浮层','在执行重要操作前明确确认与取消。',{label:'归档文件',description:'归档后可在归档列表中恢复。',confirmLabel:'确认归档',cancelLabel:'取消',tone:'primary',disabled:false},['label','description','confirmLabel','cancelLabel','tone','disabled'],'Dialog'),
  entry('tooltip','文字提示','Tooltip','反馈浮层','鼠标悬停或键盘聚焦时补充简短说明。',{label:'自动保存',description:'所有修改将保留在当前工作区。'},[...basic,'description']),
  entry('popover','弹出层','Popover','反馈浮层','在触发位置附近展示上下文信息。',{label:'查看成员信息',description:'林青 · 设计师 · 当前在线'},[...basic,'description']),
  entry('slider','滑动条','Slider','表单输入','拖动或使用方向键调整连续数值。',{label:'缩放比例',value:60,min:0,max:100,step:1},[...basic,'value','min','max','step']),
  entry('range-slider','范围滑动条','RangeSlider','表单输入','使用两个滑块选择数值区间。',{label:'显示范围',value:[20,80],min:0,max:100,step:1},[...basic,'value','min','max','step'],'Slider'),
  entry('progress-bar','进度条','ProgressBar','反馈浮层','以可访问语义呈现任务进度。',{label:'文件整理',value:64},['label','value']),
  entry('meter','计量条','Meter','数据展示','表达已知范围内的测量值。',{label:'存储空间',value:42},['label','value']),
  entry('separator','分隔线','Separator','内容组织','以语义分隔相关内容。',{label:'分组分隔',orientation:'horizontal'},['label','orientation']),
  entry('calendar','日历','Calendar','日期时间','选择单个日期，支持月份切换和键盘操作。',{label:'选择日期',value:'2026-09-17'},['label','disabled','value']),
  entry('range-calendar','范围日历','RangeCalendar','日期时间','选择开始和结束日期。',{label:'选择日期范围',value:'2026-09-17'},['label','disabled','value']),
  entry('date-field','日期输入','DateField','日期时间','按分段输入日期，避免歧义。',{label:'开始日期',value:'2026-09-17'},['label','disabled','required','value','size']),
  entry('date-picker','日期选择器','DatePicker','日期时间','结合日期分段输入与弹出日历。',{label:'预约日期',value:'2026-09-17'},['label','disabled','required','value','size']),
  entry('date-range-picker','日期范围选择器','DateRangePicker','日期时间','输入或通过日历选择日期范围。',{label:'有效日期',value:'2026-09-17'},['label','disabled','required','value','size']),
  entry('time-field','时间输入','TimeField','日期时间','按小时和分钟分段输入时间。',{label:'提醒时间',value:'09:30'},['label','disabled','required','value','size']),
  entry('color-area','颜色区域','ColorArea','颜色编辑','在二维区域调整饱和度和亮度。',{label:'选择颜色',value:'#315BD6'},['label','disabled','value']),
  entry('color-slider','颜色滑条','ColorSlider','颜色编辑','调整颜色的色相通道。',{label:'色相',value:'#315BD6'},['label','disabled','value']),
  entry('color-field','颜色输入','ColorField','颜色编辑','以文本输入和校验颜色值。',{label:'颜色值',value:'#315BD6'},['label','disabled','value','size']),
  entry('color-picker','颜色选择器','ColorPicker','颜色编辑','联动二维色板、色相滑条与颜色输入。',{label:'主题颜色',value:'#315BD6'},['label','disabled','value']),
  entry('color-swatch','色块','ColorSwatch','颜色编辑','显示颜色及其可访问名称。',{label:'品牌色',value:'#315BD6'},['label','value']),
  entry('color-swatch-picker','色块选择器','ColorSwatchPicker','颜色编辑','从一组预置色中选择。',{label:'常用颜色',value:'#315BD6',options:['#315BD6','#168566','#CF7130','#A1467B']},['label','disabled','value','options']),
  entry('file-trigger','文件选择','FileTrigger','文件操作','通过系统文件选择器选择本地文件；只在本地显示文件名。',{label:'选择文件',multiple:true},[...basic,'multiple']),
  entry('drop-zone','拖放区域','DropZone','文件操作','接受文件拖放或通过系统选择器添加本地文件。',{label:'拖放文件到这里',multiple:true},['label','disabled','multiple']),
];
export const COMPONENT_CATEGORIES = [...new Set(COMPONENT_CATALOG.map(item => item.category))];
