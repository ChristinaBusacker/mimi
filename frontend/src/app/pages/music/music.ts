import type { MusicAlbumSummary } from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import {
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngxs/store';
import {
  distinctUntilChanged,
  of,
  switchMap,
} from 'rxjs';

import { Icon } from '../../components/icon/icon';
import { MusicTrackPlayer } from '../../components/music-track-player/music-track-player';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { I18nState } from '../../core/i18n/i18n.state';
import type { Language } from '../../core/i18n/i18n.types';
import {
  type MusicLandingData,
  MusicPublicService,
} from '../../core/music/music-public.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    AsyncPipe,
    Icon,
    I18nPipe,
    MusicTrackPlayer,
  ],
  selector: 'app-music',
  styleUrl: './music.scss',
  templateUrl: './music.html',
})
export class Music {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly music = inject(MusicPublicService);

  private readonly initialData =
    this.route.snapshot.data['data'] as MusicLandingData;

  private readonly language =
    this.store.selectSignal(I18nState.language);

  protected readonly data = toSignal(
    toObservable(this.language).pipe(
      distinctUntilChanged(),
      switchMap((locale) =>
        locale === this.initialData.locale
          ? of(this.initialData)
          : this.music.getLanding(locale),
      ),
    ),
    {
      initialValue: this.initialData,
    },
  );

  protected readonly otherAlbums = computed(
    () => {
      const data = this.data();
      const featuredId =
        data.featuredAlbum?.id;

      return data.albums.filter(
        (album) =>
          album.id !== featuredId,
      );
    },
  );

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
      new Date(`${value}T00:00:00`),
    );
  }

  protected albumReleaseDate(
    album: MusicAlbumSummary,
  ): string | null {
    return this.formatReleaseDate(
      album.releasedAt,
      this.data().locale,
    );
  }
}
