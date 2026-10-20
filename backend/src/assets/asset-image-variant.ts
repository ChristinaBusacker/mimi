import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type AssetImageVariantName = string;
export type AssetImageVariantFormat = 'webp' | 'fallback';

export interface AssetImageVariantDefinition {
  width: number;
  height?: number;
  fit: 'inside' | 'cover';
  withoutEnlargement: boolean;
  position?: 'attention';
}

interface ImageFormatOptions {
  webpQuality: number;
  jpegQuality: number;
  pngCompressionLevel: number;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid image preset configuration.');
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid image preset number: ${String(value)}.`);
  }
  return value;
}

function loadConfiguration(): {
  presets: Readonly<Record<string, AssetImageVariantDefinition>>;
  formats: Readonly<ImageFormatOptions>;
  revisions: Readonly<Record<string, string>>;
} {
  const raw = JSON.parse(readFileSync(join(__dirname, 'image-presets.json'), 'utf8')) as unknown;
  const config = record(raw);
  integer(config['version'], 1, 1);
  const entries = Object.entries(record(config['presets']));
  if (entries.length === 0 || entries.length > 40) {
    throw new Error('Image presets must contain 1 to 40 entries.');
  }
  const formats = record(config['formats']);
  const webp = record(formats['webp']);
  const fallback = record(formats['fallback']);
  const options: ImageFormatOptions = {
    webpQuality: integer(webp['quality'], 1, 100),
    jpegQuality: integer(fallback['jpegQuality'], 1, 100),
    pngCompressionLevel: integer(fallback['pngCompressionLevel'], 0, 9),
  };
  const presets: Record<string, AssetImageVariantDefinition> = Object.create(null) as Record<string, AssetImageVariantDefinition>;
  const revisions: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [name, rawDefinition] of entries) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(name)) {
      throw new Error(`Invalid image preset name: ${name}.`);
    }
    const definition = record(rawDefinition);
    const fit = definition['fit'];
    const position = definition['position'];
    if ((fit !== 'inside' && fit !== 'cover') ||
        typeof definition['withoutEnlargement'] !== 'boolean' ||
        (position !== undefined && position !== 'attention')) {
      throw new Error(`Invalid image preset definition: ${name}.`);
    }
    const width = integer(definition['width'], 1, 4096);
    const height = definition['height'] === undefined
      ? undefined : integer(definition['height'], 1, 4096);
    if (fit === 'cover' && height === undefined) {
      throw new Error(`Cover preset ${name} requires a height.`);
    }
    const preset: AssetImageVariantDefinition = {
      width,
      ...(height === undefined ? {} : { height }),
      fit,
      withoutEnlargement: definition['withoutEnlargement'],
      ...(position === 'attention' ? { position } : {}),
    };
    presets[name] = preset;
    revisions[name] = createHash('sha256')
      .update(JSON.stringify({ preset, formats: options }))
      .digest('hex').slice(0, 12);
  }
  if (!presets['thumbnail']) {
    throw new Error('The thumbnail preset is required.');
  }
  return { presets, formats: options, revisions };
}

const configuration = loadConfiguration();
export const ASSET_IMAGE_VARIANTS = configuration.presets;
export const ASSET_IMAGE_FORMATS = configuration.formats;
export const ASSET_IMAGE_REVISIONS = configuration.revisions;

export function imageVariantStorageName(name: string, editRevision = ''): string {
  const revision = ASSET_IMAGE_REVISIONS[name];
  if (!revision) {
    throw new Error(`Unknown image preset: ${name}.`);
  }
  return `${name}-${revision}${editRevision ? `-${editRevision}` : ''}`;
}
