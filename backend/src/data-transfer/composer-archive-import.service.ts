import type { PageDocument } from '@shared/content/page-document';
import type { SitePageMetadata } from '@shared/content/site-page';
import type { ComposerImportDocument, ComposerImportPreview, ComposerImportResult } from '@shared/data-transfer/composer-archive-import';
import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AssetsService } from '../assets/assets.service';
import { SUPPORTED_ASSET_MIME_TYPES } from '../assets/asset-file';
import { AssetEntry } from '../assets/entities/asset.entry';
import { validatePageDocument } from '../content/page-document-validation';
import { MusicAlbumEntry } from '../music/entities/music-album.entry';
import { MusicAdminService } from '../music/music-admin.service';
import { SitePageEntry } from '../pages/entities/site-page.entry';
import { SitePagesService } from '../pages/site-pages.service';
import { collectSitePageAssets } from '../pages/site-page-assets';
import { ComposerZipReader } from './composer-zip-reader';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA = /^[0-9a-f]{64}$/;
const RESERVED = new Set([
  'about', 'gaming', 'music', 'blog', 'impressum', 'datenschutz',
  'kontakt', 'unterstuetzen', 'community', 'account', 'admin', 'videos', '404',
]);
const SYSTEM = new Set(['about', 'impressum', 'datenschutz']);
const MAX_ASSETS = 250;
const MAX_DOCUMENTS = 500;
const MAX_BYTES = 512 * 1024 * 1024;

type Snapshot = {
  kind: 'page' | 'album-booklet'; key: string; slug: string; sourceId: string;
  draft: PageDocument | null; published: PageDocument | null;
  draftMetadata?: SitePageMetadata; publishedMetadata?: SitePageMetadata | null;
};
type ArchiveAsset = {
  sourceId: string; path: string; originalFilename: string; mimeType: string;
  sizeBytes: number; sha256: string; descriptionDe: string | null;
  descriptionEn: string | null; imageEdits: unknown;
};
type Archive = { exportedAt: string; documents: Snapshot[]; assets: ArchiveAsset[] };
type Decision = ComposerImportDocument & { snapshot: Snapshot };

function bad(reason: string): never {
  throw new BadRequestException(`Composer-Import abgelehnt: ${reason}`);
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad('Ein Objekt wird erwartet.');
  return value as Record<string, unknown>;
}
function string(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.length > max) bad(`Ungültiger Wert für ${label}.`);
  return value;
}
function metadata(value: unknown): SitePageMetadata {
  const obj = record(value);
  const localized = (field: 'title' | 'seoTitle' | 'seoDescription', max: number) => {
    const data = record(obj[field]);
    return { de: string(data['de'], `${field}.de`, max), en: string(data['en'], `${field}.en`, max) };
  };
  const seoImageAssetId = obj['seoImageAssetId'];
  if (seoImageAssetId !== null && (typeof seoImageAssetId !== 'string' || !UUID.test(seoImageAssetId)))
    bad('Ungültige SEO-Bild-ID.');
  if (typeof obj['indexable'] !== 'boolean') bad('Ungültige Indexierungseinstellung.');
  const title = localized('title', 160);
  if (!title.de.trim() || !title.en.trim()) bad('Seitentitel fehlen.');
  return {
    title, seoTitle: localized('seoTitle', 160), seoDescription: localized('seoDescription', 500),
    seoImageAssetId: seoImageAssetId as string | null, indexable: obj['indexable'] as boolean,
  };
}

/** Returns a deep copy with only asset pointers rewritten; other UUIDs remain unchanged. */
export function remapComposerAssets<T>(value: T, ids: ReadonlyMap<string, string>): T {
  function walk(input: unknown, key = ''): unknown {
    if (typeof input === 'string') {
      if (key === 'assetId' || key === 'seoImageAssetId') return ids.get(input.toLowerCase()) ?? input;
      if (key === 'de' || key === 'en') {
        return input.replace(/asset:([0-9a-f-]{36})/gi, (full, id: string) => {
          const mapped = ids.get(id.toLowerCase());
          return mapped ? `asset:${mapped}` : full;
        });
      }
      return input;
    }
    if (Array.isArray(input)) return input.map((item) => walk(item));
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input).map(([name, part]) => [name, walk(part, name)]));
    }
    return input;
  }
  return walk(value) as T;
}

