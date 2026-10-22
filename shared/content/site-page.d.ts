import type { LocalizedText, PageDocument } from './page-document';

/** Stable across environments: system:about, system:impressum, page:my-page. */
export type SitePageKind = 'system' | 'custom';

/** Published and draft metadata are independent snapshots. */
export interface SitePageMetadata {
  title: LocalizedText;
  seoTitle: LocalizedText;
  seoDescription: LocalizedText;
  seoImageAssetId: string | null;
  indexable: boolean;
}

export interface CreateSitePageInput {
  slug: string;
  metadata: SitePageMetadata;
}

export interface SitePageSummary {
  id: string;
  key: string;
  slug: string;
  kind: SitePageKind;
  draftMetadata: SitePageMetadata;
  publishedMetadata: SitePageMetadata | null;
  hasDraft: boolean;
  hasPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SitePageAdmin extends SitePageSummary {
  draft: PageDocument | null;
  published: PageDocument | null;
}

export interface SitePagePublic {
  key: string;
  slug: string;
  kind: SitePageKind;
  metadata: SitePageMetadata;
  document: PageDocument;
  publishedAt: string;
}
