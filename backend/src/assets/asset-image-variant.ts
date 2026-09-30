export type AssetImageVariantName =
  | 'thumbnail'
  | 'medium'
  | 'large'
  | 'social';

export type AssetImageVariantFormat =
  | 'webp'
  | 'fallback';

export interface AssetImageVariantDefinition {
  width: number;
  height?: number;
  fit: 'inside' | 'cover';
  withoutEnlargement: boolean;
  position?: 'attention';
}

export const ASSET_IMAGE_VARIANTS: Readonly<
  Record<
    AssetImageVariantName,
    AssetImageVariantDefinition
  >
> = {
  thumbnail: {
    width: 320,
    fit: 'inside',
    withoutEnlargement: true,
  },
  medium: {
    width: 768,
    fit: 'inside',
    withoutEnlargement: true,
  },
  large: {
    width: 1440,
    fit: 'inside',
    withoutEnlargement: true,
  },
  social: {
    width: 1200,
    height: 630,
    fit: 'cover',
    withoutEnlargement: false,
    position: 'attention',
  },
};
