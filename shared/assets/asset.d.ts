export type AssetType = 'image' | 'audio';

export interface AssetCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AssetImageEdits {
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
  crop: AssetCropRect | null;
  thumbnailCrop: AssetCropRect | null;
}

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
  folderId: string | null;
  imageEdits: AssetImageEdits | null;
  originalUrl: string;
  url: string;
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface AssetFolder {
  id: string;
  parentId: string | null;
  name: string;
}

export interface MoveAssetsInput {
  ids: string[];
  folderId: string | null;
}

export interface UpdateAssetDescriptions {
  descriptionDe: string;
  descriptionEn: string;
}
