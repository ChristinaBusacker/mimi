import type { PageDocument, LocalizedText } from '../content/page-document';

export type MusicPublicationStatus = 'draft' | 'published';

/** Album-level editorial data. Booklet layouts only reference these values. */
export interface MusicAlbumCredit {
  name: string;
  role: LocalizedText;
}
/** Language-specific, editorial tags. These are not document blocks. */
export interface MusicAlbumTags {
  de: string[];
  en: string[];
}
export interface MusicAlbumEditorial {
  genre: LocalizedText;
  mood: LocalizedText;
  credits: MusicAlbumCredit[];
  /** Optional wide background behind the album cover and title. */
  heroAssetId?: string | null;
  /** Older albums legitimately omit these new metadata fields. */
  spotifyUrl?: string | null;
  deezerUrl?: string | null;
  supportUrl?: string | null;
  tags?: MusicAlbumTags;
}

export interface MusicAlbumSummary {
  id: string;
  slug: string;
  title: string;
  coverAssetId: string | null;
  releasedAt: string | null;
  /** Optional scene image. Falls back to the cover for older albums. */
  heroAssetId?: string | null;
}

export interface MusicAlbum extends MusicAlbumSummary {
  editorial: MusicAlbumEditorial;
  booklet: PageDocument | null;
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
  hasContent: boolean;
}

export interface MusicTrackListItem extends MusicTrackSummary {
  album: MusicAlbumReference | null;
}

export interface MusicTrack extends MusicTrackListItem {
  contentHtml: string;
}
