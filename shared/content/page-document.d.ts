/** Persisted editorial content. Business metadata stays outside this document. */
export type PageLocale = 'de' | 'en';
export interface LocalizedText {
  de: string;
  en: string;
}
export type RowLayout =
  '1' | '1-1' | '1-2' | '2-1' | '1-3' | '3-1' | '1-1-1' | '1-1-1-1' | '2-1-1' | '1-2-1' | '1-1-2';
export type PageSurface = 'none' | 'glass' | 'solid' | 'accent';
export type ComposerSpacing = 'small' | 'standard' | 'large';
export type ComposerBackground =
  | { kind: 'color'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle: 0 | 45 | 90 | 135 | 180 }
  | { kind: 'image'; assetId: string; position: 'center' | 'top' | 'bottom'; overlay: 'none' | 'soft' | 'strong' };
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
  /** Only sections and columns may define an editorial background or spacing. */
  spacing?: ComposerSpacing;
  designBackground?: ComposerBackground;
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
  /** Existing galleries default to the regular grid. */
  layout?: 'grid' | 'featured';
  items: PageGalleryItem[];
}
export interface PageSpacerBlock extends PageNode {
  type: 'spacer';
  height: number;
}
/** Uses the album context, not a second copy of the album metadata. */
export interface PageAlbumDetailsBlock extends PageNode {
  type: 'albumDetails';
}
/** Renders the existing music player on published album pages. */
export interface PageAlbumTracksBlock extends PageNode {
  type: 'albumTracks';
}
export interface PageAlbumCredit {
  name: string;
  role: LocalizedText;
}
/** Editorial credits until the album administration has a dedicated credit model. */
export interface PageAlbumCreditsBlock extends PageNode {
  type: 'albumCredits';
  heading: LocalizedText;
  entries: PageAlbumCredit[];
}
export type PageBlock = PageTextBlock | PageImageBlock | PageGalleryBlock | PageSpacerBlock
  | PageAlbumDetailsBlock | PageAlbumTracksBlock | PageAlbumCreditsBlock;
export interface PageColumn extends PageNode {
  /** Vertical position of the blocks in a stretched column. Defaults to start. */
  contentAlign?: 'start' | 'center' | 'end';
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
