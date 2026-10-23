import { describe, expect, it, vi } from 'vitest';

import { ComposerArchiveImportService, type ComposerImportTarget } from './composer-archive-import.service';

const page: ComposerImportTarget = { kind: 'page', id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
const album: ComposerImportTarget = { kind: 'album-booklet', id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };

function service() {
  const pages = { findOneBy: vi.fn().mockResolvedValue({ uuid: page.id, slug: 'about', key: 'system:about' }) };
  const albums = { findOneBy: vi.fn().mockResolvedValue({ uuid: album.id, slug: 'dreams' }) };
  const importer = new ComposerArchiveImportService(
    pages as never, albums as never, {} as never, {} as never, {} as never, {} as never,
  );
  const check = (documents: unknown[], target?: ComposerImportTarget) =>
    (importer as unknown as {
      assertTarget: (items: unknown[], requested?: ComposerImportTarget) => Promise<void>;
    }).assertTarget(documents, target);
  return { check, pages, albums };
}

describe('single-document Composer archive imports', () => {
  it('keeps the existing unscoped bulk import available', async () => {
    const { check } = service();
    await expect(check([{ kind: 'page' }, { kind: 'page' }])).resolves.toBeUndefined();
  });
  it('rejects archives containing several documents', async () => {
    const { check } = service();
    await expect(check([{ kind: 'page' }, { kind: 'page' }], page)).rejects.toThrow();
  });
  it('rejects another document type or slug', async () => {
    const { check } = service();
    await expect(check([{ kind: 'album-booklet', slug: 'about' }], page)).rejects.toThrow();
    await expect(check([{ kind: 'page', slug: 'other', key: 'page:other' }], page)).rejects.toThrow();
  });
  it('accepts an exact page identity from another environment', async () => {
    const { check } = service();
    await expect(check([{ kind: 'page', slug: 'about', key: 'system:about' }], page)).resolves.toBeUndefined();
  });
  it('accepts an existing album but not a different album', async () => {
    const { check } = service();
    await expect(check([{ kind: 'album-booklet', slug: 'dreams', key: 'album:dreams' }], album)).resolves.toBeUndefined();
    await expect(check([{ kind: 'album-booklet', slug: 'other', key: 'album:other' }], album)).rejects.toThrow();
  });
});
