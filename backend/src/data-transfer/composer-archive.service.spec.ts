import type { SitePageEntry } from '../pages/entities/site-page.entry';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { ComposerArchiveService } from './composer-archive.service';

const image = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function manifestFromZip(zip: Buffer): Record<string, unknown> {
  const end = zip.length - 22;
  const count = zip.readUInt16LE(end + 10);
  let pos = zip.readUInt32LE(end + 16);
  for (let n = 0; n < count; n++) {
    const nameLength = zip.readUInt16LE(pos + 28);
    const name = zip.toString('utf8', pos + 46, pos + 46 + nameLength);
    if (name === 'manifest.json') {
      const local = zip.readUInt32LE(pos + 42);
      const data = local + 30 + zip.readUInt16LE(local + 26);
      const size = zip.readUInt32LE(pos + 24);
      return JSON.parse(zip.toString('utf8', data, data + size)) as Record<string, unknown>;
    }
    pos += 46 + nameLength + zip.readUInt16LE(pos + 30) + zip.readUInt16LE(pos + 32);
  }
  throw new Error('Manifest not found');
}

describe('Composer archive export', () => {
  it('exports draft, published snapshot, SEO images and original-file checksums', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mimi-composer-'));
    try {
      const file = join(directory, 'sample.png');
      await writeFile(file, Buffer.from('original image content'));
      const page = {
        uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', kind: 'custom', key: 'page:story', slug: 'story',
        draftMetadata: { title: { de: 'Entwurf', en: 'Draft' }, seoTitle: { de: '', en: '' },
          seoDescription: { de: '', en: '' }, seoImageAssetId: image, indexable: false },
        publishedMetadata: { title: { de: 'Live', en: 'Live' }, seoTitle: { de: '', en: '' },
          seoDescription: { de: '', en: '' }, seoImageAssetId: image, indexable: true },
        draft: { schemaVersion: 1, id: 'page', styles: {}, sections: [] },
        published: { schemaVersion: 1, id: 'page', styles: {}, sections: [] },
        publishedAt: new Date('2026-10-22T10:00:00Z'),
      } as unknown as SitePageEntry;
      const pages = { find: vi.fn(async () => [page]), findOneBy: vi.fn(async () => page) };
      const albums = { find: vi.fn(async () => []), findOneBy: vi.fn(async () => null) };
      const assets = {
        getById: vi.fn(async () => ({ id: image, originalFilename: 'nice.png', mimeType: 'image/png',
          width: 2, height: 2, descriptionDe: null, descriptionEn: null, imageEdits: null, folderId: null })),
        resolveFile: vi.fn(async () => ({ absolutePath: file, sizeBytes: 22 })),
      };
      // Use exact file size from the fs to avoid any dependency on image decoder.
      assets.resolveFile.mockImplementation(async () => ({ absolutePath: file, sizeBytes: Buffer.byteLength('original image content') }));
      const service = new ComposerArchiveService(pages as never, albums as never, assets as never);
      const parts: Buffer[] = [];
      for await (const chunk of await service.export('all')) parts.push(Buffer.from(chunk));
      const manifest = manifestFromZip(Buffer.concat(parts));
      expect(manifest['format']).toBe('mimi-composer-archive');
      expect(manifest['version']).toBe(1);
      const documents = manifest['documents'] as Array<Record<string, unknown>>;
      expect(documents[0]['key']).toBe('page:story');
      expect((documents[0]['draftMetadata'] as { title: { de: string } }).title.de).toBe('Entwurf');
      expect((documents[0]['publishedMetadata'] as { title: { de: string } }).title.de).toBe('Live');
      const assetList = manifest['assets'] as Array<{ path: string; sha256: string }>;
      expect(assetList).toHaveLength(1);
      expect(assetList[0].path).toBe(`assets/${image}.png`);
      expect(assetList[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
