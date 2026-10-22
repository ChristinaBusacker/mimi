import type { PageDocument, PageStyles } from '@shared/content/page-document';
import type { SitePageMetadata } from '@shared/content/site-page';

const ASSET_REFERENCE = /asset:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

/** A single inventory for asset protection now and ZIP export later. */
export function collectSitePageAssets(
  documents: ReadonlyArray<PageDocument | null>,
  metadata: ReadonlyArray<SitePageMetadata | null>,
): string[] {
  const ids = new Set<string>();
  const add = (id: string | null | undefined): void => {
    if (id) ids.add(id.toLowerCase());
  };
  const collectStyle = (styles: PageStyles): void => {
    if (styles.designBackground?.kind === 'image') add(styles.designBackground.assetId);
  };
  for (const meta of metadata) add(meta?.seoImageAssetId);
  for (const doc of documents) {
    if (!doc) continue;
    collectStyle(doc.styles);
    for (const section of doc.sections) {
      collectStyle(section.styles);
      for (const row of section.rows) {
        collectStyle(row.styles);
        for (const column of row.columns) {
          collectStyle(column.styles);
          for (const block of column.blocks) {
            collectStyle(block.styles);
            if (block.type === 'image') add(block.assetId);
            else if (block.type === 'gallery' || block.type === 'slider') {
              for (const item of block.items) add(item.assetId);
            } else if (block.type === 'cardCarousel') {
              for (const item of block.items) add(item.assetId);
            } else if (block.type === 'text') {
              for (const value of [block.markdown.de, block.markdown.en]) {
                for (const match of value.matchAll(ASSET_REFERENCE)) add(match[1]);
              }
            }
          }
        }
      }
    }
  }
  return [...ids].sort();
}
