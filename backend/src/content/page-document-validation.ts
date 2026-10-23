import type {
  PageAlbumPalette,
  PageBlock,
  ComposerBackground,
  PageCardItem,
  PageColumn,
  PageDocument,
  PageComposerProfile,
  PageGalleryItem,
  PageNode,
  PageRow,
  PageSection,
  PageStyles,
  LocalizedText,
  RowLayout,
  PageTheme,
  PageThemeSizes,
  PageThemeSizeKey,
} from '@shared/content/page-document';
import { BadRequestException } from '@nestjs/common';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DOCUMENT_BYTES = 350_000;

// Nest compiles CommonJS with a src-only rootDir. The public editor's
// shared TypeScript module cannot be imported here at runtime.
const ROW_LAYOUT_COLUMN_COUNTS: Readonly<Record<RowLayout, number>> = {
  '1': 1,
  '1-1': 2,
  '1-2': 2,
  '2-1': 2,
  '1-3': 2,
  '3-1': 2,
  '1-1-1': 3,
  '1-1-1-1': 4,
  '2-1-1': 3,
  '1-2-1': 3,
  '1-1-2': 3,
};

function invalid(message: string): never {
  throw new BadRequestException(`Invalid page document: ${message}`);
}
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    invalid('expected an object');
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 20_000): string {
  if (typeof value !== 'string' || value.length > max) invalid('invalid string');
  return value;
}
function number(value: unknown, max: number, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max)
    invalid('invalid style value');
  return value;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid('invalid collection');
  return value;
}
function id(value: unknown): string {
  const candidate = string(value, 80);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(candidate)) invalid('invalid node ID');
  return candidate;
}
function localized(value: unknown): LocalizedText {
  const data = record(value);
  return { de: string(data['de']), en: string(data['en']) };
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SURFACE_COLOR = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;
function surfaceColor(value: unknown): string {
  const color = string(value, 9);
  if (!SURFACE_COLOR.test(color)) invalid('invalid surface color');
  return color.toLowerCase();
}
function offset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -96 || value > 96)
    invalid('invalid shadow offset');
  return value;
}

function boxEdges(value: unknown): { top: number; right: number; bottom: number; left: number } {
  const data = record(value);
  return {
    top: number(data['top'], 160, 0),
    right: number(data['right'], 160, 0),
    bottom: number(data['bottom'], 160, 0),
    left: number(data['left'], 160, 0),
  };
}
function styleValues(data: Record<string, unknown>, defaults: boolean): PageStyles {
  const result: PageStyles = {};
  for (const key of ['paddingBox', 'marginBox'] as const) {
    if (data[key] !== undefined) result[key] = boxEdges(data[key]);
  }
  if (defaults || data['background'] !== undefined) {
    const value = data['background'] ?? 'none';
    if (!['none', 'glass', 'solid', 'accent'].includes(String(value)))
      invalid('invalid background preset');
    result.background = value as PageStyles['background'];
  }
  if (defaults || data['align'] !== undefined) {
    const value = data['align'] ?? 'left';
    if (!['left', 'center', 'right'].includes(String(value))) invalid('invalid alignment');
    result.align = value as PageStyles['align'];
  }
  for (const [key, max, fallback] of [
    ['padding', 96, 0],
    ['gap', 64, 16],
    ['radius', 48, 0],
  ] as const) {
    if (defaults || data[key] !== undefined) result[key] = number(data[key], max, fallback);
  }
  for (const key of ['backgroundColor', 'textColor'] as const) {
    if (data[key] !== undefined) result[key] = surfaceColor(data[key]);
  }
  return result;
}

function backgroundDesign(value: unknown): ComposerBackground {
  const data = record(value);
  const kind = data['kind'];
  const color = surfaceColor;
  if (kind === 'color') return { kind, color: color(data['color']) };
  if (kind === 'gradient') {
    const angle = data['angle'];
    const shape = data['shape'];
    if (![0, 45, 90, 135, 180].includes(angle as number)) invalid('invalid gradient angle');
    if (shape !== undefined && shape !== 'linear' && shape !== 'radial') invalid('invalid gradient shape');
    return {
      kind,
      from: color(data['from']),
      to: color(data['to']),
      angle: angle as 0 | 45 | 90 | 135 | 180,
      ...(shape === undefined ? {} : { shape: shape as 'linear' | 'radial' }),
    };
  }
  if (kind === 'image') {
    const position = data['position'];
    const overlay = data['overlay'];
    if (
      !['center', 'top', 'bottom'].includes(String(position)) ||
      !['none', 'soft', 'strong'].includes(String(overlay))
    )
      invalid('invalid image background');
    if (data['parallax'] !== undefined && typeof data['parallax'] !== 'boolean')
      invalid('invalid parallax flag');
    return {
      kind,
      assetId: assetId(data['assetId']),
      position: position as 'center' | 'top' | 'bottom',
      overlay: overlay as 'none' | 'soft' | 'strong',
      ...(data['parallax'] === undefined ? {} : { parallax: data['parallax'] as boolean }),
    };
  }
  return invalid('unsupported background kind');
}

