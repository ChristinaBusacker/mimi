import type { AssetType } from '@shared/assets/asset';

export interface UploadedAssetFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface SupportedMimeType {
  type: AssetType;
  extension: string;
}

export const SUPPORTED_ASSET_MIME_TYPES: Readonly<
  Record<string, SupportedMimeType>
> = {
  'image/jpeg': {
    type: 'image',
    extension: 'jpg',
  },
  'image/png': {
    type: 'image',
    extension: 'png',
  },
  'image/webp': {
    type: 'image',
    extension: 'webp',
  },
  'image/avif': {
    type: 'image',
    extension: 'avif',
  },
  'audio/mpeg': {
    type: 'audio',
    extension: 'mp3',
  },
  'audio/mp4': {
    type: 'audio',
    extension: 'm4a',
  },
  'audio/ogg': {
    type: 'audio',
    extension: 'ogg',
  },
  'audio/wav': {
    type: 'audio',
    extension: 'wav',
  },
  'audio/x-wav': {
    type: 'audio',
    extension: 'wav',
  },
};
