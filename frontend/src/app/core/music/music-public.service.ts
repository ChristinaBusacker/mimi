import type {
  MusicAlbum,
  MusicAlbumSummary,
} from '@shared/music/music';

import {
  Injectable,
  inject,
} from '@angular/core';
import {
  Observable,
  map,
  of,
  switchMap,
} from 'rxjs';

import { RequestService } from '../http/request.service';
import type { Language } from '../i18n/i18n.types';

export interface MusicLandingData {
  locale: Language;
  albums: MusicAlbumSummary[];
  featuredAlbum: MusicAlbum | null;
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

    return this.request
      .get<MusicAlbumSummary[]>(
        `/music/albums?locale=${encodedLocale}`,
      )
      .pipe(
        switchMap((albums) => {
          const featured = albums[0];

          if (!featured) {
            return of({
              locale,
              albums,
              featuredAlbum: null,
            });
          }

          return this.request
            .get<MusicAlbum>(
              `/music/albums/${encodeURIComponent(featured.slug)}?locale=${encodedLocale}`,
            )
            .pipe(
              map((featuredAlbum) => ({
                locale,
                albums,
                featuredAlbum,
              })),
            );
        }),
      );
  }
}
