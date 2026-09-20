export type AssetType = 'image' | 'audio';

export interface Asset {
  id: string;
  type: AssetType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}
