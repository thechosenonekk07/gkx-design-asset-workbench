import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CHECK_DIMENSIONS, buildProjectCheckPlan, getCheckStatus } from './projectAcceptance.js';
import './project-check-editor.css';

const STATUS_LABELS = { pending: '待检查', passed: '人工通过', failed: '需要修复', stale: '需重新检查' };
const dimensionLabel = value => CHECK_DIMENSIONS.find(item => item.id === value)?.label || '自定义检查';
const revisionLabel = (baseline, design) => `${Number.isInteger(baseline) ? `r${baseline}` : '基线未记录'} / d${design ?? 1}`;
const dateLabel = value => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '时间未记录';
};

function PreviousReview({ review, project, current = false }) {
  const status = review.status === 'stale' ? review.previousStatus || 'stale' : review.status;
  return <article className="pce-previous-review">
    <div className="pce-review-heading"><strong>{current ? '上次检查记录' : review.name || '历史检查记录'}</strong><span className={`cv-status cv-status-${status}`}>{STATUS_LABELS[status] || '待检查'}</span></div>
    <p className="pce-review-meta">{revisionLabel(review.baselineRevision, review.designRevision)} · {dateLabel(review.updatedAt || review.archivedAt)}</p>
    <p className="pce-review-meta">{review.pageId ? project.pages.find(page => page.id === review.pageId)?.name || '原页面已移除' : '整个项目'} · {dimensionLabel(review.dimension)}</p>
    {review.description && <details className="pce-old-standard"><summary>当时的检查标准</summary><p>{review.description}</p></details>}
    <div className="pce-evidence-readonly"><span>当时的证据</span><p>{review.evidence?.trim() || '当时未填写证据。'}</p></div>
  </article>;
}

