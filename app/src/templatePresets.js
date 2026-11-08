import { assertBlueprint } from './templateBlueprint.js';

/** New opt-in template assets; callers preserve existing assets with matching IDs. */
export function createTemplatePresets(source) {
  const pick = (...kinds) => kinds.map(kind => source.components?.find(component => component.kind === kind)?.id).filter(Boolean);
  const patterns = (...ids) => ids.filter(id => source.patterns?.some(pattern => pattern.id === id));
  const fields = [
    { id: 'name', label: '资源名称', type: 'text', required: true },
    { id: 'owner', label: '负责人', type: 'text', required: true },
    { id: 'status', label: '状态', type: 'select', required: true, options: ['待开始', '进行中', '已完成'] },
    { id: 'description', label: '说明', type: 'textarea', required: false },
  ];
  const records = [
    { id: 'record-1', values: { name: '设计规范整理', owner: '设计团队', status: '进行中', description: '整理可复用的颜色、文字与间距规范。' } },
    { id: 'record-2', values: { name: '组件交互核对', owner: '研发团队', status: '待开始', description: '核对组件状态、键盘操作与错误恢复。' } },
    { id: 'record-3', values: { name: '页面交付检查', owner: '项目团队', status: '已完成', description: '记录交付范围与页面验收依据。' } },
  ];
  const definitions = [
    ['list', 'table', '表格资源列表', '按字段检索、筛选和比较资源；适合高密度信息与批量选择。', '侧重跨记录比较；可自定义字段、数据与操作文案。'],
    ['list', 'cards', '卡片资源列表', '按卡片浏览资源摘要；适合内容较独立、需要快速浏览的对象。', '侧重单个资源概览；与表格变体共享字段和操作配置。'],
    ['form', 'standard', '单页信息表单', '在一页完成填写、验证、重置和提交反馈。', '适合字段数量适中的单一提交任务。'],
    ['form', 'wizard', '分步信息表单', '逐步填写、验证和核对；返回上一步时保留内容。', '适合需要逐项引导的填写任务。'],
    ['detail', 'summary', '摘要资源详情', '围绕一个对象集中呈现摘要字段和编辑操作。', '适合快速核对对象信息；支持本地编辑、保存与取消。'],
    ['detail', 'sections', '分区资源详情', '将对象字段分区阅读，保留统一的页面操作。', '适合较长字段内容；切换结构时保留已配置的信息。'],
  ];
  return definitions.map(([family, variant, name, description, pageDescription]) => {
    const blueprint = {
      version: 1, family, variant, shell: 'none',
      title: family === 'form' ? '创建资源' : family === 'detail' ? '资源详情' : '资源管理',
      description: pageDescription,
      fields: JSON.parse(JSON.stringify(fields)), records: JSON.parse(JSON.stringify(records)),
      actions: { primaryLabel: family === 'form' ? '提交信息' : family === 'detail' ? '编辑信息' : '创建资源', secondaryLabel: family === 'form' ? '重置内容' : family === 'detail' ? '取消编辑' : '清空条件', allowCreate: family === 'list', allowDelete: family === 'list' },
      sections: family === 'list' ? ['intro', 'filters', 'actions', 'content'] : ['intro', 'content', 'actions'],
    };
    assertBlueprint(blueprint);
    const componentIds = family === 'list' ? pick('button', 'search-field', 'select', 'table', 'checkbox', 'text-field', 'text-area', 'number-field', 'alert-dialog')
      : family === 'form' ? pick('button', 'text-field', 'text-area', 'number-field', 'select', 'progress-bar')
        : pick('button', 'text-field', 'text-area', 'number-field', 'select', 'disclosure', 'alert-dialog');
    const patternIds = family === 'list' ? patterns('p-search-filter', 'p-selection', 'p-confirm-action')
      : family === 'form' ? patterns('p-form-submit', ...(variant === 'wizard' ? ['p-multistep'] : []))
        : patterns('p-confirm-action');
    return { id: `t-flex-${family}-${variant}`, name, description, layout: family === 'form' && variant === 'wizard' ? 'wizard' : family,
      componentIds: [...new Set(componentIds)], patternIds, blueprint, custom: false };
  });
}
