import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECK_DIMENSIONS, buildProjectCheckPlan, getCheckStatus, getProjectAcceptance } from '../src/projectAcceptance.js';

function fixture() {
  return { id: 'project-one', name: '研究交付', designRevision: 2, pages: [{ id: 'page-list', name: '研究文献', templateId: 'template-list' }], checks: [], snapshot: {
    revision: 4, patterns: [], components: [], tokens: [], templates: [{ id: 'template-list', name: '共享资源列表', layout: 'list', componentIds: [], patternIds: [], blueprint: {
      version: 1, family: 'list', variant: 'table', shell: 'side', title: '通用资源', description: '内容说明',
      fields: [{ id: 'title', label: '资源标题', type: 'text', required: true }, { id: 'year', label: '年份', type: 'number', required: false }],
      records: [{ id: 'r-one', values: { title: '语义检索', year: 2026 } }],
      actions: { primaryLabel: '创建资源', secondaryLabel: '清空筛选', allowCreate: true, allowDelete: true },
      sections: ['intro', 'filters', 'actions', 'content'],
    } }],
  } };
}
function covered(project) {
  project.checks = buildProjectCheckPlan(project).map((criterion, index) => ({
    ...criterion, id: `check-${index}`, status: 'passed', evidence: '已手动操作并核对截图 sample.png。',
    baselineRevision: project.snapshot.revision, designRevision: project.designRevision ?? 1,
  }));
  return project;
}

test('an empty project is blocked even when a project-wide custom check passed', () => {
  const project = fixture();
  project.pages = [];
  project.checks = [{ id: 'custom', name: '整体说明', status: 'passed', evidence: '核对完成', baselineRevision: 4, designRevision: 2 }];
  assert.deepEqual(buildProjectCheckPlan(project), []);
  const summary = getProjectAcceptance(project);
  assert.equal(summary.ready, false);
  assert.equal(summary.totals.passed, 1);
  assert.ok(summary.blockers.some(blocker => blocker.code === 'NO_PAGES'));
});

test('every page needs four explicit dimensions; a legacy passing check does not imply coverage', () => {
  const project = fixture();
  project.checks = [{ id: 'legacy', pageId: 'page-list', name: '历史记录', status: 'passed', evidence: '曾经查看', baselineRevision: 4, designRevision: 2 }];
  const summary = getProjectAcceptance(project);
  assert.equal(summary.ready, false);
  assert.equal(summary.totals.checks, 1);
  assert.equal(summary.totals.passed, 1);
  assert.equal(summary.totals.missing, 4);
  assert.deepEqual(summary.pages[0].dimensions.map(dimension => dimension.id), CHECK_DIMENSIONS.map(dimension => dimension.id));
  assert.ok(summary.pages[0].dimensions.every(dimension => dimension.status === 'missing'));
});

test('check suggestions use locked templates plus page overrides, with actionable fields and labels', () => {
  const project = fixture();
  const blueprint = structuredClone(project.snapshot.templates[0].blueprint);
  blueprint.title = '项目论文';
  blueprint.fields[0].label = '论文题名';
  blueprint.actions.primaryLabel = '新建论文';
  blueprint.actions.secondaryLabel = '清空论文条件';
  blueprint.variant = 'cards';
  project.pages[0].overrides = { blueprint };
  const before = JSON.stringify(project);
  const plan = buildProjectCheckPlan(project);
  assert.equal(plan.length, 4);
  assert.equal(new Set(plan.map(item => item.criterionKey)).size, 4);
  assert.equal(plan.find(item => item.dimension === 'content').criterionKey, 'list/content/v1');
  assert.match(plan.find(item => item.dimension === 'content').description, /项目论文.*论文题名/);
  assert.match(plan.find(item => item.dimension === 'interaction').description, /新建论文/);
  assert.match(plan.find(item => item.dimension === 'interaction').description, /清空论文条件/);
  assert.match(plan.find(item => item.dimension === 'responsive').description, /侧边导航.*卡片列表/);
  assert.ok(plan.every(item => item.status === undefined && item.evidence === undefined));
  assert.equal(JSON.stringify(project), before);
});

test('all current-version dimensions with evidence permit manual acceptance readiness', () => {
  const project = covered(fixture());
  const summary = getProjectAcceptance(project);
  assert.equal(summary.ready, true);
  assert.equal(summary.baselineRevision, 4);
  assert.equal(summary.designRevision, 2);
  assert.deepEqual(summary.totals, { checks: 4, passed: 4, failed: 0, pending: 0, stale: 0, missing: 0 });
  assert.deepEqual(summary.blockers, []);
  assert.ok(summary.pages[0].dimensions.every(dimension => dimension.status === 'passed' && dimension.checkIds.length === 1));
});

test('baseline, design revision and criterion changes invalidate prior conclusions', () => {
  const project = covered(fixture());
  project.checks[0].baselineRevision = 3;
  project.checks[1].designRevision = 1;
  project.checks[2].criterionKey = 'list/accessibility/v0';
  project.checks[3].status = 'stale';
  for (const check of project.checks) assert.equal(getCheckStatus(project, check), 'stale');
  const summary = getProjectAcceptance(project);
  assert.equal(summary.ready, false);
  assert.equal(summary.totals.stale, 4);
  assert.equal(summary.totals.missing, 0);
  assert.ok(summary.pages[0].dimensions.every(dimension => dimension.status === 'stale'));
  assert.ok(summary.blockers.every(blocker => blocker.code === 'CHECK_STALE'));
});

