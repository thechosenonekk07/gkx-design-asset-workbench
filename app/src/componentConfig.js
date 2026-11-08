import {EXTENDED_KINDS,normalizeExtendedConfig} from './extendedCatalog.js';
/** Portable configuration for the workbench's Button implementation. */
export const BUTTON_VARIANTS = Object.freeze(['base', 'outline', 'dashed', 'text']);
export const BUTTON_THEMES = Object.freeze(['default', 'primary', 'success', 'warning', 'danger']);
export const BUTTON_SHAPES = Object.freeze(['rectangle', 'round', 'square', 'circle']);
export const BUTTON_ICONS = Object.freeze(['none', 'plus', 'check', 'download', 'arrow-right', 'search', 'save', 'trash']);

const oneOf = (value, choices, fallback) => choices.includes(value) ? value : fallback;
const iconName = (value, fallback) => value === true ? fallback : oneOf(value, BUTTON_ICONS, 'none');

/**
 * The previous library encoded priority and tone in `variant`. Translate it once
 * so old assets remain usable without conflating appearance and semantic theme.
 * Unrelated fields are retained for callers that store their own component data.
 */
export function normalizeButtonConfig(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  let variant = source.variant;
  let theme = source.theme;
  const hasExplicitTheme = BUTTON_THEMES.includes(theme);
  if (variant === 'primary') { variant = 'base'; if (!hasExplicitTheme) theme = 'primary'; }
  else if (variant === 'secondary') { variant = 'outline'; if (!hasExplicitTheme) theme = 'default'; }
  else if (variant === 'quiet') { variant = 'text'; if (!hasExplicitTheme) theme = 'primary'; }
  else if (variant === 'danger') { variant = 'base'; if (!hasExplicitTheme) theme = 'danger'; }
  variant = oneOf(variant, BUTTON_VARIANTS, 'base');
  theme = oneOf(theme, BUTTON_THEMES, 'primary');
  const shape = oneOf(source.shape, BUTTON_SHAPES, 'rectangle');
  const iconOnly = shape === 'square' || shape === 'circle';
  const config = {
    ...source,
    label: typeof source.label === 'string' && source.label.trim() ? source.label : '执行操作',
    variant,
    theme,
    size: oneOf(source.size, ['small', 'medium', 'large'], 'medium'),
    shape,
    type: oneOf(source.type, ['button', 'submit', 'reset'], 'button'),
    block: !iconOnly && source.block === true,
    ghost: source.ghost === true,
    loading: source.loading === true,
    disabled: source.disabled === true,
    icon: iconName(source.icon, 'plus'),
    suffix: iconName(source.suffix, 'arrow-right'),
  };
  // A Button always renders a native button. Navigation belongs to Link.
  for (const key of ['tag', 'href', 'target', 'rel', 'external']) delete config[key];
  return config;
}

/** Resolve old saved button priorities before adding new defaults. */
export function resolveComponentConfig(kind, input = {}, defaults = {}) {
  if(EXTENDED_KINDS.has(kind)) return normalizeExtendedConfig(kind,{...defaults,...input});
  if (kind === 'button') return {...defaults, ...normalizeButtonConfig({...input, label:input.label ?? defaults.label})};
  const config = {...defaults, ...input};
  if (['select', 'tabs'].includes(kind) && Array.isArray(config.options)) {
    config.options = [...new Set(config.options.map(String).filter(Boolean))];
    if (!config.options.includes(config.value)) config.value = kind === 'tabs' ? (config.options[0] || '') : '';
  }
  return config;
}
export function safeLinkHref(value) {
  const href = typeof value === 'string' ? value.trim() : '';
  if (!href || /[\u0000-\u0020\u007f]/.test(href) || /^(?:javascript|data|vbscript):/i.test(href)) return '#';
  const scheme = href.match(/^([a-z][a-z\d+.-]*):/i)?.[1];
  return scheme && !['http','https','mailto','tel'].includes(scheme.toLowerCase()) ? '#' : href;
}
