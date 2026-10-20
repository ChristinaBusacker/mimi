import type { MusicAlbumEditorial, MusicPublicationStatus } from './music';

export interface MusicAdminTranslation {
  title: string;
  contentMarkdown: string;
}

export interface MusicAdminTranslations {
  de: MusicAdminTranslation;
  en: MusicAdminTranslation | null;
}

export interface MusicAdminAlbum {
  id: string;
  slug: string;
  coverAssetId: string | null;
  releasedAt: string | null;
  editorial: MusicAlbumEditorial;
  status: MusicPublicationStatus;
  translations: MusicAdminTranslations;
  createdAt: string;
  updatedAt: string;
}

export interface MusicAdminTrack {
  id: string;
  slug: string;
  albumId: string | null;
  trackNumber: number | null;
  durationSeconds: number;
  previewDurationSeconds: number;
  previewAssetId: string | null;
  coverAssetId: string | null;
  spotifyUrl: string | null;
  deezerUrl: string | null;
  supportUrl: string | null;
  status: MusicPublicationStatus;
  translations: MusicAdminTranslations;
  createdAt: string;
  updatedAt: string;
}

export interface SaveMusicAdminAlbum {
  slug: string;
  coverAssetId: string | null;
  releasedAt: string | null;
  /** Optional for clients that have not yet upgraded. Omission preserves existing data. */
  editorial?: MusicAlbumEditorial;
  status: MusicPublicationStatus;
  translations: MusicAdminTranslations;
}

export interface SaveMusicAdminTrack {
  slug: string;
  albumId: string | null;
  trackNumber: number | null;
  durationSeconds: number;
  previewDurationSeconds: number;
  previewAssetId: string | null;
  coverAssetId: string | null;
  spotifyUrl: string | null;
  deezerUrl: string | null;
  supportUrl: string | null;
  status: MusicPublicationStatus;
  translations: MusicAdminTranslations;
}

export interface ReorderMusicAdminTracks {
  trackIds: string[];
}
