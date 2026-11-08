import React, { useId, useRef, useState } from 'react';
import './delivery-reuse.css';

function suggestedName(name) {
  const suffix = ' · 新方案';
  const characters = Array.from(name || '设计项目');
  while (characters.join('').length + suffix.length > 120) characters.pop();
  return characters.join('') + suffix;
}

function ReuseForm({ record, onCreate, onCancel }) {
  const archived = record.package.project;
  const pages = archived.pages || [];
  const [name, setName] = useState(() => suggestedName(archived.name));
  const [description, setDescription] = useState('');
  const [pageIds, setPageIds] = useState(() => pages.map(page => page.id));
  const [copyCheckStandards, setCopyCheckStandards] = useState(true);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const nameRef = useRef(null);
  const descriptionRef = useRef(null);
  const firstPageRef = useRef(null);
  const errorId = useId();
  const pagesHintId = useId();
  const checksHintId = useId();
  const clearError = () => { setError(''); setFieldError(''); };
  const changePages = value => { setPageIds(value); clearError(); };
  const fail = (message, field) => {
    setError(message); setFieldError(field || '');
    if (field === 'name') nameRef.current?.focus();
    if (field === 'description') descriptionRef.current?.focus();
    if (field === 'pages') firstPageRef.current?.focus();
  };
  const submit = event => {
    event.preventDefault();
    if (!name.trim()) return fail('请填写新项目名称。', 'name');
    if (name.trim().length > 120) return fail('项目名称最多 120 个字符，请缩短后再创建。', 'name');
    if (description.trim().length > 2000) return fail('项目说明最多 2000 个字符，请缩短后再创建。', 'description');
    const selectedIds = pages.filter(page => pageIds.includes(page.id)).map(page => page.id);
    if (!selectedIds.length) return fail('请至少选择一个页面，再创建新项目。', 'pages');
    try {
      onCreate({ name: name.trim(), description: description.trim(), pageIds: selectedIds, copyCheckStandards });
    } catch (reason) {
      fail(reason?.message || '新项目未创建，请检查填写内容后重试。');
    }
  };
  return <form className="cv-form dr-form" onSubmit={submit} noValidate aria-label="从交付版本创建项目">
    <div className="dr-source">
      <strong>{record.title}</strong>
      <span>{record.package.mode === 'reviewed' ? '人工验收交付' : '协作草稿'} · r{archived.snapshot.revision} / d{archived.designRevision ?? 1}</span>
    </div>
    <p className="dr-intro">沿用留档时的规范、主题和页面配置，开始一个可独立编辑的新项目。</p>
    <label className="field">新项目名称<input ref={nameRef} autoFocus required maxLength={120} value={name} onChange={event => { setName(event.target.value); clearError(); }} aria-invalid={fieldError === 'name'} aria-describedby={fieldError === 'name' ? errorId : undefined} placeholder="例如：客户服务平台"/></label>
    <label className="field">项目说明<span className="dr-optional">选填</span><textarea ref={descriptionRef} rows={3} maxLength={2000} value={description} onChange={event => { setDescription(event.target.value); clearError(); }} aria-invalid={fieldError === 'description'} aria-describedby={fieldError === 'description' ? errorId : undefined} placeholder="说明新项目的用途，以及准备调整的内容"/></label>
    <fieldset className="dr-pages" aria-describedby={`${pagesHintId}${fieldError === 'pages' ? ` ${errorId}` : ''}`} aria-invalid={fieldError === 'pages'}>
      <legend>选择起始页面</legend>
      <div className="dr-selection-tools"><p id={pagesHintId}>已选择 {pageIds.length} / {pages.length} 个页面</p>{pages.length > 0 && <div><button type="button" className="cv-text-link" disabled={pageIds.length === pages.length} onClick={() => changePages(pages.map(page => page.id))}>全选</button><button type="button" className="cv-text-link" disabled={!pageIds.length} onClick={() => changePages([])}>清空选择</button></div>}</div>
      {pages.length ? <div className="dr-page-list">{pages.map((page, index) => {
        const template = archived.snapshot.templates?.find(item => item.id === page.templateId);
        return <label className="dr-page-option" key={page.id}>
          <input type="checkbox" ref={index === 0 ? firstPageRef : undefined} checked={pageIds.includes(page.id)} onChange={event => changePages(event.target.checked ? [...pageIds, page.id] : pageIds.filter(id => id !== page.id))}/>
          <span><strong>{page.name}</strong>{template?.name && <small>{template.name}</small>}</span>
        </label>;
      })}</div> : <p className="dr-empty">此交付记录没有页面，请选择包含页面的交付版本。</p>}
    </fieldset>
    <div className="dr-check-option"><label><input type="checkbox" checked={copyCheckStandards} onChange={event => { setCopyCheckStandards(event.target.checked); clearError(); }} aria-describedby={checksHintId}/><span>沿用自定义检查标准</span></label><p id={checksHintId}>基础检查会按新项目重新生成，全部从“待检查”开始。勾选后也会沿用所选页面及整个项目的自定义标准；原结论、证据与检查历史不带入。</p></div>
    <p className="dr-summary">新项目包含 {pageIds.length} 个页面。后续编辑仅作用于新项目，原项目和交付记录保持原样。</p>
    {error && <p role="alert" id={errorId} className="cv-form-error">{error}</p>}
    <div className="cv-dialog-actions"><button type="button" className="button" onClick={onCancel}>取消</button><button type="submit" className="button primary" disabled={!pages.length}>创建新项目</button></div>
  </form>;
}

export default function DeliveryReuseForm(props) {
  return <ReuseForm key={props.record.id} {...props}/>;
}
