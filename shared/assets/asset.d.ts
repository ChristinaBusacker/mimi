export type AssetType = 'image' | 'audio';

export interface Asset {
  id: string;
  type: AssetType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  descriptionDe: string | null;
  descriptionEn: string | null;
  url: string;
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface UpdateAssetDescriptions {
  descriptionDe: string;
  descriptionEn: string;
}
