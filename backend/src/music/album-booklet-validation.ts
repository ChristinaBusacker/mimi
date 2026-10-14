import type {
  PageBlock,
  ComposerBackground,
  PageColumn,
  PageDocument,
  PageGalleryItem,
  PageNode,
  PageRow,
  PageSection,
  PageStyles,
  LocalizedText,
  RowLayout,
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

function styleValues(data: Record<string, unknown>, defaults: boolean): PageStyles {
  const result: PageStyles = {};
  if (defaults || data['background'] !== undefined) {
    const value = data['background'] ?? 'none';
    if (!['none', 'glass', 'solid', 'accent'].includes(String(value))) invalid('invalid background preset');
    result.background = value as PageStyles['background'];
  }
  if (defaults || data['align'] !== undefined) {
    const value = data['align'] ?? 'left';
    if (!['left', 'center', 'right'].includes(String(value))) invalid('invalid alignment');
    result.align = value as PageStyles['align'];
  }
  for (const [key, max, fallback] of [
    ['padding', 96, 0], ['gap', 64, 16], ['radius', 48, 0],
  ] as const) {
    if (defaults || data[key] !== undefined) result[key] = number(data[key], max, fallback);
  }
  for (const key of ['backgroundColor', 'textColor'] as const) {
    if (data[key] !== undefined) {
      const value = string(data[key], 7);
      if (!HEX_COLOR.test(value)) invalid('invalid hex color');
      result[key] = value.toLowerCase();
    }
  }
  return result;
}

function backgroundDesign(value: unknown): ComposerBackground {
  const data = record(value);
  const kind = data['kind'];
  const color = (value: unknown): string => {
    const result = string(value, 7);
    if (!HEX_COLOR.test(result)) invalid('invalid background color');
    return result.toLowerCase();
  };
  if (kind === 'color') return { kind, color: color(data['color']) };
  if (kind === 'gradient') {
    const angle = data['angle'];
    if (![0, 45, 90, 135, 180].includes(angle as number)) invalid('invalid gradient angle');
    return { kind, from: color(data['from']), to: color(data['to']), angle: angle as 0 | 45 | 90 | 135 | 180 };
  }
  if (kind === 'image') {
    const position = data['position'];
    const overlay = data['overlay'];
    if (!['center', 'top', 'bottom'].includes(String(position)) ||
        !['none', 'soft', 'strong'].includes(String(overlay))) invalid('invalid image background');
    return { kind, assetId: assetId(data['assetId']), position: position as 'center' | 'top' | 'bottom',
      overlay: overlay as 'none' | 'soft' | 'strong' };
  }
  return invalid('unsupported background kind');
}

function styles(value: unknown, allowDesign = false): PageStyles {
  const data = value === undefined ? {} : record(value);
  const result = styleValues(data, true);
  if (data['spacing'] !== undefined || data['designBackground'] !== undefined) {
    if (!allowDesign) invalid('design controls are only valid on sections and columns');
    if (data['spacing'] !== undefined) {
      const spacing = data['spacing'];
      if (!['small', 'standard', 'large'].includes(String(spacing))) invalid('invalid spacing preset');
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
function node(value: Record<string, unknown>, allowDesign = false): PageNode {
  return { id: id(value['id']), styles: styles(value['styles'], allowDesign) };
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
function block(value: unknown): PageBlock {
  const data = record(value);
  const base = node(data);
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
    case 'gallery':
      return { ...base, type: 'gallery', items: list(data['items'], 36).map(galleryItem) };
    case 'spacer':
      return { ...base, type: 'spacer', height: number(data['height'], 240, 32) };
    case 'albumDetails':
      return { ...base, type: 'albumDetails' };
    case 'albumTracks':
      return { ...base, type: 'albumTracks' };
    case 'albumCredits':
      return {
        ...base,
        type: 'albumCredits',
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
  return { ...node(data, true), blocks: list(data['blocks'], 36).map(block) };
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
  return { ...node(data), layout: typed, columns };
}
function section(value: unknown): PageSection {
  const data = record(value);
  return { ...node(data, true), rows: list(data['rows'], 30).map(row) };
}

/** Canonicalize all input. No arbitrary CSS, URLs or HTML reach the public renderer. */
export function validateAlbumBooklet(value: unknown): PageDocument {
  if (JSON.stringify(value ?? null).length > MAX_DOCUMENT_BYTES) invalid('document too large');
  const data = record(value);
  if (data['schemaVersion'] !== 1) invalid('unsupported schema version');
  const result: PageDocument = {
    ...node(data),
    schemaVersion: 1,
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
          if (b.type === 'gallery') for (const item of b.items) add(item.id);
          if (b.type === 'albumTracks' && ++albumPlayers > 1)
            invalid('only one album track player is allowed');
        }
      }
    }
  }
  return result;
}
