import type {
  MusicAlbum,
  MusicAlbumSummary,
  MusicTrack,
  MusicTrackListItem,
} from '@shared/music/music';

import {
  Injectable,
  inject,
} from '@angular/core';
import {
  Observable,
  forkJoin,
  map,
} from 'rxjs';

import { RequestService } from '../http/request.service';
import type { Language } from '../i18n/i18n.types';

export interface MusicLandingData {
  locale: Language;
  albums: MusicAlbumSummary[];
  tracks: MusicTrackListItem[];
}

export interface MusicAlbumPageData {
  locale: Language;
  album: MusicAlbum;
}

@Injectable({
  providedIn: 'root',
})
export class MusicPublicService {
  private readonly request = inject(RequestService);

  getLanding(
    locale: Language,
  ): Observable<MusicLandingData> {
    const encodedLocale =
      encodeURIComponent(locale);

    return forkJoin({
      albums: this.request.get<
        MusicAlbumSummary[]
      >(
        `/music/albums?locale=${encodedLocale}`,
      ),
      tracks: this.request.get<
        MusicTrackListItem[]
      >(
        `/music/tracks?locale=${encodedLocale}`,
      ),
    }).pipe(
      map(({ albums, tracks }) => ({
        locale,
        albums,
        tracks,
      })),
    );
  }

  getAlbumPage(
    slug: string,
    locale: Language,
  ): Observable<MusicAlbumPageData> {
    return this.getAlbum(
      slug,
      locale,
    ).pipe(
      map((album) => ({
        locale,
        album,
      })),
    );
  }

  getAlbum(
    slug: string,
    locale: Language,
  ): Observable<MusicAlbum> {
    return this.request.get<MusicAlbum>(
      `/music/albums/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
    );
  }

  getTrack(
    slug: string,
    locale: Language,
  ): Observable<MusicTrack> {
    return this.request.get<MusicTrack>(
      `/music/tracks/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
    );
  }
}
