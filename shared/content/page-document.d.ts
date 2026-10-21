/** Persisted editorial content. Business metadata stays outside this document. */
export type PageLocale = 'de' | 'en';
/** Feature scope for the reusable composer; album blocks are not valid on static pages. */
export type PageComposerProfile = 'standard' | 'album';
export interface LocalizedText {
  de: string;
  en: string;
}
export type RowLayout =
  '1' | '1-1' | '1-2' | '2-1' | '1-3' | '3-1' | '1-1-1' | '1-1-1-1' | '2-1-1' | '1-2-1' | '1-1-2';
export type PageSurface = 'none' | 'glass' | 'solid' | 'accent';
export type ComposerSpacing = 'small' | 'standard' | 'large';
/** Individual pixel values (0–160) in standard CSS box order. */
export interface ComposerBoxEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export interface ComposerCorners {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}
export interface ComposerBorder {
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
}
export interface ComposerShadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}
export type ComposerBackground =
  | { kind: 'color'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle: 0 | 45 | 90 | 135 | 180;
      shape?: 'linear' | 'radial' }
  | { kind: 'image'; assetId: string; position: 'center' | 'top' | 'bottom';
      overlay: 'none' | 'soft' | 'strong'; parallax?: boolean };
export interface PageStyleValues {
  background?: PageSurface;
  backgroundColor?: string;
  textColor?: string;
  padding?: number;
  /** New explicit four-sided box model. When absent, old padding/spacing stays in effect. */
  paddingBox?: ComposerBoxEdges;
  marginBox?: ComposerBoxEdges;
  gap?: number;
  radius?: number;
  align?: 'left' | 'center' | 'right';
}
export interface PageStyles extends PageStyleValues {
  /** Spacing is for sections and columns; surface styling is also available on rows. */
  spacing?: ComposerSpacing;
  designBackground?: ComposerBackground;
  /** Text blocks only: readability shadows follow the global --text-shadow token. */
  textShadow?: 'none' | 'readability' | 'strong';
  /** Optional heading override; without it h1-h6 inherit the body text color. */
  headingColor?: string;
  corners?: ComposerCorners;
  border?: ComposerBorder;
  shadow?: ComposerShadow;
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
/** Optional palette for the album widgets; missing fields retain the original theme. */
export interface PageAlbumPalette {
  backgroundColor?: string;
  textColor?: string;
  iconColor?: string;
  subtitleColor?: string;
}
export interface PageGalleryBlock extends PageNode {
  type: 'gallery';
  /** Automatic layout follows the number of images; older layouts are unchanged. */
  layout?: 'auto' | 'grid' | 'featured' | 'featuredRight' | 'panorama' | 'mosaic';
  items: PageGalleryItem[];
}
/** Full-size images in the existing Glide carousel, independent of gallery presets. */
export interface PageSliderBlock extends PageNode {
  type: 'slider';
  items: PageGalleryItem[];
  /** Fractional slide counts are supported by Glide. Defaults to 1.5. */
  perView?: number;
  showBullets?: boolean;
}
export interface PageCardItem {
  id: string;
  assetId: string | null;
  alt: LocalizedText;
  title: LocalizedText;
  description: LocalizedText;
  /** Empty for a card without a destination. */
  href: string;
}
export interface PageCardCarouselBlock extends PageNode {
  type: 'cardCarousel';
  items: PageCardItem[];
}
export interface PageSpacerBlock extends PageNode {
  type: 'spacer';
  height: number;
}
/** Uses the album context, not a second copy of the album metadata. */
export interface PageAlbumDetailsBlock extends PageNode {
  type: 'albumDetails';
  palette?: PageAlbumPalette;
}
/** Renders the existing music player on published album pages. */
export interface PageAlbumTracksBlock extends PageNode {
  type: 'albumTracks';
  palette?: PageAlbumPalette;
}
export interface PageAlbumCredit {
  name: string;
  role: LocalizedText;
}
/** Editorial credits until the album administration has a dedicated credit model. */
export interface PageAlbumCreditsBlock extends PageNode {
  type: 'albumCredits';
  palette?: PageAlbumPalette;
  heading: LocalizedText;
  entries: PageAlbumCredit[];
}
export type PageBlock = PageTextBlock | PageImageBlock | PageGalleryBlock | PageSpacerBlock
  | PageSliderBlock | PageCardCarouselBlock
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
