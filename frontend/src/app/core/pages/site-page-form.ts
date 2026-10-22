import type { PageDocument } from '@shared/content/page-document';
import type { CreateSitePageInput, SitePageMetadata } from '@shared/content/site-page';

export const SITE_PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createSitePageInput(
  slugInput: string,
  germanTitle: string,
  englishTitle: string,
): CreateSitePageInput | null {
  const slug = slugInput.trim();
  const de = germanTitle.trim();
  const en = englishTitle.trim();
  if (slug.length > 160 || !SITE_PAGE_SLUG.test(slug) ||
      !de || de.length > 160 || !en || en.length > 160) return null;
  return {
    slug,
    metadata: {
      title: { de, en },
      seoTitle: { de, en },
      seoDescription: { de: '', en: '' },
      seoImageAssetId: null,
      indexable: true,
    },
  };
}

/** Mirror the DTO's constraints before sending changes to the server. */
export function validSitePageMetadata(metadata: SitePageMetadata): boolean {
  return (['de', 'en'] as const).every((locale) =>
    metadata.title[locale].trim().length > 0 && metadata.title[locale].length <= 160 &&
    metadata.seoTitle[locale].length <= 160 &&
    metadata.seoDescription[locale].length <= 500,
  );
}

export function emptySitePageDocument(): PageDocument {
  return {
    id: 'page', schemaVersion: 1,
    styles: { background: 'none', padding: 0, gap: 16, radius: 0, align: 'left' },
    sections: [],
  };
}

export function hasPublishableDocument(document: PageDocument): boolean {
  return document.sections.length > 0;
}
