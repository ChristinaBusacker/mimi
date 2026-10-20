import type { MusicAlbumEditorial, MusicTrackListItem } from '../music/music';

/** Runtime album information. Never duplicated in the persisted PageDocument. */
export interface AlbumBookletContext {
  title: string;
  coverAssetId: string | null;
  releasedAt: string | null;
  editorial: MusicAlbumEditorial;
  tracks: readonly MusicTrackListItem[];
}
