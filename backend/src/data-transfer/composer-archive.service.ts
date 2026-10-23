import type { PageDocument } from '@shared/content/page-document';
import type { SitePageMetadata } from '@shared/content/site-page';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { Repository } from 'typeorm';

import { AssetsService } from '../assets/assets.service';
import { MusicAlbumEntry } from '../music/entities/music-album.entry';
import { SitePageEntry } from '../pages/entities/site-page.entry';
import { collectSitePageAssets } from '../pages/site-page-assets';
import { storedZip, type StoredZipEntry } from './stored-zip';

export type ComposerArchiveScope = 'all' | 'pages' | 'booklets';
const MAX_ASSETS = 250;
const MAX_EXPORT_BYTES = 512 * 1024 * 1024; // ZIP32 streaming, bounded response
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,158}[a-z0-9])?$/;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/avif': 'avif', 'image/gif': 'gif', 'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
};

type Snapshot = {
  kind: 'page' | 'album-booklet';
  key: string;
  slug: string;
  sourceId: string;
  draft: PageDocument | null;
  published: PageDocument | null;
  draftMetadata?: SitePageMetadata;
  publishedMetadata?: SitePageMetadata | null;
  publishedAt?: string | null;
  album?: {
    coverAssetId: string | null;
    editorial: MusicAlbumEntry['editorial'];
    releasedAt: string | null;
  };
};

interface ManifestAsset {
  sourceId: string;
  path: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  width: number | null;
  height: number | null;
  descriptionDe: string | null;
  descriptionEn: string | null;
  imageEdits: unknown;
  folderId: string | null;
}

/** Read-only export. No IDs are rewritten and no draft is implicitly published. */
@Injectable()
export class ComposerArchiveService {
  constructor(
    @InjectRepository(SitePageEntry) private readonly pages: Repository<SitePageEntry>,
    @InjectRepository(MusicAlbumEntry) private readonly albums: Repository<MusicAlbumEntry>,
    private readonly assets: AssetsService,
  ) {}

