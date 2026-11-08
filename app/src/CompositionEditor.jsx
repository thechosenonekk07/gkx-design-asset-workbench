import React, { useId, useState } from 'react';
import { ComponentPreview } from './ComponentPreview.jsx';
import { FlowPreview, canRunFlow } from './FlowPreview.jsx';
import { tokenCSS } from './model.js';
import {
  COMPOSITION_LIMITS, normalizeComposition, validateComposition, createCompositionInstance,
  createCompositionRegion, moveCompositionRegion, moveCompositionItem, moveCompositionItemToRegion,
} from './composition.js';
import './composition.css';

const assets = (source, layer) => Array.isArray(source?.[layer]) ? source[layer] : [];
const getAsset = (source, item) => assets(source, item.layer).find(asset => asset.id === item.assetId);
const kindName = layer => layer === 'patterns' ? '交互模式' : '组件';

function RegionEditor({ region, index, composition, source, commit }) {
  const [selection, setSelection] = useState('');
  const uid = useId();
  const patch = update => commit(next => ({ ...next, regions: next.regions.map(current => current.id === region.id ? { ...current, ...update } : current) }));
  const editItem = (id, update) => patch({ items: region.items.map(item => item.id === id ? { ...item, ...update } : item) });
  const regionLabel = region.title || `区域 ${index + 1}`;
  const itemCount = composition.regions.reduce((total, current) => total + current.items.length, 0);
  const full = region.items.length >= COMPOSITION_LIMITS.itemsPerRegion || itemCount >= COMPOSITION_LIMITS.totalItems;
  return <fieldset className="ce-region-editor">
    <legend>区域 {index + 1}</legend>
    <div className="ce-region-controls">
      <label htmlFor={`${uid}-title`}>区域标题<input id={`${uid}-title`} value={region.title} maxLength={120} onChange={event => patch({ title: event.target.value })} placeholder="例如：筛选区、主要内容、辅助信息" /></label>
      <label htmlFor={`${uid}-columns`}>排列列数<select id={`${uid}-columns`} value={region.columns} onChange={event => patch({ columns: Number(event.target.value) })}><option value={1}>一列</option><option value={2}>两列</option><option value={3}>三列</option></select></label>
    </div>
    <div className="ce-order-actions">
      <button type="button" disabled={index === 0} onClick={() => commit(next => moveCompositionRegion(next, region.id, -1))} aria-label={`上移区域：${regionLabel}`}>↑ 上移</button>
      <button type="button" disabled={index === composition.regions.length - 1} onClick={() => commit(next => moveCompositionRegion(next, region.id, 1))} aria-label={`下移区域：${regionLabel}`}>↓ 下移</button>
      <button type="button" className="ce-remove" onClick={() => commit(next => ({ ...next, regions: next.regions.filter(current => current.id !== region.id) }))} aria-label={`移除区域：${regionLabel}`}>移除区域</button>
    </div>
    <ol className="ce-instance-list">{region.items.map((item, itemIndex) => {
      const asset = getAsset(source, item);
      const name = asset?.name || item.assetId;
      return <li key={item.id} className="ce-instance-editor">
        <div className="ce-instance-heading"><strong>{itemIndex + 1}. {name}</strong><small>{kindName(item.layer)}</small></div>
        <label>实例文案<input value={item.label || ''} maxLength={160} placeholder={item.layer === 'patterns' ? '留空沿用模式名称' : '留空沿用组件文案'} onChange={event => editItem(item.id, { label: event.target.value })} aria-label={`${regionLabel}中第 ${itemIndex + 1} 项的实例文案`} /></label>
        <div className="ce-order-actions">
          <button type="button" disabled={itemIndex === 0} onClick={() => commit(next => moveCompositionItem(next, region.id, item.id, -1))} aria-label={`上移第 ${itemIndex + 1} 项：${name}`}>↑ 上移</button>
          <button type="button" disabled={itemIndex === region.items.length - 1} onClick={() => commit(next => moveCompositionItem(next, region.id, item.id, 1))} aria-label={`下移第 ${itemIndex + 1} 项：${name}`}>↓ 下移</button>
          {composition.regions.length > 1 && <select aria-label={`将第 ${itemIndex + 1} 项 ${name} 移动到区域`} value={region.id} onChange={event => commit(next => moveCompositionItemToRegion(next, region.id, event.target.value, item.id))}>{composition.regions.map((target, targetIndex) => <option key={target.id} value={target.id} disabled={target.id !== region.id && target.items.length >= COMPOSITION_LIMITS.itemsPerRegion}>{targetIndex + 1}. {target.title || '未命名区域'}</option>)}</select>}
          <button type="button" className="ce-remove" onClick={() => patch({ items: region.items.filter(current => current.id !== item.id) })} aria-label={`移除第 ${itemIndex + 1} 项：${name}`}>移除</button>
        </div>
      </li>;
    })}</ol>
    {!region.items.length && <p className="ce-help ce-empty">此区域还没有内容，请从共享库加入组件或交互模式。</p>}
    <div className="ce-add-instance"><select aria-label={`为${regionLabel}选择资产`} value={selection} onChange={event => setSelection(event.target.value)}><option value="">选择组件或交互模式</option>{['patterns', 'components'].map(layer => <optgroup label={kindName(layer)} key={layer}>{assets(source, layer).map(asset => <option key={asset.id} value={JSON.stringify([layer, asset.id])}>{asset.name}</option>)}</optgroup>)}</select><button type="button" className="button" disabled={!selection || full} onClick={() => {
      const [layer, assetId] = JSON.parse(selection);
      patch({ items: [...region.items, createCompositionInstance(layer, assetId)] });
    }}>加入区域</button></div>
    {full && <p className="ce-help">此区域或页面的实例数量已达到上限。</p>}
  </fieldset>;
}

