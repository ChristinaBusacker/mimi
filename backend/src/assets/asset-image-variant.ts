export type AssetImageVariantName =
  | 'thumbnail'
  | 'medium'
  | 'large';

export type AssetImageVariantFormat =
  | 'webp'
  | 'fallback';

export const ASSET_IMAGE_VARIANT_WIDTHS: Readonly<
  Record<AssetImageVariantName, number>
> = {
  thumbnail: 320,
  medium: 768,
  large: 1440,
};