function CheckForm({ project, check, onSave, onClose }) {
  const plans = useMemo(() => buildProjectCheckPlan(project), [project]);
  const priorStatus = check ? getCheckStatus(project, check) : 'pending';
  const needsRetest = priorStatus === 'stale';
  const refreshedCriterion = needsRetest && check?.dimension && !check.customCriterion
    ? plans.find(item => item.pageId === check.pageId && item.dimension === check.dimension) : null;
  const [draft, setDraft] = useState(() => ({
    name: refreshedCriterion?.name || check?.name || '', description: refreshedCriterion?.description || check?.description || '',
    pageId: check ? check.pageId || '' : project.pages[0]?.id || '',
    dimension: check?.dimension || 'custom',
    status: needsRetest ? 'pending' : priorStatus,
    evidence: needsRetest ? '' : check?.evidence || '',
    customCriterion: !!check?.customCriterion,
  }));
  const [definitionChanged, setDefinitionChanged] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const nameRef = useRef(null);
  const evidenceRef = useRef(null);
  const editingRevision = useRef(`${project.snapshot.revision}:${project.designRevision ?? 1}`);
  const hintId = useId();
  const errorId = useId();
  const criterion = plans.find(item => item.pageId === draft.pageId && item.dimension === draft.dimension);
  const history = [...(check?.history || [])].slice(-20).reverse();
  const customStandard = !!criterion && (draft.customCriterion || draft.name.trim() !== criterion.name.trim() || draft.description.trim() !== criterion.description.trim());
  useEffect(() => {
    const revision = `${project.snapshot.revision}:${project.designRevision ?? 1}`;
    if (editingRevision.current !== revision) {
      editingRevision.current = revision;
      setDraft(old => ({ ...old, status: 'pending', evidence: '' }));
      setDefinitionChanged(true);
    }
  }, [project.snapshot.revision, project.designRevision]);
  const clearError = () => { setError(''); setFieldError(''); };
  const definitionPatch = changes => {
    setDraft(old => ({ ...old, ...changes, status: 'pending', evidence: '' }));
    setDefinitionChanged(true);
    clearError();
  };
  const changeDefinition = (key, value) => {
    if (draft[key] === value) return;
    const changes = { [key]: value };
    if (criterion && ['name', 'description'].includes(key)) changes.customCriterion = (key === 'name' ? value : draft.name).trim() !== criterion.name.trim()
      || (key === 'description' ? value : draft.description).trim() !== criterion.description.trim();
    definitionPatch(changes);
  };
  const changeScope = (pageId, dimension) => {
    const selectedDimension = pageId ? dimension : 'custom';
    if (pageId === draft.pageId && selectedDimension === draft.dimension) return;
    const nextCriterion = plans.find(item => item.pageId === pageId && item.dimension === selectedDimension);
    const generatedName = !draft.name.trim() || draft.name === criterion?.name;
    definitionPatch({ pageId, dimension: selectedDimension,
      ...(nextCriterion ? { description: nextCriterion.description, name: generatedName ? nextCriterion.name : draft.name } : {}),
      customCriterion: false,
    });
  };
  const fail = (message, field) => {
    setError(message); setFieldError(field || '');
    if (field === 'name') nameRef.current?.focus();
    if (field === 'evidence') evidenceRef.current?.focus();
  };
  const submit = event => {
    event.preventDefault();
    if (!draft.name.trim()) return fail('请填写检查项名称。', 'name');
    if (draft.pageId && !project.pages.some(page => page.id === draft.pageId)) return fail('当前页面已不存在，请重新选择检查范围。');
    if (draft.dimension !== 'custom' && !criterion) return fail('请选择具体页面和有效的检查维度。');
    if (['passed', 'failed'].includes(draft.status) && !draft.evidence.trim()) return fail('记录通过或需要修复之前，请填写本次实际检查的证据。', 'evidence');
    const payload = {
      ...(check?.id ? { id: check.id } : {}),
      name: draft.name.trim(), description: draft.description.trim(), pageId: draft.pageId,
      dimension: draft.dimension,
      ...(criterion ? { criterionKey: criterion.criterionKey } : {}),
      customCriterion: customStandard,
      status: draft.status, evidence: draft.evidence.trim(),
    };
    // The model owns timestamps, historical revisions, and immutable prior evidence.
    try { onSave(payload); } catch (reason) { fail(reason.message || '检查记录未保存，请检查填写内容。'); }
  };

  return <form className="cv-form pce-form" onSubmit={submit} noValidate>
    <p className="pce-revision">{needsRetest ? <><span>上次 {revisionLabel(check.baselineRevision, check.designRevision)}</span><span aria-hidden="true">→</span><strong>本次 {revisionLabel(project.snapshot.revision, project.designRevision)}</strong></> : <>本次检查绑定 <strong>{revisionLabel(project.snapshot.revision, project.designRevision)}</strong></>}</p>
    {needsRetest && <div className="notice"><strong>当前版本需要重新检查。</strong><p>上次结论与证据保留在下方。{refreshedCriterion ? '下方标准已更新为当前页面的标题、字段与操作。' : check.customCriterion ? '下方保留了你自定义的标准，请核对是否仍适用于当前页面。' : ''}完成本次检查后，重新选择结论并填写证据。</p></div>}
    {needsRetest && <PreviousReview review={check} project={project} current/>}
    <label className="field">检查项名称<input ref={nameRef} autoFocus value={draft.name} onChange={event => changeDefinition('name', event.target.value)} required maxLength={160} aria-invalid={fieldError === 'name'} aria-describedby={fieldError === 'name' ? errorId : undefined} placeholder="例如：提交失败后的字段保留与恢复"/></label>
    <div className="pce-scope-fields">
      <label className="field">检查范围<select value={draft.pageId} onChange={event => changeScope(event.target.value, draft.dimension)}><option value="">整个项目</option>{project.pages.map(page => <option value={page.id} key={page.id}>{page.name}</option>)}</select></label>
      <label className="field">检查维度<select value={draft.dimension} onChange={event => changeScope(draft.pageId, event.target.value)}><option value="custom">自定义检查</option>{CHECK_DIMENSIONS.map(dimension => <option value={dimension.id} key={dimension.id} disabled={!draft.pageId}>{dimension.label}</option>)}</select></label>
    </div>
    <p className="cv-field-help">{draft.pageId ? '选择验收维度会带入该页面的检查标准。切换范围或维度后，需要重新记录结论与证据。' : '整个项目采用自定义检查；每个页面的四个验收维度需分别记录。'}</p>
    <label className="field">检查标准<textarea rows={5} value={draft.description} onChange={event => changeDefinition('description', event.target.value)} placeholder="说明检查步骤、预期表现及需要核对的界面。"/></label>
    {criterion && <div className="pce-criterion-source"><span>{customStandard ? '已自定义检查标准' : '采用当前页面检查标准'} · {dimensionLabel(draft.dimension)}</span>{customStandard && <button type="button" className="cv-text-link" onClick={() => definitionPatch({ name: criterion.name, description: criterion.description, customCriterion: false })}>恢复当前标准</button>}</div>}
    {definitionChanged && <p className="pce-definition-note" role="status">检查范围或标准已调整，原结论已清空。请按新的检查内容重新选择结论并填写证据。</p>}
    <label className="field">本次人工结论<select value={draft.status} onChange={event => { setDraft(old => ({ ...old, status: event.target.value })); clearError(); }}><option value="pending">待检查</option><option value="passed">人工通过</option><option value="failed">需要修复</option></select></label>
    <label className="field">{needsRetest ? '本次复验证据' : '证据说明'}{['passed', 'failed'].includes(draft.status) ? '（必填）' : '（待检查时可暂不填写）'}<textarea ref={evidenceRef} rows={4} value={draft.evidence} onChange={event => { setDraft(old => ({ ...old, evidence: event.target.value })); clearError(); }} required={['passed', 'failed'].includes(draft.status)} aria-invalid={fieldError === 'evidence'} aria-describedby={`${hintId}${fieldError === 'evidence' ? ` ${errorId}` : ''}`} placeholder="记录实际操作、查看的页面或截图位置、结果及未完成的检查范围。"/></label>
    <p className="cv-field-help" id={hintId}>{needsRetest ? '旧证据不会自动带入本次复验。相同结论也需要重新核对并填写。' : '记录人工检查的事实；未执行或尚未核对的内容请保留为待检查。'}</p>
    {check && <details className="pce-history"><summary>历史记录{history.length ? ` · 最近 ${history.length} 次` : ''}</summary>{history.length ? <div className="pce-history-list">{history.map((review, index) => <PreviousReview key={`${review.archivedAt || review.updatedAt || 'review'}-${index}`} review={review} project={project}/>)}</div> : <p className="pce-empty-history">暂无已归档历史。修改并保存后，原有检查记录由系统保留。</p>}</details>}
    {error && <p className="cv-form-error" role="alert" id={errorId}>{error}</p>}
    <div className="cv-dialog-actions"><button className="button" type="button" onClick={onClose}>取消</button><button className="button primary" type="submit">{needsRetest ? '保存本次复验' : '保存检查记录'}</button></div>
  </form>;
}

export default function ProjectCheckEditor(props) {
  return <CheckForm key={`${props.project.id}:${props.check?.id || 'new'}`} {...props}/>;
}