function styles(value: unknown, allowDesign = false, allowTextShadow = false): PageStyles {
  const data = value === undefined ? {} : record(value);
  const result = styleValues(data, true);
  if (data['headingColor'] !== undefined) {
    if (!allowTextShadow) invalid('heading color is only valid on text blocks');
    result.headingColor = surfaceColor(data['headingColor']);
  }
  if (data['textShadow'] !== undefined) {
    if (!allowTextShadow || !['none', 'readability', 'strong'].includes(String(data['textShadow'])))
      invalid('invalid text shadow');
    result.textShadow = data['textShadow'] as 'none' | 'readability' | 'strong';
  }
  if (
    data['corners'] !== undefined ||
    data['border'] !== undefined ||
    data['shadow'] !== undefined
  ) {
    if (!allowDesign) invalid('surface controls are only valid on sections, rows and columns');
    if (data['corners'] !== undefined) {
      const corners = record(data['corners']);
      result.corners = {
        topLeft: number(corners['topLeft'], 160, 0),
        topRight: number(corners['topRight'], 160, 0),
        bottomRight: number(corners['bottomRight'], 160, 0),
        bottomLeft: number(corners['bottomLeft'], 160, 0),
      };
    }
    if (data['border'] !== undefined) {
      const border = record(data['border']);
      if (!['solid', 'dashed', 'dotted'].includes(String(border['style'])))
        invalid('invalid border style');
      result.border = {
        width: number(border['width'], 12, 0),
        style: border['style'] as 'solid' | 'dashed' | 'dotted',
        color: surfaceColor(border['color']),
      };
    }
    if (data['shadow'] !== undefined) {
      const shadow = record(data['shadow']);
      result.shadow = {
        x: offset(shadow['x']),
        y: offset(shadow['y']),
        blur: number(shadow['blur'], 160, 0),
        spread: offset(shadow['spread']),
        color: surfaceColor(shadow['color']),
      };
    }
  }
  if (data['spacing'] !== undefined || data['designBackground'] !== undefined) {
    if (!allowDesign) invalid('design controls are only valid on sections, rows and columns');
    if (data['spacing'] !== undefined) {
      const spacing = data['spacing'];
      if (!['small', 'standard', 'large'].includes(String(spacing)))
        invalid('invalid spacing preset');
      result.spacing = spacing as PageStyles['spacing'];
    }
    if (data['designBackground'] !== undefined)
      result.designBackground = backgroundDesign(data['designBackground']);
  }
  if (data['responsive'] !== undefined) {
    const responsive = record(data['responsive']);
    for (const key of Object.keys(responsive)) {
      if (key !== 'tablet' && key !== 'mobile') invalid('invalid breakpoint');
    }
    result.responsive = {};
    for (const key of ['tablet', 'mobile'] as const) {
      if (responsive[key] !== undefined) {
        const values = record(responsive[key]);
        if ('responsive' in values) invalid('nested responsive style');
        result.responsive[key] = styleValues(values, false);
      }
    }
  }
  return result;
}
function node(value: Record<string, unknown>, allowDesign = false, allowTextShadow = false): PageNode {
  return { id: id(value['id']), styles: styles(value['styles'], allowDesign, allowTextShadow) };
}
function assetId(value: unknown): string {
  const valueString = string(value, 36);
  if (!UUID.test(valueString)) invalid('invalid asset UUID');
  return valueString;
}
function galleryItem(value: unknown): PageGalleryItem {
  const data = record(value);
  return { id: id(data['id']), assetId: assetId(data['assetId']), alt: localized(data['alt']) };
}
function cardItem(value: unknown): PageCardItem {
  const data = record(value);
  const href = string(data['href'], 800);
  if (href && !/^(?:https?:\/\/[^\s\\]+|\/(?!\/)[^\s\\]*)$/.test(href))
    invalid('invalid card destination');
  const localizedWithLimit = (value: unknown, max: number): LocalizedText => {
    const text = localized(value);
    if (text.de.length > max || text.en.length > max) invalid('card text too long');
    return text;
  };
  return {
    id: id(data['id']),
    assetId: data['assetId'] === null ? null : assetId(data['assetId']),
    alt: localizedWithLimit(data['alt'], 300),
    title: localizedWithLimit(data['title'], 200),
    description: localizedWithLimit(data['description'], 800),
    href,
  };
}
function albumPalette(value: unknown, details = false): PageAlbumPalette {
  const data = record(value);
  const result: PageAlbumPalette = {};
  const allowed = details
    ? ['backgroundColor', 'textColor', 'iconColor', 'subtitleColor']
    : ['backgroundColor', 'textColor'];
  for (const key of Object.keys(data)) {
    if (!allowed.includes(key)) invalid('unsupported album color field');
    result[key as keyof PageAlbumPalette] = surfaceColor(data[key]);
  }
  return result;
}
const COMPOSER_ICONS = new Set([
  'arrow', 'arrow2', 'check', 'circle', 'community', 'deezer', 'folder', 'gallery',
  'heart', 'images', 'link', 'list-checked', 'list-numbered', 'lock', 'lock-open',
  'music', 'news', 'palette', 'play', 'plus', 'quote', 'search', 'spotify', 'twitch', 'youtube',
]);
function composerHref(value: unknown): string {
  const href = string(value, 800);
  if (!href) return href;
  if (/[<>]/.test(href) || href.includes(String.fromCharCode(92)) || Array.from(href).some((ch) => /\s/.test(ch))) invalid('invalid button destination');
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  try {
    const url = new URL(href);
    if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) return href;
  } catch { /* invalid URL */ }
  return invalid('invalid button destination');
}
function composerIcon(value: unknown): string {
  const name = string(value, 40);
  if (!COMPOSER_ICONS.has(name)) invalid('invalid composer icon');
  return name;
}
function block(value: unknown): PageBlock {
  const data = record(value);
  const decoratedBlock = ['albumDetails', 'albumTracks', 'albumCredits', 'button', 'accordion', 'icon']
    .includes(String(data['type']));
  const base = node(data, decoratedBlock, data['type'] === 'text');
  switch (data['type']) {
    case 'text':
      return { ...base, type: 'text', markdown: localized(data['markdown']) };
    case 'image':
      return {
        ...base,
        type: 'image',
        assetId: data['assetId'] === null ? null : assetId(data['assetId']),
        alt: localized(data['alt']),
      };
    case 'gallery': {
      const layout = data['layout'];
      if (
        layout !== undefined &&
        !['auto', 'grid', 'featured', 'featuredRight', 'panorama', 'mosaic', 'filmstrip'].includes(
          String(layout),
        )
      )
        invalid('invalid gallery layout');
      // Previously published filmstrips are displayed as ordinary galleries.
      const normalized = layout === 'filmstrip' ? 'grid' : layout;
      return {
        ...base,
        type: 'gallery',
        ...(normalized === undefined
          ? {}
          : {
              layout: normalized as 'auto' | 'grid' | 'featured' | 'featuredRight' | 'panorama' | 'mosaic',
            }),
        items: list(data['items'], 36).map(galleryItem),
      };
    }
    case 'slider': {
      const perView = data['perView'];
      if (perView !== undefined && (typeof perView !== 'number' || ![1, 1.5, 2, 2.5, 3, 4].includes(perView)))
        invalid('invalid slider perView');
      if (data['showBullets'] !== undefined && typeof data['showBullets'] !== 'boolean')
        invalid('invalid slider pagination');
      return { ...base, type: 'slider', items: list(data['items'], 36).map(galleryItem),
        ...(perView === undefined ? {} : { perView: perView as number }),
        ...(data['showBullets'] === undefined ? {} : { showBullets: data['showBullets'] as boolean }),
      };
    }
    case 'cardCarousel':
      return { ...base, type: 'cardCarousel', items: list(data['items'], 24).map(cardItem) };
    case 'spacer':
      return { ...base, type: 'spacer', height: number(data['height'], 240, 32) };
    case 'button': {
      const variant = data['variant'];
      const size = data['size'];
      const placement = data['iconPosition'];
      if (!['primary', 'secondary', 'outline'].includes(String(variant))) invalid('invalid button variant');
      if (!['small', 'medium', 'large'].includes(String(size))) invalid('invalid button size');
      if (placement !== undefined && !['start', 'end'].includes(String(placement)))
        invalid('invalid button icon position');
      if (data['newTab'] !== undefined && typeof data['newTab'] !== 'boolean') invalid('invalid new-tab flag');
      const label = localized(data['label']);
      if (label.de.length > 160 || label.en.length > 160) invalid('button label too long');
      return { ...base, type: 'button', label, href: composerHref(data['href']),
        variant: variant as 'primary' | 'secondary' | 'outline', size: size as 'small' | 'medium' | 'large',
        ...(data['icon'] === undefined ? {} : { icon: data['icon'] === null ? null : composerIcon(data['icon']) }),
        ...(placement === undefined ? {} : { iconPosition: placement as 'start' | 'end' }),
        ...(data['newTab'] === undefined ? {} : { newTab: data['newTab'] as boolean }) };
    }
    case 'accordion': {
      if (data['allowMultiple'] !== undefined && typeof data['allowMultiple'] !== 'boolean')
        invalid('invalid accordion multiple setting');
      const items = list(data['items'], 20).map((value) => {
        const entry = record(value);
        if (entry['defaultOpen'] !== undefined && typeof entry['defaultOpen'] !== 'boolean')
          invalid('invalid accordion open flag');
        const title = localized(entry['title']);
        const body = localized(entry['body']);
        if (title.de.length > 160 || title.en.length > 160 ||
            body.de.length > 4000 || body.en.length > 4000) invalid('accordion content too long');
        return { id: id(entry['id']), title, body,
          ...(entry['defaultOpen'] === undefined ? {} : { defaultOpen: entry['defaultOpen'] as boolean }) };
      });
      if (!data['allowMultiple'] && items.filter((entry) => entry.defaultOpen).length > 1)
        invalid('single-open accordion has multiple defaults');
      return { ...base, type: 'accordion', items,
        ...(data['allowMultiple'] === undefined ? {} : { allowMultiple: data['allowMultiple'] as boolean }) };
    }
    case 'icon': {
      const ariaLabel = localized(data['ariaLabel']);
      if (ariaLabel.de.length > 160 || ariaLabel.en.length > 160) invalid('icon label too long');
      const size = number(data['size'], 128, 48);
      if (!Number.isInteger(size) || size < 16) invalid('invalid icon size');
      return { ...base, type: 'icon', name: composerIcon(data['name']), size, ariaLabel };
    }
    case 'albumDetails':
      return { ...base, type: 'albumDetails',
        ...(data['palette'] === undefined ? {} : { palette: albumPalette(data['palette'], true) }) };
    case 'albumTracks':
      return { ...base, type: 'albumTracks',
        ...(data['palette'] === undefined ? {} : { palette: albumPalette(data['palette']) }) };
    case 'albumCredits':
      return {
        ...base,
        type: 'albumCredits',
        ...(data['palette'] === undefined ? {} : { palette: albumPalette(data['palette']) }),
        heading: localized(data['heading']),
        entries: list(data['entries'], 40).map((entry) => {
          const credit = record(entry);
          return { name: string(credit['name'], 120), role: localized(credit['role']) };
        }),
      };
    default:
      return invalid('unsupported block');
  }
}
function column(value: unknown): PageColumn {
  const data = record(value);
  const contentAlign = data['contentAlign'];
  if (contentAlign !== undefined && !['start', 'center', 'end'].includes(String(contentAlign)))
    invalid('invalid column content alignment');
  return {
    ...node(data, true),
    ...(contentAlign === undefined
      ? {}
      : { contentAlign: contentAlign as 'start' | 'center' | 'end' }),
    blocks: list(data['blocks'], 36).map(block),
  };
}
function row(value: unknown): PageRow {
  const data = record(value);
  const layout = data['layout'];
  if (typeof layout !== 'string' || !Object.hasOwn(ROW_LAYOUT_COLUMN_COUNTS, layout))
    invalid('unknown row layout');
  const typed = layout as RowLayout;
  const columns = list(data['columns'], 4).map(column);
  if (columns.length !== ROW_LAYOUT_COLUMN_COUNTS[typed])
    invalid('column count does not match layout');
  return { ...node(data, true), layout: typed, columns };
}
function section(value: unknown): PageSection {
  const data = record(value);
  return { ...node(data, true), rows: list(data['rows'], 30).map(row) };
}

