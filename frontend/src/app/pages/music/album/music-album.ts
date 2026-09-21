import type {
  MusicAlbumReference,
  MusicTrackListItem,
} from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import {
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  RouterLink,
} from '@angular/router';
import { Store } from '@ngxs/store';
import {
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  switchMap,
} from 'rxjs';

import { Hero } from '../../../components/hero/hero';
import { Icon } from '../../../components/icon/icon';
import { MusicLibraryPlayer } from '../../../components/music-library-player/music-library-player';
import { RenderedContent } from '../../../components/rendered-content/rendered-content';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { I18nState } from '../../../core/i18n/i18n.state';
import type { Language } from '../../../core/i18n/i18n.types';
import {
  type MusicAlbumPageData,
  MusicPublicService,
} from '../../../core/music/music-public.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Hero,
    Icon,
    I18nPipe,
    MusicLibraryPlayer,
    RenderedContent,
    RouterLink,
  ],
  selector: 'app-music-album',
  styleUrl: './music-album.scss',
  templateUrl: './music-album.html',
})
export class MusicAlbumPage {
  private readonly route =
    inject(ActivatedRoute);
  private readonly store =
    inject(Store);
  private readonly music =
    inject(MusicPublicService);

  private readonly initialData =
    this.route.snapshot.data[
      'data'
    ] as MusicAlbumPageData;

  private readonly language =
    this.store.selectSignal(
      I18nState.language,
    );

  protected readonly data = toSignal(
    combineLatest([
      this.route.paramMap.pipe(
        map((params) =>
          params.get('slug'),
        ),
        distinctUntilChanged(),
      ),
      toObservable(
        this.language,
      ).pipe(
        distinctUntilChanged(),
      ),
    ]).pipe(
      switchMap(
        ([slug, locale]) => {
          if (!slug) {
            return of(
              this.initialData,
            );
          }

          if (
            slug ===
              this.initialData.album.slug &&
            locale ===
              this.initialData.locale
          ) {
            return of(
              this.initialData,
            );
          }

          return this.music.getAlbumPage(
            slug,
            locale,
          );
        },
      ),
    ),
    {
      initialValue: this.initialData,
    },
  );

  protected readonly tracks =
    computed<
      MusicTrackListItem[]
    >(() => {
      const album =
        this.data().album;
      const reference: MusicAlbumReference = {
        id: album.id,
        slug: album.slug,
        title: album.title,
        coverAssetId:
          album.coverAssetId,
      };

      return album.tracks.map(
        (track) => ({
          ...track,
          album: reference,
        }),
      );
    });

  protected assetUrl(
    assetId: string,
  ): string {
    return `/api/assets/${assetId}`;
  }

  protected formatReleaseDate(
    value: string | null,
    locale: Language,
  ): string | null {
    if (!value) {
      return null;
    }

    return new Intl.DateTimeFormat(
      locale === 'de'
        ? 'de-DE'
        : 'en-US',
      {
        year: 'numeric',
        month: 'long',
        day: '2-digit',
      },
    ).format(
      new Date(
        `${value}T00:00:00`,
      ),
    );
  }
}
