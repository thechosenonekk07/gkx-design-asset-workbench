import React, { forwardRef } from 'react';
import { Button, ProgressBar } from 'react-aria-components';
import { Plus, Check, Download, ArrowRight, Search, Save, Trash2 } from 'lucide-react';
import { normalizeButtonConfig } from './componentConfig.js';
import './asset-button.css';

export { normalizeButtonConfig } from './componentConfig.js';

const ICONS = { plus: Plus, check: Check, download: Download, 'arrow-right': ArrowRight, search: Search, save: Save, trash: Trash2 };
const CONFIG_KEYS = ['label', 'variant', 'theme', 'size', 'shape', 'type', 'block', 'ghost', 'loading', 'disabled', 'icon', 'suffix'];

function Icon({ name }) {
  const Glyph = ICONS[name];
  return Glyph ? <Glyph className="asset-button-icon" size={16} aria-hidden="true" focusable="false" /> : null;
}

/** A native React Aria button shared by the asset preview and composed flows. */
export const AssetButton = forwardRef(function AssetButton({ config = {}, children, className = '', ...props }, ref) {
  const overrides = {};
  const buttonProps = { ...props };
  for (const key of CONFIG_KEYS) {
    if (props[key] !== undefined) overrides[key] = props[key];
    delete buttonProps[key];
  }
  // Do not let legacy navigation properties leak into the native button.
  for (const key of ['tag', 'href', 'target', 'rel', 'external']) delete buttonProps[key];
  const resolved = normalizeButtonConfig({ ...config, ...overrides });
  const iconOnly = ['square', 'circle'].includes(resolved.shape);
  const label = props.label || (typeof children === 'string' || typeof children === 'number' ? String(children) : resolved.label);
  const pending = resolved.loading || !!buttonProps.isPending;
  const disabled = resolved.disabled || !!buttonProps.isDisabled;
  const icon = resolved.icon !== 'none' ? resolved.icon : iconOnly ? (resolved.suffix !== 'none' ? resolved.suffix : 'plus') : 'none';
  return <Button
    {...buttonProps}
    ref={ref}
    type={resolved.type}
    isDisabled={disabled}
    isPending={pending}
    aria-busy={pending || undefined}
    aria-label={props['aria-label'] || (iconOnly ? label : undefined)}
    title={props.title || (iconOnly ? label : undefined)}
    className={state => `asset-button ${typeof className === 'function' ? className(state) : className}`.trim()}
    data-variant={resolved.variant}
    data-theme={resolved.theme}
    data-shape={resolved.shape}
    data-size={resolved.size}
    data-block={resolved.block || undefined}
    data-ghost={resolved.ghost || undefined}
    data-icon-only={iconOnly || undefined}
  >
    {pending ? <ProgressBar isIndeterminate aria-label="处理中" className="asset-button-progress"><span className="asset-button-spinner" aria-hidden="true" /></ProgressBar> : <Icon name={icon} />}
    {!iconOnly && <span className="asset-button-label">{children ?? resolved.label}</span>}
    {!iconOnly && <Icon name={resolved.suffix} />}
  </Button>;
});