  async export(scope: ComposerArchiveScope, id?: string): Promise<Readable> {
    if (!['all', 'pages', 'booklets'].includes(scope)) {
      throw new BadRequestException(`Unsupported Composer export scope: ${String(scope)}.`);
    }
    if (id !== undefined && (scope === 'all' || (!UUID.test(id) && !DOCUMENT_SLUG.test(id)))) {
      throw new BadRequestException('Composer single export requires a valid document UUID or slug, with pages or booklets scope.');
    }

    const snapshots: Snapshot[] = [];
    if (scope !== 'booklets') {
      const pages = id
        ? [await this.pages.findOneBy(UUID.test(id) ? { uuid: id } : { slug: id })].filter((x): x is SitePageEntry => x !== null)
        : await this.pages.find({ order: { key: 'ASC' } });
      for (const page of pages) snapshots.push({
        kind: 'page', key: page.key, slug: page.slug, sourceId: page.uuid,
        draft: page.draft, published: page.published,
        draftMetadata: page.draftMetadata, publishedMetadata: page.publishedMetadata,
        publishedAt: page.publishedAt?.toISOString() ?? null,
      });
    }
    if (scope !== 'pages') {
      const albums = id
        ? [await this.albums.findOneBy(UUID.test(id) ? { uuid: id } : { slug: id })].filter((x): x is MusicAlbumEntry => x !== null)
        : await this.albums.find({ order: { slug: 'ASC' } });
      for (const album of albums) {
        // Only albums with an actual booklet need a Composer export.
        if (!album.bookletDraft && !album.bookletPublished) continue;
        snapshots.push({
          kind: 'album-booklet', key: `album:${album.slug}`, slug: album.slug,
          sourceId: album.uuid, draft: album.bookletDraft, published: album.bookletPublished,
          album: { coverAssetId: album.coverAssetId, editorial: album.editorial, releasedAt: album.releasedAt },
        });
      }
    }
    if (id && !snapshots.length) throw new NotFoundException('No Composer document found.');

    // Record where each reference comes from, so a failed export names the affected document.
    const ids = new Set<string>();
    const owners = new Map<string, Set<string>>();
    const register = (assetId: string, owner: string): void => {
      const normalized = assetId.toLowerCase();
      ids.add(normalized);
      const usages = owners.get(normalized) ?? new Set<string>();
      usages.add(owner);
      owners.set(normalized, usages);
    };
    for (const snap of snapshots) {
      const owner = snap.kind === 'page' ? `page /${snap.slug}` : `album ${snap.slug}`;
      for (const assetId of collectSitePageAssets(
        [snap.draft, snap.published], [snap.draftMetadata ?? null, snap.publishedMetadata ?? null],
      )) register(assetId, owner);
      if (snap.album?.coverAssetId) register(snap.album.coverAssetId, owner);
      if (snap.album?.editorial.heroAssetId) register(snap.album.editorial.heroAssetId, owner);
    }
    if (ids.size > MAX_ASSETS) {
      throw new PayloadTooLargeException(
        `Composer export contains ${ids.size} assets; at most ${MAX_ASSETS} are permitted.`,
      );
    }
    const describe = (assetId: string): string =>
      `asset ${assetId} (used by ${[...(owners.get(assetId) ?? [])].join(', ') || 'unknown document'})`;
    const mib = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;

    const sourceAssets: Array<{ path: string; absolutePath: string; sizeBytes: number; meta: Omit<ManifestAsset, 'sha256'> }> = [];
    let totalSize = 0;
    for (const assetId of [...ids].sort()) {
      if (!UUID.test(assetId)) throw new BadRequestException(`Invalid ID in ${describe(assetId)}.`);
      // Resolve before sending response headers: a missing original is a hard failure.
      let asset: Awaited<ReturnType<AssetsService['getById']>>;
      let file: Awaited<ReturnType<AssetsService['resolveFile']>>;
      try {
        [asset, file] = await Promise.all([
          this.assets.getById(assetId), this.assets.resolveFile(assetId),
        ]);
      } catch (error: unknown) {
        if (error instanceof NotFoundException) {
          throw new NotFoundException(`Missing asset record or original file for ${describe(assetId)}.`);
        }
        throw new InternalServerErrorException(`Could not resolve ${describe(assetId)} for export.`);
      }
      const extension = EXTENSIONS[asset.mimeType];
      if (!extension) {
        throw new BadRequestException(
          `Unsupported file type "${asset.mimeType}" for ${describe(assetId)} (${asset.originalFilename}).`,
        );
      }
      let size: number;
      try {
        await access(file.absolutePath, constants.R_OK);
        size = (await stat(file.absolutePath)).size;
      } catch (error: unknown) {
        if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
          throw new NotFoundException(`Original file is missing for ${describe(assetId)} (${asset.originalFilename}).`);
        }
        throw new InternalServerErrorException(
          `Original file cannot be read for ${describe(assetId)} (${asset.originalFilename}).`,
        );
      }
      if (size !== file.sizeBytes) {
        throw new BadRequestException(
          `File size differs for ${describe(assetId)} (${asset.originalFilename}): ` +
          `found ${size} bytes, expected ${file.sizeBytes} bytes.`,
        );
      }
      totalSize += size;
      if (totalSize > MAX_EXPORT_BYTES) {
        throw new PayloadTooLargeException(
          `Composer archive exceeds ${mib(MAX_EXPORT_BYTES)}: ${mib(totalSize)} reached ` +
          `with ${describe(assetId)} (${asset.originalFilename}).`,
        );
      }
      const path = `assets/${assetId}.${extension}`;
      sourceAssets.push({ path, absolutePath: file.absolutePath, sizeBytes: size, meta: {
        sourceId: assetId, path, originalFilename: asset.originalFilename,
        mimeType: asset.mimeType, sizeBytes: size, width: asset.width, height: asset.height,
        descriptionDe: asset.descriptionDe, descriptionEn: asset.descriptionEn,
        imageEdits: asset.imageEdits, folderId: asset.folderId,
      } });
    }

    const exportedAt = new Date().toISOString();
    async function* entries(): AsyncGenerator<StoredZipEntry> {
      const assetManifest: ManifestAsset[] = [];
      for (const source of sourceAssets) {
        const hash = createHash('sha256');
        yield { name: source.path, chunks: createReadStream(source.absolutePath), onChunk: (part: Buffer) => hash.update(part) };
        assetManifest.push({ ...source.meta, sha256: hash.digest('hex') });
      }
      const manifest = {
        format: 'mimi-composer-archive', version: 1, exportedAt,
        documents: snapshots, assets: assetManifest,
      };
      yield { name: 'manifest.json', chunks: [Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8')] };
    }
    return storedZip(entries());
  }
}
