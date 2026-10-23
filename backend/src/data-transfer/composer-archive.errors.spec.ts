import type { SitePageEntry } from '../pages/entities/site-page.entry';
import { NotFoundException } from '@nestjs/common';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ComposerArchiveService } from './composer-archive.service';

const assetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function setup(getById: unknown, resolveFile: unknown): ComposerArchiveService {
  const page = {
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    key: 'system:about', kind: 'system', slug: 'about',
    draftMetadata: {
      title: { de: 'Über uns', en: 'About' },
      seoTitle: { de: '', en: '' }, seoDescription: { de: '', en: '' },
      seoImageAssetId: assetId, indexable: true,
    },
    publishedMetadata: null, draft: null, published: null, publishedAt: null,
  } as SitePageEntry;
  const pages = { find: vi.fn(async () => [page]) };
  const albums = { find: vi.fn(async () => []) };
  return new ComposerArchiveService(pages as never, albums as never,
    { getById, resolveFile } as never);
}

describe('Composer archive diagnostics', () => {
  it('identifies the owning page when an asset record is missing', async () => {
    const service = setup(
      vi.fn(async () => { throw new NotFoundException('Asset not found'); }),
      vi.fn(async () => ({ absolutePath: '/missing', sizeBytes: 10 })),
    );
    await expect(service.export('pages')).rejects.toThrow(
      new RegExp(`asset ${assetId}.*page /about`),
    );
  });

  it('identifies an original file missing from storage', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mimi-export-test-'));
    try {
      const service = setup(
        vi.fn(async () => ({ mimeType: 'image/png', originalFilename: 'about.png' })),
        vi.fn(async () => ({ absolutePath: join(dir, 'missing.png'), sizeBytes: 10 })),
      );
      await expect(service.export('pages')).rejects.toThrow(/Original file is missing.*page \/about.*about\.png/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reports actual and expected file sizes with the responsible page', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mimi-export-test-'));
    try {
      const file = join(dir, 'sample.png');
      await writeFile(file, Buffer.from('abc'));
      const service = setup(
        vi.fn(async () => ({ mimeType: 'image/png', originalFilename: 'about.png' })),
        vi.fn(async () => ({ absolutePath: file, sizeBytes: 10 })),
      );
      await expect(service.export('pages')).rejects.toThrow(/page \/about.*found 3 bytes, expected 10 bytes/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