function validateTheme(value: unknown): PageTheme {
  const data = record(value);
  const allowed = ['fontBody', 'fontHeading', 'fontAccent', 'colors', 'sizes', 'responsive',
    'lineHeight', 'letterSpacing', 'contentMaxWidth', 'readingMaxWidth'];
  if (Object.keys(data).some((key) => !allowed.includes(key))) invalid('unknown theme property');
  const theme: PageTheme = {};
  for (const key of ['fontBody', 'fontHeading', 'fontAccent'] as const) {
    if (data[key] === undefined) continue;
    const value = data[key];
    if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(value))
      invalid('invalid font ID');
    theme[key] = value;
  }
  const bounded = (value: unknown, min: number, max: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
      invalid('invalid theme number');
    return value;
  };
  const sizeKeys = ['body', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'small', 'label'] as const;
  const themeSizes = (value: unknown): Partial<PageThemeSizes> => {
    const input = record(value);
    const sizes: Partial<PageThemeSizes> = {};
    for (const key of Object.keys(input)) {
      if (!sizeKeys.includes(key as PageThemeSizeKey)) invalid('unknown theme size');
      const min = key === 'h1' ? 16 : key.startsWith('h') ? 12 : 10;
      const max = key === 'h1' ? 128 : key.startsWith('h') ? 100 : 40;
      sizes[key as PageThemeSizeKey] = bounded(input[key], min, max);
    }
    return sizes;
  };
  if (data['sizes'] !== undefined) theme.sizes = themeSizes(data['sizes']);
  if (data['responsive'] !== undefined) {
    const input = record(data['responsive']);
    if (Object.keys(input).some((key) => key !== 'tablet' && key !== 'mobile'))
      invalid('unknown theme breakpoint');
    theme.responsive = {};
    if (input['tablet'] !== undefined) theme.responsive.tablet = themeSizes(input['tablet']);
    if (input['mobile'] !== undefined) theme.responsive.mobile = themeSizes(input['mobile']);
  }
  if (data['colors'] !== undefined) {
    const colors = record(data['colors']);
    const keys = ['text', 'heading', 'link', 'accent', 'background'] as const;
    if (Object.keys(colors).some((key) => !keys.includes(key as typeof keys[number])))
      invalid('unknown theme color');
    theme.colors = {};
    for (const key of keys) if (colors[key] !== undefined) theme.colors[key] = surfaceColor(colors[key]);
  }
  for (const [key, min, max] of [
    ['lineHeight', 1, 3], ['letterSpacing', -2, 12],
    ['contentMaxWidth', 320, 2400], ['readingMaxWidth', 320, 1600],
  ] as const) {
    if (data[key] !== undefined) theme[key] = bounded(data[key], min, max);
  }
  return theme;
}

