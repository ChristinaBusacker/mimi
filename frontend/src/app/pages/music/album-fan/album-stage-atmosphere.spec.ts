import { describe, expect, it } from 'vitest';

import { albumAtmosphereAsset } from './album-stage-atmosphere';

describe('albumAtmosphereAsset', () => {
  it('prefers the editorial hero over the cover', () => {
    expect(albumAtmosphereAsset({ heroAssetId: 'hero', coverAssetId: 'cover' })).toBe('hero');
  });

  it('falls back to an album cover when no hero is configured', () => {
    expect(albumAtmosphereAsset({ heroAssetId: null, coverAssetId: 'cover' })).toBe('cover');
    expect(albumAtmosphereAsset({ coverAssetId: 'cover' })).toBe('cover');
  });

  it('keeps the stage usable without any art', () => {
    expect(albumAtmosphereAsset({ heroAssetId: null, coverAssetId: null })).toBeNull();
    expect(albumAtmosphereAsset(null)).toBeNull();
  });
});