@Injectable()
export class ComposerArchiveImportService {
  constructor(
    @InjectRepository(SitePageEntry) private readonly pages: Repository<SitePageEntry>,
    @InjectRepository(MusicAlbumEntry) private readonly albums: Repository<MusicAlbumEntry>,
    @InjectRepository(AssetEntry) private readonly assetEntries: Repository<AssetEntry>,
    private readonly assets: AssetsService,
    private readonly sitePages: SitePagesService,
    private readonly music: MusicAdminService,
  ) {}

  async preview(path: string, overwrite = false): Promise<ComposerImportPreview> {
    const { archive } = await this.inspect(path);
    const decisions = await this.plan(archive.documents, overwrite);
    const warnings = this.warnings(decisions);
    return {
      format: 'mimi-composer-archive', version: 1, exportedAt: archive.exportedAt,
      documents: decisions.map(({ snapshot: _, ...decision }) => decision),
      assetCount: archive.assets.length, warnings,
    };
  }

  async import(path: string, overwrite = false): Promise<ComposerImportResult> {
    // Re-parse and verify the exact uploaded archive. Preview never authorizes future content.
    const { archive, zip } = await this.inspect(path);
    const decisions = await this.plan(archive.documents, overwrite);
    const selected = decisions.filter((item) => item.action === 'create' || item.action === 'replace-draft');
    const required = new Set<string>();
    for (const { snapshot } of selected) {
      const doc = snapshot.draft ?? snapshot.published;
      const meta = snapshot.kind === 'page' ? snapshot.draftMetadata ?? snapshot.publishedMetadata ?? null : null;
      if (doc) for (const id of collectSitePageAssets([doc], [meta])) required.add(id.toLowerCase());
      else if (meta?.seoImageAssetId) required.add(meta.seoImageAssetId.toLowerCase());
    }
    const assetsById = new Map(archive.assets.map((asset) => [asset.sourceId.toLowerCase(), asset]));
    const mapping = new Map<string, string>();
    let assetsCreated = 0;
    let assetsReused = 0;
    for (const id of [...required].sort()) {
      const asset = assetsById.get(id);
      if (!asset) bad(`Im Manifest fehlt das referenzierte Asset ${id}.`);
      const existing = await this.assetEntries.findOneBy({ contentHash: asset.sha256 });
      if (existing) {
        mapping.set(id, existing.uuid);
        assetsReused++;
        continue;
      }
      const buffer = await zip.bytes(asset.path);
      // Asset.create validates image data and deduplicates by its real content hash.
      const created = await this.assets.create({ buffer, size: buffer.length, mimetype: asset.mimeType, originalname: asset.originalFilename });
      mapping.set(id, created.id);
      assetsCreated++;
      if (asset.descriptionDe || asset.descriptionEn) {
        await this.assets.updateDescriptions(created.id, {
          descriptionDe: asset.descriptionDe ?? '', descriptionEn: asset.descriptionEn ?? '',
        });
      }
      if (asset.imageEdits !== null && asset.imageEdits !== undefined) {
        await this.assets.updateImageEdits(created.id, asset.imageEdits);
      }
    }

    let created = 0;
    let updated = 0;
    for (const decision of selected) {
      const source = decision.snapshot;
      const doc = source.draft ?? source.published;
      if (!doc) continue;
      const document = remapComposerAssets(doc, mapping);
      // Validate the mapped document once more before mutating destination records.
      validatePageDocument(document, source.kind === 'page' ? 'standard' : 'album');
      if (source.kind === 'page') {
        const meta = remapComposerAssets(source.draftMetadata ?? source.publishedMetadata!, mapping);
        if (decision.action === 'create') {
          const page = await this.sitePages.create({ slug: source.slug, metadata: meta });
          await this.sitePages.saveDraft(page.id, document);
          created++;
        } else {
          const target = await this.pages.findOneBy({ key: source.key });
          if (!target || target.slug !== source.slug) bad(`Seite ${source.slug} wurde zwischen Vorschau und Import geändert.`);
          await this.sitePages.updateMetadata(target.uuid, meta);
          await this.sitePages.saveDraft(target.uuid, document);
          updated++;
        }
      } else {
        const target = await this.albums.findOneBy({ slug: source.slug });
        if (!target) bad(`Album ${source.slug} existiert nicht mehr.`);
        await this.music.saveAlbumBooklet(target.uuid, document);
        updated++;
      }
    }
    return {
      created, updated, skipped: decisions.length - selected.length,
      assetsCreated, assetsReused, warnings: this.warnings(decisions),
    };
  }