/** Canonicalize all input. No arbitrary CSS, URLs or HTML reach the public renderer. */
export function validatePageDocument(
  value: unknown,
  profile: PageComposerProfile = 'standard',
): PageDocument {
  if (JSON.stringify(value ?? null).length > MAX_DOCUMENT_BYTES) invalid('document too large');
  const data = record(value);
  if (data['schemaVersion'] !== 1) invalid('unsupported schema version');
  const result: PageDocument = {
    ...node(data),
    schemaVersion: 1,
    ...(data['theme'] === undefined ? {} : { theme: validateTheme(data['theme']) }),
    sections: list(data['sections'], 30).map(section),
  };
  const ids = new Set<string>();
  const add = (identifier: string): void => {
    if (ids.has(identifier)) invalid('duplicate node ID');
    ids.add(identifier);
  };
  add(result.id);
  let albumPlayers = 0;
  for (const s of result.sections) {
    add(s.id);
    for (const r of s.rows) {
      add(r.id);
      for (const c of r.columns) {
        add(c.id);
        for (const b of c.blocks) {
          add(b.id);
          if (profile === 'standard' &&
              (b.type === 'albumDetails' || b.type === 'albumTracks' || b.type === 'albumCredits'))
            invalid('album blocks are not allowed on standard pages');
          if (b.type === 'gallery' || b.type === 'slider' || b.type === 'cardCarousel' || b.type === 'accordion')
            for (const item of b.items) add(item.id);
          if (b.type === 'albumTracks' && ++albumPlayers > 1)
            invalid('only one album track player is allowed');
        }
      }
    }
  }
  return result;
}