test('adding a passing duplicate cannot mask a failed, pending or stale check in the same dimension', () => {
  for (const status of ['failed', 'pending', 'stale']) {
    const project = covered(fixture());
    project.checks.push({ ...project.checks[0], id: 'duplicate', status });
    const summary = getProjectAcceptance(project);
    assert.equal(summary.ready, false);
    assert.equal(summary.pages[0].dimensions[0].status, status);
    assert.deepEqual(summary.pages[0].dimensions[0].checkIds, ['check-0', 'duplicate']);
    assert.ok(summary.blockers.some(blocker => blocker.checkId === 'duplicate'));
  }
});

test('custom and project-wide unfinished checks block a fully covered project', () => {
  const project = covered(fixture());
  project.checks.push({ id: 'global', name: '交付清单', status: 'pending', baselineRevision: 4, designRevision: 2 });
  const summary = getProjectAcceptance(project);
  assert.equal(summary.ready, false);
  assert.equal(summary.totals.pending, 1);
  assert.ok(summary.pages[0].dimensions.every(dimension => dimension.status === 'passed'));
  assert.ok(summary.blockers.some(blocker => blocker.code === 'CHECK_PENDING' && blocker.checkId === 'global'));
  project.checks.at(-1).status = 'passed';
  project.checks.at(-1).evidence = '清单已逐项核对';
  assert.equal(getProjectAcceptance(project).ready, true);
});

test('blank or absent evidence cannot count as a pass or a completed failure verdict', () => {
  for (const evidence of [undefined, '', '   ', { url: 'unsupported' }]) {
    const project = covered(fixture());
    project.checks[0].evidence = evidence;
    assert.equal(getCheckStatus(project, project.checks[0]), 'pending');
    assert.equal(getProjectAcceptance(project).ready, false);
  }
  const project = covered(fixture());
  project.checks[0].status = 'failed'; project.checks[0].evidence = '';
  assert.equal(getCheckStatus(project, project.checks[0]), 'pending');
});

test('a second project and its revisions do not affect coverage or mutate the input project', () => {
  const first = covered(fixture()), second = covered(fixture());
  second.id = 'project-two'; second.designRevision = 3;
  const before = JSON.stringify(first);
  const result = getProjectAcceptance(first);
  assert.equal(result.ready, true);
  assert.equal(getProjectAcceptance(second).ready, false);
  result.pages[0].name = '改动输出';
  result.pages[0].dimensions[0].checkIds.push('unrelated');
  assert.equal(JSON.stringify(first), before);
  assert.equal(getProjectAcceptance(first).ready, true);
});

test('legacy templates still receive honest manual criteria without inventing a field contract', () => {
  const project = fixture();
  project.designRevision = undefined;
  project.snapshot.templates = [{ id: 'template-list', name: '旧版工作台', layout: 'dashboard', componentIds: [], patternIds: ['p-overview'] }];
  project.snapshot.patterns = [{ id: 'p-overview', name: '概览检索' }];
  const plan = buildProjectCheckPlan(project);
  assert.equal(plan.length, 4);
  assert.match(plan[0].description, /旧模板没有可编辑字段契约/);
  assert.match(plan[1].description, /概览检索/);
  assert.equal(plan[0].criterionKey, 'overview/content/v1');
  covered(project);
  project.checks.forEach(check => { delete check.designRevision; });
  assert.equal(getProjectAcceptance(project).ready, true);
});

test('missing templates and invalid overrides block readiness even if four records claim a pass', () => {
  const missing = covered(fixture());
  missing.snapshot.templates = [];
  const missingResult = getProjectAcceptance(missing);
  assert.equal(missingResult.ready, false);
  assert.ok(missingResult.blockers.some(blocker => blocker.code === 'MISSING_TEMPLATE'));
  const invalid = covered(fixture());
  invalid.pages[0].overrides = { blueprint: { ...invalid.snapshot.templates[0].blueprint, fields: [] } };
  const invalidResult = getProjectAcceptance(invalid);
  assert.equal(invalidResult.ready, false);
  assert.ok(invalidResult.blockers.some(blocker => blocker.code === 'INVALID_PAGE_CONFIGURATION'));
});

test('coverage is per page and old custom records remain visible rather than being coerced into dimensions', () => {
  const project = covered(fixture());
  project.pages.push({ id: 'page-two', name: '另一资源页', templateId: 'template-list' });
  project.checks.push({ id: 'custom-page', pageId: 'page-two', name: '旧版检查', status: 'passed', evidence: '已查看', baselineRevision: 4, designRevision: 2 });
  const summary = getProjectAcceptance(project);
  assert.equal(summary.ready, false);
  assert.equal(summary.pages.length, 2);
  assert.ok(summary.pages[0].dimensions.every(dimension => dimension.status === 'passed'));
  assert.ok(summary.pages[1].dimensions.every(dimension => dimension.status === 'missing'));
  assert.equal(summary.totals.missing, 4);
  assert.equal(summary.totals.passed, 5);
});

test('orphaned page references and unsupported dimensions fail closed', () => {
  const project = covered(fixture());
  project.checks.push({ ...project.checks[0], id: 'orphan', pageId: 'removed' });
  project.checks.push({ ...project.checks[0], id: 'unknown', dimension: 'unknown' });
  const summary = getProjectAcceptance(project);
  assert.equal(summary.ready, false);
  assert.ok(summary.blockers.some(blocker => blocker.code === 'INVALID_CHECK_PAGE'));
  assert.ok(summary.blockers.some(blocker => blocker.code === 'INVALID_CHECK_DIMENSION'));
});
