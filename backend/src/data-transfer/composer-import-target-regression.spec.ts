import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ComposerArchiveController } from './composer-archive.controller';
import { COMPOSER_UUID } from './composer-uuid';

const pageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const albumId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function setup() {
  const importer = {
    preview: vi.fn().mockResolvedValue({ documents: [] }),
    import: vi.fn().mockResolvedValue({ updated: 1 }),
  };
  const controller = new ComposerArchiveController({} as never, importer as never);
  return { controller, importer };
}

describe('single-document ZIP import target validation', () => {
  it('accepts standard 8-4-4-4-12 UUIDs used by exported documents and assets', () => {
    expect(COMPOSER_UUID.test(pageId)).toBe(true);
    expect(COMPOSER_UUID.test(albumId)).toBe(true);
    expect(COMPOSER_UUID.test('16db7909-60d6-4f34-9fc7-381d08e6e74a')).toBe(true);
  });

  it('rejects malformed UUIDs, including a missing variant-group separator', () => {
    expect(COMPOSER_UUID.test('aaaaaaaa-aaaa-4aaa-8aaaaaaaaaaaaa')).toBe(false);
    expect(COMPOSER_UUID.test('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa')).toBe(false);
    expect(COMPOSER_UUID.test('not-a-uuid')).toBe(false);
  });

  it('passes a valid page ID through the ZIP preview route', async () => {
    const { controller, importer } = setup();
    await controller.preview({ path: '/unused-test-page.zip' }, '1', 'page', pageId);
    expect(importer.preview).toHaveBeenCalledWith('/unused-test-page.zip', true, {
      kind: 'page', id: pageId,
    });
  });

  it('passes a valid album ID through the ZIP import route', async () => {
    const { controller, importer } = setup();
    await controller.importArchive({ path: '/unused-test-album.zip' }, '1', 'album-booklet', albumId);
    expect(importer.import).toHaveBeenCalledWith('/unused-test-album.zip', true, {
      kind: 'album-booklet', id: albumId,
    });
  });

  it('rejects an invalid target before calling the importer', async () => {
    const { controller, importer } = setup();
    await expect(controller.preview({ path: '/unused-test.zip' }, '1', 'page', 'wrong'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(importer.preview).not.toHaveBeenCalled();
  });
});
