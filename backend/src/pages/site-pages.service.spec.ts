import type { SitePageMetadata } from '@shared/content/site-page';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SitePagesService } from './site-pages.service';
import type { SitePageEntry } from './entities/site-page.entry';

const metadata: SitePageMetadata = {
  title: { de: 'Entwurf', en: 'Draft' },
  seoTitle: { de: 'Entwurf', en: 'Draft' },
  seoDescription: { de: '', en: '' }, seoImageAssetId: null, indexable: true,
};
const document = {
  id: 'page', schemaVersion: 1 as const, styles: {}, sections: [{
    id: 'section', styles: {}, rows: [{ id: 'row', styles: {}, layout: '1' as const,
      columns: [{ id: 'column', styles: {}, blocks: [{ id: 'text', type: 'text' as const,
        styles: {}, markdown: { de: 'Text', en: 'Text' } }] }],
    }],
  }],
};

function setup(kind: 'system' | 'custom' = 'custom') {
  const page = {
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', key: 'page:demo', slug: 'demo', kind,
    draftMetadata: structuredClone(metadata), publishedMetadata: null,
    draft: structuredClone(document), published: null, publishedAt: null,
    createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-01'),
  } as SitePageEntry;
  const repo = {
    findOneBy: vi.fn(async () => page),
    find: vi.fn(async () => [page]),
    findOne: vi.fn(async () => page),
    save: vi.fn(async (value: SitePageEntry) => value),
    delete: vi.fn(async () => undefined),
  };
  const manager = { getRepository: vi.fn(() => repo) };
  const dataSource = { transaction: vi.fn(async (fn: (manager: typeof manager) => Promise<unknown>) => fn(manager)) };
  const assets = { getById: vi.fn(async () => ({ type: 'image' })) };
  const usages = { syncOwner: vi.fn(async () => undefined), clearOwner: vi.fn(async () => undefined) };
  const service = new SitePagesService(repo as never, dataSource as never, assets as never, usages as never);
  return { page, repo, service, usages };
}

describe('site page publication', () => {
  it('does not expose an unpublished draft through the public API', async () => {
    const { service } = setup();
    await expect(service.getPublished('demo')).rejects.toThrow(NotFoundException);
  });

  it('publishes a snapshot and preserves the live version while editing the draft', async () => {
    const { page, service } = setup();
    const result = await service.publish(page.uuid);
    expect(result.hasPublished).toBe(true);
    expect(result.publishedMetadata?.title.de).toBe('Entwurf');
    page.draftMetadata.title.de = 'Änderung';
    page.draft!.sections[0].rows[0].columns[0].blocks = [];
    const published = await service.getPublished('demo');
    expect(published.metadata.title.de).toBe('Entwurf');
    expect(published.document.sections[0].rows[0].columns[0].blocks).toHaveLength(1);
  });

  it('does not publish empty content', async () => {
    const { page, service } = setup();
    page.draft = null;
    await expect(service.publish(page.uuid)).rejects.toThrow(BadRequestException);
  });

  it('prevents deleting a protected system page', async () => {
    const { page, service } = setup('system');
    await expect(service.delete(page.uuid)).rejects.toThrow(ForbiddenException);
  });
});