export function CompositionEditor({ composition, source, onChange }) {
  const [message, setMessage] = useState('');
  const errors = validateComposition(composition, source);
  if (errors.length) return <div className="ce-error" role="alert">页面结构暂时无法编辑：{errors.join(' ')}</div>;
  const commit = updater => {
    try { onChange(normalizeComposition(updater(normalizeComposition(composition)), source)); setMessage(''); }
    catch (error) { setMessage(error.message); }
  };
  return <div className="ce-editor">
    <p className="ce-help">按页面区域编排内容。同一资产可重复加入，实例文案仅影响本页；窄屏自动排列为一列。</p>
    {composition.regions.map((region, index) => <RegionEditor key={region.id} region={region} index={index} composition={composition} source={source} commit={commit} />)}
    <button type="button" className="button" disabled={composition.regions.length >= COMPOSITION_LIMITS.regions} onClick={() => commit(next => ({ ...next, regions: [...next.regions, createCompositionRegion(`区域 ${next.regions.length + 1}`)] }))}>＋ 添加区域</button>
    {message && <p className="ce-error" role="alert">{message}</p>}
  </div>;
}

function IndependentComponent({ asset, label, source, theme, onEvent }) {
  const config = { ...asset.config };
  if (label?.trim()) {
    // Use a supported text field only. Assets without one receive a slot heading instead.
    if (Object.hasOwn(config, 'label')) config.label = label;
    else if (Object.hasOwn(config, 'title')) config.title = label;
  }
  return <div className="ce-component-sample" style={tokenCSS(source, asset.bindings, theme)}><ComponentPreview kind={asset.kind} config={config} onEvent={onEvent} /></div>;
}

function PatternInstance({ asset, source, theme, onEvent }) {
  if (canRunFlow(asset, source)) return <FlowPreview pattern={asset} source={source} theme={theme} onEvent={onEvent} />;
  return <div className="ce-pattern-fallback">
    <p className="ce-help">此模式尚未连接跨组件行为，可独立试用下方组件并核对已定义的步骤。</p>
    {asset.steps?.length > 0 && <ol className="ce-pattern-steps">{asset.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>}
    <div className="ce-fallback-components">{(asset.componentIds || []).map(id => assets(source, 'components').find(component => component.id === id)).filter(Boolean).map(component => <div key={component.id}><p className="ce-instance-caption">{component.name}</p><IndependentComponent asset={component} source={source} theme={theme} onEvent={onEvent} /></div>)}</div>
  </div>;
}

export function CompositionPreview({ composition, source, theme = 'light', onEvent }) {
  const uid = useId();
  const errors = validateComposition(composition, source);
  if (errors.length) return <div className="ce-error" role="alert">页面结构无法预览：{errors.join(' ')}</div>;
  return <div className="ce-preview" style={tokenCSS(source, {}, theme)} data-theme={theme}>
    <p className="ce-preview-note">区域编排预览 · 各实例独立试用，区域之间尚未连接数据与业务行为。</p>
    {composition.regions.map((region, index) => <section className="ce-preview-region" key={region.id} aria-labelledby={`${uid}-${index}`}>
      <h3 id={`${uid}-${index}`}>{region.title || `区域 ${index + 1}`}</h3>
      <div className="ce-preview-grid" data-columns={region.columns}>{region.items.map(item => {
        const asset = getAsset(source, item);
        return <div className="ce-preview-instance" key={item.id} data-instance={item.id}>
          <p className="ce-instance-caption">{item.label?.trim() || asset.name}</p>
          {item.layer === 'patterns' ? <PatternInstance asset={asset} source={source} theme={theme} onEvent={onEvent} /> : <IndependentComponent asset={asset} label={item.label} source={source} theme={theme} onEvent={onEvent} />}
        </div>;
      })}</div>
      {!region.items.length && <p className="ce-help ce-empty">此区域尚未加入内容。</p>}
    </section>)}
    {!composition.regions.length && <p className="ce-help ce-empty">在模板编辑中添加区域后，这里显示页面结构。</p>}
  </div>;
}