  private async inspect(path: string): Promise<{ archive: Archive; zip: ComposerZipReader }> {
    const zip = await ComposerZipReader.open(path);
    let root: Record<string, unknown>;
    try { root = record(JSON.parse((await zip.bytes('manifest.json')).toString('utf8')) as unknown); }
    catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      return bad('manifest.json enthält kein gültiges JSON.');
    }
    if (root['format'] !== 'mimi-composer-archive' || root['version'] !== 1)
      bad('Format oder Archivversion wird nicht unterstützt.');
    const exportedAt = string(root['exportedAt'], 'exportedAt', 40);
    if (!Number.isFinite(Date.parse(exportedAt))) bad('Ungültiger Exportzeitpunkt.');
    if (!Array.isArray(root['documents']) || root['documents'].length > MAX_DOCUMENTS ||
        !Array.isArray(root['assets']) || root['assets'].length > MAX_ASSETS)
      throw new PayloadTooLargeException('Zu viele Dokumente oder Assets im Archiv.');

    const documents: Snapshot[] = [];
    const keys = new Set<string>();
    for (const value of root['documents']) {
      const obj = record(value);
      const kind = obj['kind'];
      const slug = string(obj['slug'], 'slug', 160);
      const key = string(obj['key'], 'key', 200);
      const sourceId = string(obj['sourceId'], 'sourceId', 36);
      if (!UUID.test(sourceId) || !SLUG.test(slug) ||
          (kind !== 'page' && kind !== 'album-booklet') ||
          (kind === 'page' && key !== `page:${slug}` && key !== `system:${slug}`) ||
          (kind === 'album-booklet' && key !== `album:${slug}`) || keys.has(key))
        bad(`Ungültiger oder doppelter Dokumenteintrag: ${key}.`);
      keys.add(key);
      const draft = obj['draft'] == null ? null : validatePageDocument(obj['draft'], kind === 'page' ? 'standard' : 'album');
      const published = obj['published'] == null ? null : validatePageDocument(obj['published'], kind === 'page' ? 'standard' : 'album');
      const draftMetadata = kind === 'page' ? metadata(obj['draftMetadata']) : undefined;
      const publishedMetadata = kind === 'page' && obj['publishedMetadata'] != null ? metadata(obj['publishedMetadata']) : null;
      documents.push({ kind, slug, key, sourceId, draft, published, draftMetadata, publishedMetadata });
    }

