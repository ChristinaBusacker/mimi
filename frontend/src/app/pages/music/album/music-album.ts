import type { AlbumBookletContext } from '@shared/content/album-booklet-context';
import type { MusicAlbumReference, MusicTrackListItem } from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngxs/store';
import { combineLatest, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { Icon } from '../../../components/icon/icon';
import { PageRenderer } from '../../../components/page-composer/page-renderer';
import { MusicLibraryPlayer } from '../../../components/music-library-player/music-library-player';
import { RenderedContent } from '../../../components/rendered-content/rendered-content';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { I18nState } from '../../../core/i18n/i18n.state';
import { AlbumSelectionService } from '../../../core/music/album-selection.service';
import type { Language } from '../../../core/i18n/i18n.types';
import {
  type MusicAlbumPageData,
  MusicPublicService,
} from '../../../core/music/music-public.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, Icon, I18nPipe, MusicLibraryPlayer, PageRenderer, RenderedContent],
  selector: 'app-music-album',
  styleUrl: './music-album.scss',
  templateUrl: './music-album.html',
})
export class MusicAlbumPage {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly music = inject(MusicPublicService);
  private readonly albumSelection = inject(AlbumSelectionService);

  private readonly initialData = this.route.snapshot.data['data'] as MusicAlbumPageData;

  private readonly language = this.store.selectSignal(I18nState.language);

  protected readonly data = toSignal(
    combineLatest([
      this.route.paramMap.pipe(
        map((params) => params.get('slug')),
        distinctUntilChanged(),
      ),
      toObservable(this.language).pipe(distinctUntilChanged()),
    ]).pipe(
      switchMap(([slug, locale]) => {
        if (!slug) {
          return of(this.initialData);
        }

        if (slug === this.initialData.album.slug && locale === this.initialData.locale) {
          return of(this.initialData);
        }

        return this.music.getAlbumPage(slug, locale);
      }),
    ),
    {
      initialValue: this.initialData,
    },
  );

  constructor() {
    effect(() => {
      this.albumSelection.selectedSlug = this.data().album.slug;
    });
  }

  protected readonly tracks = computed<MusicTrackListItem[]>(() => {
    const album = this.data().album;
    const reference: MusicAlbumReference = {
      id: album.id,
      slug: album.slug,
      title: album.title,
      coverAssetId: album.coverAssetId,
    };

    return album.tracks.map((track) => ({
      ...track,
      album: reference,
    }));
  });

  protected readonly bookletContext = computed<AlbumBookletContext>(() => ({
    title: this.data().album.title,
    coverAssetId: this.data().album.coverAssetId,
    releasedAt: this.data().album.releasedAt,
    editorial: this.data().album.editorial,
    tracks: this.tracks(),
  }));

  protected readonly hasEmbeddedPlayer = computed(
    () =>
      this.data().album.booklet?.sections.some((section) =>
        section.rows.some((row) =>
          row.columns.some((column) => column.blocks.some((block) => block.type === 'albumTracks')),
        ),
      ) ?? false,
  );

  protected assetUrl(assetId: string): string {
    return `/api/assets/${assetId}`;
  }

  protected formatReleaseDate(value: string | null, locale: Language): string | null {
    if (!value) {
      return null;
    }

    return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    }).format(new Date(`${value}T00:00:00`));
  }
}
