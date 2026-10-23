import type { PageTheme, PageThemeColorKey, PageThemeSizeKey, PageThemeSizes } from '@shared/content/page-document';
import config from './page-theme.config.json';

/** The registry is JSON-editable; CSS declarations always come from these trusted entries. */
export const PAGE_THEME_FONTS: readonly { id: string; label: string; css: string }[] = config.fonts;
export const PAGE_THEME_PRESETS = config.presets;
export const PAGE_THEME_SIZE_KEYS: readonly PageThemeSizeKey[] = ['body', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'small', 'label'];
export const PAGE_THEME_COLOR_KEYS: readonly PageThemeColorKey[] = ['text', 'heading', 'link', 'accent', 'background'];

const defaults = config.defaults as PageTheme;
const allowedFont = (id: string): boolean => PAGE_THEME_FONTS.some((entry) => entry.id === id);
const sizeRange = (key: PageThemeSizeKey): readonly [number, number] =>
  key === 'h1' ? [16, 128] : key.startsWith('h') ? [12, 100] : [10, 40];

export function defaultPageTheme(): PageTheme {
  return structuredClone(defaults);
}

export function pageThemeWithDefaults(theme?: PageTheme | null): PageTheme {
  const base = defaultPageTheme();
  return {
    ...base, ...theme,
    colors: { ...base.colors, ...theme?.colors },
    sizes: { ...base.sizes, ...theme?.sizes },
    responsive: {
      tablet: { ...theme?.responsive?.tablet },
      mobile: { ...theme?.responsive?.mobile },
    },
  };
}

/** Strict editor-side validation: unknown keys, CSS strings and unsafe font IDs cannot be saved. */
export function parsePageTheme(value: unknown): PageTheme {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Theme must be a JSON object.');
  const data = value as Record<string, unknown>;
  const allowed = ['fontBody', 'fontHeading', 'fontAccent', 'colors', 'sizes', 'lineHeight', 'letterSpacing', 'contentMaxWidth', 'readingMaxWidth', 'responsive'];
  if (Object.keys(data).some((key) => !allowed.includes(key))) throw new Error('Unknown theme property.');
  const result: PageTheme = {};
  for (const key of ['fontBody', 'fontHeading', 'fontAccent'] as const) {
    if (data[key] !== undefined) {
      if (typeof data[key] !== 'string' || !allowedFont(data[key])) throw new Error(`Unknown font: ${String(data[key])}`);
      result[key] = data[key];
    }
  }
  const numeric = (value: unknown, min: number, max: number, name: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
      throw new Error(`Invalid ${name} (${min}–${max}).`);
    return value;
  };
  const sizes = (value: unknown): Partial<PageThemeSizes> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid font sizes.');
    const source = value as Record<string, unknown>;
    if (Object.keys(source).some((key) => !PAGE_THEME_SIZE_KEYS.includes(key as PageThemeSizeKey)))
      throw new Error('Unknown font-size role.');
    const entries = Object.entries(source).map(([key, val]) => {
      const [min, max] = sizeRange(key as PageThemeSizeKey);
      return [key, numeric(val, min, max, key)];
    });
    return Object.fromEntries(entries) as Partial<PageThemeSizes>;
  };
  if (data['sizes'] !== undefined) result.sizes = sizes(data['sizes']);
  if (data['colors'] !== undefined) {
    const source = data['colors'];
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Invalid theme colors.');
    const colors = source as Record<string, unknown>;
    if (Object.keys(colors).some((key) => !PAGE_THEME_COLOR_KEYS.includes(key as PageThemeColorKey)))
      throw new Error('Unknown theme color.');
    result.colors = {};
    for (const key of PAGE_THEME_COLOR_KEYS) {
      if (colors[key] !== undefined) {
        if (typeof colors[key] !== 'string' || !/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(colors[key]))
          throw new Error(`Invalid color: ${key}.`);
        result.colors[key] = colors[key].toLowerCase();
      }
    }
  }
  for (const [key, min, max] of [
    ['lineHeight', 1, 3], ['letterSpacing', -2, 12],
    ['contentMaxWidth', 320, 2400], ['readingMaxWidth', 320, 1600],
  ] as const) if (data[key] !== undefined) result[key] = numeric(data[key], min, max, key);
  if (data['responsive'] !== undefined) {
    const responsive = data['responsive'];
    if (!responsive || typeof responsive !== 'object' || Array.isArray(responsive)) throw new Error('Invalid responsive settings.');
    const source = responsive as Record<string, unknown>;
    if (Object.keys(source).some((key) => key !== 'tablet' && key !== 'mobile')) throw new Error('Unknown breakpoint.');
    result.responsive = {};
    for (const breakpoint of ['tablet', 'mobile'] as const) {
      if (source[breakpoint] !== undefined) result.responsive[breakpoint] = sizes(source[breakpoint]);
    }
  }
  return result;
}

/** CSS variables only, no arbitrary CSS, URLs, or font-family strings from documents. */
export function pageThemeVars(theme?: PageTheme | null): Record<string, string> {
  if (!theme) return {};
  const value = pageThemeWithDefaults(theme);
  const vars: Record<string, string> = {};
  for (const [field, token] of [['fontBody', 'body'], ['fontHeading', 'heading'], ['fontAccent', 'accent']] as const) {
    const font = PAGE_THEME_FONTS.find((entry) => entry.id === value[field]);
    vars[`--pc-theme-font-${token}`] = font?.css ?? 'system-ui, sans-serif';
  }
  for (const key of PAGE_THEME_COLOR_KEYS) vars[`--pc-theme-color-${key}`] = value.colors?.[key] ?? '#ffffffff';
  for (const key of PAGE_THEME_SIZE_KEYS) {
    const size = value.sizes?.[key] ?? 16;
    vars[`--pc-theme-size-${key}`] = `${size}px`;
    vars[`--pc-theme-tablet-size-${key}`] = `${value.responsive?.tablet?.[key] ?? size}px`;
    vars[`--pc-theme-mobile-size-${key}`] = `${value.responsive?.mobile?.[key] ?? value.responsive?.tablet?.[key] ?? size}px`;
  }
  vars['--pc-theme-line-height'] = String(value.lineHeight ?? 1.65);
  vars['--pc-theme-letter-spacing'] = `${value.letterSpacing ?? 0}px`;
  vars['--pc-theme-content-width'] = `${value.contentMaxWidth ?? 1200}px`;
  vars['--pc-theme-reading-width'] = `${value.readingMaxWidth ?? 720}px`;
  return vars;
}
