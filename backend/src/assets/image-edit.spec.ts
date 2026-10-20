import { describe, expect, it } from 'vitest';
import { parseImageEdits, imageEditFingerprint, pixelCrop, validateThumbnailCrop } from './image-edit';

const example = {
  rotation: 0, flipX: false, flipY: false,
  crop: null, thumbnailCrop: { x: 0.25, y: 0, width: 0.5, height: 1 },
};

describe('image edit validation', () => {
  it('accepts a centered thumbnail crop for a 2:1 image', () => {
    const edits = parseImageEdits(example);
    expect(() => validateThumbnailCrop(edits, 1000, 500)).not.toThrow();
  });
  it('rejects a non-square thumbnail in pixel space', () => {
    const edits = parseImageEdits({ ...example, thumbnailCrop: { x: 0, y: 0, width: 1, height: 1 } });
    expect(() => validateThumbnailCrop(edits, 1000, 500)).toThrow();
  });
  it('rejects invalid and out-of-bounds rectangles', () => {
    expect(() => parseImageEdits({ ...example, crop: { x: 0.8, y: 0, width: 0.5, height: 1 } })).toThrow();
    expect(() => parseImageEdits({ ...example, rotation: 45 })).toThrow();
  });
  it('uses reproducible revisions for changes', () => {
    expect(imageEditFingerprint(parseImageEdits(example))).toBe(imageEditFingerprint(parseImageEdits(example)));
    expect(imageEditFingerprint(parseImageEdits(example))).not.toBe(imageEditFingerprint(parseImageEdits({ ...example, flipX: true })));
    expect(imageEditFingerprint(null)).toBe('');
  });
  it('clips rounded crop pixels to the original dimensions', () => {
    expect(pixelCrop({ x: 0.75, y: 0, width: 0.25, height: 1 }, 100, 50)).toEqual({ left: 75, top: 0, width: 25, height: 50 });
  });
});
