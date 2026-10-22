import type { PageDocument } from '@shared/content/page-document';
import type { SitePageMetadata } from '@shared/content/site-page';
import { describe, expect, it } from 'vitest';
import { collectSitePageAssets } from './site-page-assets';

const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const third = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function meta(assetId: string | null): SitePageMetadata {
  return {
    title: { de: 'Hallo', en: 'Hello' },
    seoTitle: { de: 'Hallo', en: 'Hello' },
    seoDescription: { de: '', en: '' },
    seoImageAssetId: assetId,
    indexable: true,
  };
}

function doc(): PageDocument {
  return {
    id: 'page', schemaVersion: 1, styles: {},
    sections: [{ id: 'section', styles: { designBackground: {
      kind: 'image', assetId: first, position: 'center', overlay: 'none',
    } }, rows: [{ id: 'row', styles: {}, layout: '1', columns: [{
      id: 'column', styles: {}, blocks: [
        { id: 'text', styles: {}, type: 'text', markdown: {
          de: `![](asset:${second})`, en: `Same image asset:${second}`,
        } },
        { id: 'gallery', styles: {}, type: 'gallery', items: [
          { id: 'image', assetId: third, alt: { de: '', en: '' } },
        ] },
      ],
    }] }] }],
  };
}

describe('site page asset inventory', () => {
  it('includes design images, inline markdown, gallery assets and SEO image without duplicates', () => {
    expect(collectSitePageAssets([doc()], [meta(first)])).toEqual([first, second, third]);
  });

  it('unions draft and published dependencies for safe cleanup', () => {
    const published = doc();
    const draft = doc();
    draft.sections[0].styles.designBackground = undefined;
    draft.sections[0].rows[0].columns[0].blocks = [];
    expect(collectSitePageAssets([draft, published], [meta(null), null])).toEqual([
      first, second, third,
    ]);
  });

  it('supports empty documents and no assets', () => {
    expect(collectSitePageAssets([null], [meta(null)])).toEqual([]);
  });
});
