import { validateDoc, DEFAULT_BINDINGS, SCHEMA_VERSION } from './model.js';
import { resolvePageTemplate } from './templateBlueprint.js';
import { getProjectAcceptance } from './projectAcceptance.js';
import { applyProjectTheme } from './projectTheme.js';

/** Export only the dependency closure of adopted pages, from this project's locked baseline. */
export function createProjectContext(doc, projectId) {
  validateDoc(doc);
  const project = doc.projects.find(item => item.id === projectId);
  if (!project) throw new Error('项目不存在。');
  const acceptance = getProjectAcceptance(project);
  const source = applyProjectTheme(project);
  const picked = { tokens: new Set(), components: new Set(), patterns: new Set(), templates: new Set() };
  function visit(layer, id) {
    if (picked[layer].has(id)) return;
    const asset = source[layer].find(item => item.id === id);
    if (!asset) throw new Error(`项目采用的 ${layer}/${id} 不在锁定版本中。`);
    picked[layer].add(id);
    if (layer === 'templates') {
      asset.patternIds.forEach(value => visit('patterns', value));
      asset.componentIds.forEach(value => visit('components', value));
    } else if (layer === 'patterns') asset.componentIds.forEach(value => visit('components', value));
    else if (layer === 'components') Object.values({ ...DEFAULT_BINDINGS, ...asset.bindings }).forEach(value => visit('tokens', value));
    else if (asset.alias) visit('tokens', asset.alias);
  }
  project.pages.forEach(page => visit('templates', page.templateId));
  const select = snapshot => Object.fromEntries(Object.entries(picked).map(([layer, ids]) => [layer, snapshot[layer].filter(asset => ids.has(asset.id))]));
  // The unmodified baseline may retain aliases that a project override removes.
  const baselineAssets = select(project.snapshot);
  const baselineIds = new Set(baselineAssets.tokens.map(token => token.id));
  for (const token of baselineAssets.tokens) {
    if (token.alias && !baselineIds.has(token.alias)) {
      const aliased = project.snapshot.tokens.find(item => item.id === token.alias);
      if (aliased) { baselineAssets.tokens.push(aliased); baselineIds.add(aliased.id); }
    }
  }
  return JSON.parse(JSON.stringify({
    format: 'design-context/1', scope: 'project-design',
    project: { id: project.id, name: project.name, baselineRevision: project.snapshot.revision, designRevision: project.designRevision ?? 1 },
    ...(project.derivedFrom ? { origin: project.derivedFrom } : {}),
    requirementSnapshot: { status: 'not-linked', note: '尚未绑定经过确认的需求快照；组件示例和模板说明不得当作正式业务需求。' },
    designSnapshot: { baselineAssets, effectiveAssets: select(source), themeOverrides: Object.fromEntries(Object.entries(project.themeOverrides || {}).filter(([id]) => picked.tokens.has(id))) },
    upgradeReviews: project.upgradeReviews || [],
    pages: project.pages, resolvedPages: project.pages.map(page => ({ id:page.id, name:page.name, template:resolvePageTemplate(source.templates.find(t => t.id === page.templateId),page) })), verification: { method: 'manual', checks: project.checks, complete: acceptance.ready, coverage: acceptance, note: '完整性按当前人工记录判断，不代表自动验证或生产环境认证。' },
    implementation: { kind: 'local-workbench-preview', executablePackage: null, modelConnection: null, figmaBinding: null },
    rules: [
      '沿用资产稳定 ID 和声明的配置；不能猜测未支持的属性或业务回调。',
      '需求依据与设计依据分别记录；缺失需求、接口、权限与状态规则时明确列出待确认项。',
      '主题只改变视觉；可配置模板包含本地预览行为，补充区域之间不自动连接数据和动作。',
      '本文件不是可执行组件包；采用代码前仍需运行时映射与业务工程验证。',
      '对话修改应输出待审阅变更；当前未接入自动回流或自动模型执行。',
    ],
  }));
}

/** Reconstruct a delivery's context from its frozen project, never from the live library. */
export function createArchivedProjectContext(record) {
  const delivery = record?.package;
  if (!record || !delivery || delivery.format !== 'gkx-design-delivery' || delivery.schemaVersion !== 2 || !['draft', 'reviewed'].includes(delivery.mode)) {
    throw new Error('交付记录缺少有效的项目交付包。');
  }
  const archivedProject = delivery.project;
  if (!archivedProject?.snapshot || Object.prototype.hasOwnProperty.call(archivedProject, 'deliveries')) {
    throw new Error('交付记录必须包含独立项目快照，不能嵌套交付历史。');
  }
  const project = JSON.parse(JSON.stringify(archivedProject));
  const snapshot = project.snapshot;
  const context = createProjectContext({
    schemaVersion: SCHEMA_VERSION,
    revision: snapshot.revision,
    tokens: snapshot.tokens,
    components: snapshot.components,
    patterns: snapshot.patterns,
    templates: snapshot.templates,
    projects: [project],
    history: [],
  }, project.id);
  if (delivery.mode === 'reviewed' && !context.verification.complete) {
    throw new Error('人工验收交付记录缺少完整的当前版本验收证据。');
  }
  context.delivery = {
    id: record.id,
    title: record.title,
    note: record.note || '',
    createdAt: record.createdAt,
    mode: delivery.mode,
  };
  return context;
}

export function projectContextMarkdown(context) {
  const assets = context.designSnapshot.effectiveAssets;
  const label = value => String(value).replace(/[\r\n|]/g, ' ');
  return `# ${label(context.project.name)} · 项目设计上下文

格式：${context.format}。共享基线 r${context.project.baselineRevision}；项目设计修订 d${context.project.designRevision}。
${context.delivery ? `\n交付记录：${label(context.delivery.title)}。归档时间：${label(context.delivery.createdAt)}。此上下文来自该次交付快照。\n` : ''}
${context.origin ? `\n复用来源：${label(context.origin.projectName)} / ${label(context.origin.deliveryTitle)}（${label(context.origin.deliveryId)}）。来源基线 r${context.origin.baselineRevision}、设计修订 d${context.origin.designRevision}；来源验收证据不作为本项目的验收结论。\n` : ''}

## 范围与边界

${context.requirementSnapshot.note}

${context.rules.map(rule => `- ${rule}`).join('\n')}

## 采用页面

${context.pages.map(page => `- ${label(page.name)}：\`${label(page.templateId)}\``).join('\n') || '尚未创建页面。'}

## 采用组件

| 组件 | 稳定 ID | 实现类型 |
| --- | --- | --- |
${assets.components.map(asset => `| ${label(asset.name)} | ${label(asset.id)} | ${label(asset.kind)} |`).join('\n')}

## 版本化设计数据

以下数据保存当前采用的变量、组件契约、区域组合、模式、基线和局部覆盖，resolvedPages 为每页应用局部配置后的模板。验收记录是人工证据，不代表自动验证完成。

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`
`;
}
