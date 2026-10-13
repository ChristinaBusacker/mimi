import type {
  PageBlock,
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

function styles(value: unknown): PageStyles {
  const data = value === undefined ? {} : record(value);
  const background = data['background'] ?? 'none';
  const align = data['align'] ?? 'left';
  if (
    !['none', 'glass', 'solid', 'accent'].includes(String(background)) ||
    !['left', 'center', 'right'].includes(String(align))
  )
    invalid('invalid design preset');
  return {
    background: background as PageStyles['background'],
    padding: number(data['padding'], 96, 0),
    gap: number(data['gap'], 64, 16),
    radius: number(data['radius'], 48, 0),
    align: align as PageStyles['align'],
  };
}
function node(value: Record<string, unknown>): PageNode {
  return { id: id(value['id']), styles: styles(value['styles']) };
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
    default:
      return invalid('unsupported block');
  }
}
function column(value: unknown): PageColumn {
  const data = record(value);
  return { ...node(data), blocks: list(data['blocks'], 36).map(block) };
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
  return { ...node(data), rows: list(data['rows'], 30).map(row) };
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
  for (const s of result.sections) {
    add(s.id);
    for (const r of s.rows) {
      add(r.id);
      for (const c of r.columns) {
        add(c.id);
        for (const b of c.blocks) {
          add(b.id);
          if (b.type === 'gallery') for (const item of b.items) add(item.id);
        }
      }
    }
  }
  return result;
}
