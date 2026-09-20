export type MusicPublicationStatus = 'draft' | 'published';

export interface MusicAlbumSummary {
  id: string;
  slug: string;
  title: string;
  coverAssetId: string | null;
  releasedAt: string | null;
}

export interface MusicAlbum extends MusicAlbumSummary {
  contentHtml: string;
  tracks: MusicTrackSummary[];
}

export interface MusicAlbumReference {
  id: string;
  slug: string;
  title: string;
  coverAssetId: string | null;
}

export interface MusicTrackSummary {
  id: string;
  slug: string;
  title: string;
  trackNumber: number | null;
  durationSeconds: number;
  previewDurationSeconds: number;
  previewAssetId: string | null;
  coverAssetId: string | null;
  spotifyUrl: string | null;
  deezerUrl: string | null;
  supportUrl: string | null;
}

export interface MusicTrack extends MusicTrackSummary {
  album: MusicAlbumReference | null;
  contentHtml: string;
}