    const assets: ArchiveAsset[] = [];
    const paths = new Set<string>(['manifest.json']);
    const ids = new Set<string>();
    let sum = 0;
    for (const value of root['assets']) {
      const obj = record(value);
      const sourceId = string(obj['sourceId'], 'asset sourceId', 36).toLowerCase();
      const name = string(obj['path'], 'asset path', 160);
      const mimeType = string(obj['mimeType'], 'mimeType', 100);
      const originalFilename = string(obj['originalFilename'], 'originalFilename', 255);
      const sha256 = string(obj['sha256'], 'sha256', 64).toLowerCase();
      const sizeBytes = obj['sizeBytes'];
      if (!UUID.test(sourceId) || !name.startsWith(`assets/${sourceId}.`) ||
          (!SUPPORTED_ASSET_MIME_TYPES[mimeType] || !name.endsWith('.' + SUPPORTED_ASSET_MIME_TYPES[mimeType].extension)) || !SHA.test(sha256) ||
          !Number.isSafeInteger(sizeBytes) || (sizeBytes as number) < 0 ||
          (sizeBytes as number) > 100 * 1024 * 1024 || paths.has(name) || ids.has(sourceId))
        bad(`Ungültiger Asset-Eintrag: ${sourceId}.`);
      sum += sizeBytes as number;
      if (sum > MAX_BYTES) throw new PayloadTooLargeException('Assets überschreiten 512 MiB.');
      paths.add(name); ids.add(sourceId);
      assets.push({ sourceId, path: name, originalFilename, mimeType, sha256,
        sizeBytes: sizeBytes as number, descriptionDe: typeof obj['descriptionDe'] === 'string' ? obj['descriptionDe'] : null,
        descriptionEn: typeof obj['descriptionEn'] === 'string' ? obj['descriptionEn'] : null,
        imageEdits: obj['imageEdits'] ?? null,
      });
    }
    if (zip.names().length !== paths.size || zip.names().some((name) => !paths.has(name)))
      bad('ZIP-Inhalt stimmt nicht mit dem Manifest überein.');
    for (const asset of assets) {
      const bytes = await zip.bytes(asset.path);
      if (bytes.length !== asset.sizeBytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256)
        bad(`Prüfsumme oder Dateigröße stimmt nicht: ${asset.originalFilename} (${asset.sourceId}).`);
    }
    for (const doc of documents) {
      const dependencies = collectSitePageAssets([doc.draft, doc.published],
        [doc.draftMetadata ?? null, doc.publishedMetadata ?? null]);
      for (const id of dependencies) if (!ids.has(id.toLowerCase()))
        bad(`Dokument ${doc.key} referenziert fehlendes Asset ${id}.`);
    }
    return { archive: { exportedAt, documents, assets }, zip };
  }

  private async plan(documents: Snapshot[], overwrite: boolean): Promise<Decision[]> {
    const [pages, albums] = await Promise.all([this.pages.find(), this.albums.find()]);
    const bySlug = new Map(pages.map((page) => [page.slug, page]));
    const albumsBySlug = new Map(albums.map((album) => [album.slug, album]));
    return documents.map((snapshot): Decision => {
      const { kind, key, slug } = snapshot;
      const document = snapshot.draft ?? snapshot.published;
      let action: ComposerImportDocument['action'];
      let reason: string | undefined;
      if (!document) { action = 'empty'; reason = 'No draft or published document'; }
      else if (kind === 'album-booklet') {
        if (!albumsBySlug.has(slug)) { action = 'missing-album'; reason = 'Album is not present on the target'; }
        else action = overwrite ? 'replace-draft' : 'skip-existing';
      } else {
        const existing = bySlug.get(slug);
        if (existing && (existing.key !== key || (key.startsWith('system:') !== (existing.kind === 'system')))) {
          action = 'conflict'; reason = 'Slug belongs to a different page';
        } else if (!existing && (RESERVED.has(slug) || key.startsWith('system:') || (SYSTEM.has(slug)))) {
          action = 'conflict'; reason = 'Reserved route or missing system identity';
        } else if (existing) action = overwrite ? 'replace-draft' : 'skip-existing';
        else action = 'create';
      }
      return { kind, key, slug, action, ...(reason ? { reason } : {}), snapshot };
    });
  }

  private warnings(decisions: Decision[]): string[] {
    const warning: string[] = [];
    if (decisions.some((d) => d.kind === 'album-booklet'))
      warning.push('Album metadata and tracks are not migrated. Target albums must exist.');
    if (decisions.some((d) => d.action === 'replace-draft'))
      warning.push('Existing drafts will be replaced; published content remains unchanged.');
    if (decisions.some((d) => d.action === 'conflict' || d.action === 'missing-album'))
      warning.push('Conflicting pages and missing albums are skipped.');
    warning.push('Media folders are not recreated. Asset edits are kept only for newly uploaded images.');
    return warning;
  }
}
