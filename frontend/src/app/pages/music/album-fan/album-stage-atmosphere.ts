import type { MusicAlbumSummary } from '@shared/music/music';

/** Use the curated album hero whenever available; legacy albums fall back to their cover. */
export function albumAtmosphereAsset(
  album: Pick<MusicAlbumSummary, 'heroAssetId' | 'coverAssetId'> | null | undefined,
): string | null {
  return album?.heroAssetId || album?.coverAssetId || null;
}
