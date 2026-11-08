import { resolvePageTemplate, templateFamily, BLUEPRINT_SHELLS, BLUEPRINT_VARIANTS } from './templateBlueprint.js';

export const CHECK_DIMENSIONS = Object.freeze([
  Object.freeze({ id: 'content', label: '内容与数据' }),
  Object.freeze({ id: 'interaction', label: '操作与反馈' }),
  Object.freeze({ id: 'accessibility', label: '键盘与可访问性' }),
  Object.freeze({ id: 'responsive', label: '布局与适配' }),
]);
const dimensionIds = new Set(CHECK_DIMENSIONS.map(dimension => dimension.id));
const array = value => Array.isArray(value) ? value : [];
const nonempty = value => typeof value === 'string' && !!value.trim();
const key = (pageId, dimension) => JSON.stringify([pageId, dimension]);
const dimensionPriority = ['failed', 'stale', 'pending', 'passed'];
// Increment when these manual acceptance criteria change meaning, so old conclusions cannot cover new criteria.
const CRITERION_VERSION = 'v1';
const SECTION_LABELS = { intro:'标题与说明', filters:'检索条件', actions:'页面操作', content:'主要内容' };

function pageContext(project, page) {
  const template = array(project?.snapshot?.templates).find(item => item.id === page.templateId);
  if (!template) return { page, template: null, family: 'missing', error: '锁定基线中缺少所采用的模板。' };
  try {
    const resolved = resolvePageTemplate(template, page);
    return { page, template: resolved, family: templateFamily(resolved), error: null };
  } catch (error) {
    return { page, template, family: templateFamily(template), error: `页面独立配置不可用：${error.message}` };
  }
}

function criteriaDescriptions(project, context) {
  const { page, template, family, error } = context;
  const blueprint = error ? null : template?.blueprint;
  const title = blueprint?.title || page.name || template?.name || page.id;
  const prefix = `在「${page.name || page.id}」页面（内容标题「${title}」）中，`;
  if (error) return Object.fromEntries(CHECK_DIMENSIONS.map(dimension => [dimension.id,
    `先恢复「${page.name || page.id}」的模板与页面配置，再按${dimension.label}检查实际界面。当前无法生成具体步骤：${error}`]));
  if (!blueprint) {
    const patternNames = array(template.patternIds).map(id => array(project?.snapshot?.patterns).find(pattern => pattern.id === id)?.name || id);
    const contextName = patternNames.length ? `「${patternNames.join('、')}」交互流程` : `「${template.name || page.templateId}」模板的实际操作`;
    return {
      content: `${prefix}逐项核对标题、说明、内容字段和组件展示是否符合当前锁定模板；同时核对${contextName}引用的内容。旧模板没有可编辑字段契约，请依据实际展示记录核对范围与发现的问题。`,
      interaction: `${prefix}完整执行${contextName}，逐步记录触发、结果、取消与恢复路径；核对无内容或错误提示是否可理解。只记录真实操作结果，未提供的业务能力标记为不在范围内。`,
      accessibility: `${prefix}使用 Tab 与 Shift+Tab 遍历实际控件，使用 Enter 或 Space 触发适用控件，核对焦点可见、名称明确、顺序合理；存在弹窗时检查退出与焦点返回，并记录实际结果。`,
      responsive: `${prefix}分别在 1440px、1024px 与 390px 宽度检查内容阅读与主要操作；核对导航、长文本、表格或区域编排不遮挡关键内容，记录必要的局部滚动和实际问题。`,
    };
  }
  const fields = blueprint.fields.map(field => `「${field.label}」${field.required ? '（必填）' : ''}`).join('、');
  const required = blueprint.fields.filter(field => field.required).map(field => `「${field.label}」`).join('、');
  const actions = blueprint.actions;
  const primary = `「${actions.primaryLabel}」`, secondary = `「${actions.secondaryLabel}」`;
  const shell = BLUEPRINT_SHELLS[blueprint.shell] || blueprint.shell;
  const variant = BLUEPRINT_VARIANTS[family]?.[blueprint.variant] || blueprint.variant;
  let interaction;
  if (family === 'list') interaction = `${prefix}用已有记录值和无匹配值执行查询，操作${secondary}核对条件清空与列表恢复，检查选择记录后的反馈。${actions.allowCreate ? `执行${primary}，核对字段填写、校验、确认与取消。` : '核对创建操作未开放。'}${actions.allowDelete ? '执行删除操作，分别取消和确认，核对记录与选择状态是否同步。' : '核对删除操作未开放。'}`;
  else if (family === 'form') interaction = `${prefix}${required ? `留空${required}并执行${primary}，核对必填提示；` : '输入符合字段类型的内容；'}填写有效值后执行${primary}，核对结果反馈，再操作${secondary}核对恢复行为。${blueprint.variant === 'wizard' ? '逐步前进并返回上一步，核对已填写内容保留且不能跳过当前步骤校验。' : ''}`;
  else interaction = `${prefix}执行${primary}进入编辑，修改字段后分别取消和保存，核对${secondary}取消路径不会提交改动，保存后内容正确更新且有可理解的结果反馈。`;
  return {
    content: `${prefix}核对页面标题、说明以及${fields}的名称、类型、必填标识与展示顺序；对照当前 ${blueprint.records.length} 条样本检查值的展示和长文本处理。空字符串、数字 0 与缺失值应按实际配置区分；记录核对结果与证据位置。`,
    interaction,
    accessibility: `${prefix}仅用键盘 Tab 与 Shift+Tab 遍历${fields}及页面操作，使用 Enter 或 Space 触发适用控件；核对焦点可见、字段标签与错误提示有关联、阅读和操作顺序合理。${actions.allowDelete ? '删除确认弹窗还需检查退出路径与关闭后的焦点返回。' : ''}记录实际操作与辅助技术检查结果，未执行的部分不能标为通过。`,
    responsive: `${prefix}以「${shell} / ${variant}」配置分别在 1440px、1024px 与 390px 宽度查看，核对区域顺序「${blueprint.sections.map(section => SECTION_LABELS[section] || section).join(' → ')}」、${fields}和主要操作不遮挡；长文本可读，窄屏可完成当前任务，确需横向滚动的区域应可发现并局部滚动。记录各宽度的实际结果。`,
  };
}

