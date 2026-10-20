import type { AssetImageEdits, AssetCropRect } from '@shared/assets/asset';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const ROTATIONS = [0, 90, 180, 270] as const;
const EPSILON = 0.000001;

function rectangle(value: unknown, label: string): AssetCropRect | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be a rectangle or null.`);
  }
  const source = value as Record<string, unknown>;
  const { x, y, width, height } = source;
  if (![x, y, width, height].every(
    (part) => typeof part === 'number' && Number.isFinite(part),
  )) {
    throw new BadRequestException(`${label} coordinates must be finite numbers.`);
  }
  const rect = { x: x as number, y: y as number, width: width as number, height: height as number };
  if (rect.x < 0 || rect.y < 0 || rect.width < 0.01 || rect.height < 0.01 ||
      rect.x + rect.width > 1 + EPSILON || rect.y + rect.height > 1 + EPSILON) {
    throw new BadRequestException(`${label} is outside the image.`);
  }
  return rect;
}

export function parseImageEdits(value: unknown): AssetImageEdits {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Image edit settings are required.');
  }
  const data = value as Record<string, unknown>;
  if (!ROTATIONS.some((angle) => angle === data['rotation']) ||
      typeof data['flipX'] !== 'boolean' || typeof data['flipY'] !== 'boolean') {
    throw new BadRequestException('Invalid image rotation or flip options.');
  }
  return {
    rotation: data['rotation'] as AssetImageEdits['rotation'],
    flipX: data['flipX'] as boolean,
    flipY: data['flipY'] as boolean,
    crop: rectangle(data['crop'], 'crop'),
    thumbnailCrop: rectangle(data['thumbnailCrop'], 'thumbnailCrop'),
  };
}

export function imageEditFingerprint(edit: AssetImageEdits | null): string {
  return edit ? createHash('sha256').update(JSON.stringify(edit)).digest('hex').slice(0, 8) : '';
}

export function pixelCrop(
  rect: AssetCropRect, width: number, height: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.min(width - 1, Math.max(0, Math.round(rect.x * width)));
  const top = Math.min(height - 1, Math.max(0, Math.round(rect.y * height)));
  const right = Math.min(width, Math.max(left + 1, Math.round((rect.x + rect.width) * width)));
  const bottom = Math.min(height, Math.max(top + 1, Math.round((rect.y + rect.height) * height)));
  return { left, top, width: right - left, height: bottom - top };
}

export async function editedImageBuffer(buffer: Buffer, edit: AssetImageEdits | null): Promise<Buffer> {
  if (!edit) return sharp(buffer).rotate().toBuffer();
  // Normalize EXIF first, then apply the user operations in visible order.
  let result = await sharp(buffer).rotate().toBuffer();
  if (edit.rotation !== 0) result = await sharp(result).rotate(edit.rotation).toBuffer();
  if (edit.flipX) result = await sharp(result).flop().toBuffer();
  if (edit.flipY) result = await sharp(result).flip().toBuffer();
  if (edit.crop) {
    const metadata = await sharp(result).metadata();
    result = await sharp(result).extract(pixelCrop(edit.crop, metadata.width!, metadata.height!)).toBuffer();
  }
  return result;
}

export function pixelThumbnailCrop(rect: AssetCropRect, width: number, height: number) {
  const crop = pixelCrop(rect, width, height);
  if (Math.abs(crop.width - crop.height) > Math.max(4, Math.round(Math.min(crop.width, crop.height) * 0.015))) {
    throw new BadRequestException('The thumbnail crop must be square.');
  }
  const side = Math.min(crop.width, crop.height);
  return { left: crop.left + Math.floor((crop.width - side) / 2),
    top: crop.top + Math.floor((crop.height - side) / 2),
    width: side, height: side };
}

export function validateThumbnailCrop(edit: AssetImageEdits, width: number, height: number): void {
  if (!edit.thumbnailCrop) return;
  const rotated = edit.rotation === 90 || edit.rotation === 270;
  const sourceWidth = rotated ? height : width;
  const sourceHeight = rotated ? width : height;
  const main = edit.crop ? pixelCrop(edit.crop, sourceWidth, sourceHeight) : {
    width: sourceWidth, height: sourceHeight,
  };
  pixelThumbnailCrop(edit.thumbnailCrop, main.width, main.height);
}
