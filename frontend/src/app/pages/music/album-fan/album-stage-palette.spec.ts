import { describe, expect, it } from 'vitest';

import { albumStageAccent, DEFAULT_ALBUM_LIGHT } from './album-stage-palette';

describe('albumStageAccent', () => {
  it('uses a consistent fallback for monochrome artwork', () => {
    expect(albumStageAccent(new Uint8ClampedArray([80, 80, 80, 255]))).toEqual(
      DEFAULT_ALBUM_LIGHT,
    );
  });

  it('ignores transparent pixels and chooses the visible colors', () => {
    const accent = albumStageAccent(
      new Uint8ClampedArray([0, 255, 0, 0, 170, 62, 200, 255]),
    );
    expect(accent.r).toBeGreaterThan(accent.g);
    expect(accent.b).toBeGreaterThan(accent.g);
  });

  it('handles an empty image', () => {
    expect(albumStageAccent(new Uint8ClampedArray())).toEqual(DEFAULT_ALBUM_LIGHT);
  });
});