/** Suggestions for manual work, never automatically generated acceptance conclusions. */
export function buildProjectCheckPlan(project) {
  return array(project?.pages).flatMap(page => {
    const context = pageContext(project, page);
    const descriptions = criteriaDescriptions(project, context);
    return CHECK_DIMENSIONS.map(dimension => ({
      pageId: page.id, dimension: dimension.id,
      name: `${page.name || page.id} · ${dimension.label}`,
      description: descriptions[dimension.id],
      criterionKey: `${context.family}/${dimension.id}/${CRITERION_VERSION}`,
    }));
  });
}

function checkStatus(project, check, planMap) {
  if (check?.baselineRevision !== project?.snapshot?.revision
    || (check?.designRevision ?? 1) !== (project?.designRevision ?? 1)) return 'stale';
  if (check?.status === 'stale') return 'stale';
  if (check?.dimension) {
    if (!dimensionIds.has(check.dimension)) return 'pending';
    const criterion = planMap.get(key(check.pageId, check.dimension));
    if (!criterion || check.criterionKey !== criterion.criterionKey) return 'stale';
  }
  if (!['passed', 'failed', 'pending'].includes(check?.status)) return 'pending';
  if (['passed', 'failed'].includes(check.status) && !nonempty(check.evidence)) return 'pending';
  return check.status;
}

export function getCheckStatus(project, check) {
  const planMap = new Map(buildProjectCheckPlan(project).map(item => [key(item.pageId, item.dimension), item]));
  return checkStatus(project, check, planMap);
}

/** Read-only coverage and blockers for the current locked baseline and page design revision. */
export function getProjectAcceptance(project) {
  const pageList = array(project?.pages), checks = array(project?.checks);
  const baselineRevision = project?.snapshot?.revision ?? null, designRevision = project?.designRevision ?? 1;
  const planMap = new Map(buildProjectCheckPlan(project).map(item => [key(item.pageId, item.dimension), item]));
  const statuses = checks.map(check => ({ check, status: checkStatus(project, check, planMap) }));
  const totals = { checks: checks.length, passed: 0, failed: 0, pending: 0, stale: 0, missing: 0 };
  const blockers = [];
  if (!pageList.length) blockers.push({ code: 'NO_PAGES', message: '项目尚未配置页面，无法完成页面验收。' });
  const pageIds = new Set(pageList.map(page => page.id));
  const pages = pageList.map(page => {
    const context = pageContext(project, page);
    if (context.error) blockers.push({ code: context.template ? 'INVALID_PAGE_CONFIGURATION' : 'MISSING_TEMPLATE', pageId: page.id,
      message: `页面「${page.name || page.id}」${context.error}` });
    const dimensions = CHECK_DIMENSIONS.map(dimension => {
      const relevant = statuses.filter(({ check }) => check.pageId === page.id && check.dimension === dimension.id);
      const status = relevant.length ? dimensionPriority.find(candidate => relevant.some(item => item.status === candidate)) : 'missing';
      if (status === 'missing') {
        totals.missing += 1;
        blockers.push({ code: 'MISSING_DIMENSION', pageId: page.id, message: `页面「${page.name || page.id}」尚无「${dimension.label}」检查记录。` });
      }
      return { ...dimension, status, checkIds: relevant.map(({ check }) => check.id) };
    });
    return { pageId: page.id, name: page.name, templateId: page.templateId, dimensions };
  });
  for (const { check, status } of statuses) {
    totals[status] += 1;
    const identity = { ...(check.pageId ? { pageId: check.pageId } : {}), ...(check.id ? { checkId: check.id } : {}) };
    if (check.pageId && !pageIds.has(check.pageId)) blockers.push({ code: 'INVALID_CHECK_PAGE', ...identity, message: `检查「${check.name || check.id}」引用的页面不存在。` });
    if (check.dimension && !dimensionIds.has(check.dimension)) blockers.push({ code: 'INVALID_CHECK_DIMENSION', ...identity, message: `检查「${check.name || check.id}」的检查维度无效。` });
    if (status !== 'passed') blockers.push({ code: `CHECK_${status.toUpperCase()}`, ...identity,
      message: `检查「${check.name || check.id}」${status === 'stale' ? '对应的版本或检查标准已变化，需要复验。' : status === 'failed' ? '尚未通过，需修复并复验。' : '尚未完成带有效证据的人工验收。'}` });
  }
  return { ready: blockers.length === 0, baselineRevision, designRevision, pages, totals, blockers };
}
