/** Persisted editorial content. Business metadata stays outside this document. */
export type PageLocale = 'de' | 'en';
export interface LocalizedText {
  de: string;
  en: string;
}
export type RowLayout =
  '1' | '1-1' | '1-2' | '2-1' | '1-3' | '3-1' | '1-1-1' | '1-1-1-1' | '2-1-1' | '1-2-1' | '1-1-2';
export type PageSurface = 'none' | 'glass' | 'solid' | 'accent';
export interface PageStyleValues {
  background?: PageSurface;
  backgroundColor?: string;
  textColor?: string;
  padding?: number;
  gap?: number;
  radius?: number;
  align?: 'left' | 'center' | 'right';
}
export interface PageStyles extends PageStyleValues {
  responsive?: {
    tablet?: PageStyleValues;
    mobile?: PageStyleValues;
  };
}
export interface PageNode {
  id: string;
  styles: PageStyles;
}
export interface PageTextBlock extends PageNode {
  type: 'text';
  markdown: LocalizedText;
}
export interface PageImageBlock extends PageNode {
  type: 'image';
  assetId: string | null;
  alt: LocalizedText;
}
export interface PageGalleryItem {
  id: string;
  assetId: string;
  alt: LocalizedText;
}
export interface PageGalleryBlock extends PageNode {
  type: 'gallery';
  items: PageGalleryItem[];
}
export interface PageSpacerBlock extends PageNode {
  type: 'spacer';
  height: number;
}
export type PageBlock = PageTextBlock | PageImageBlock | PageGalleryBlock | PageSpacerBlock;
export interface PageColumn extends PageNode {
  blocks: PageBlock[];
}
export interface PageRow extends PageNode {
  layout: RowLayout;
  columns: PageColumn[];
}
export interface PageSection extends PageNode {
  rows: PageRow[];
}
export interface PageDocument extends PageNode {
  schemaVersion: 1;
  sections: PageSection[];
}
export interface PagePublication {
  draft: PageDocument | null;
  published: PageDocument | null;
}
