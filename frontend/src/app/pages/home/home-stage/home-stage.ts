import type { CommunityDiscordSummary } from '@shared/community/community-public';
import type { GamingNextStream } from '@shared/gaming/gaming';
import type { MusicAlbumSummary } from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import { catchError, distinctUntilChanged, of, switchMap } from 'rxjs';

import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { I18nState } from '../../../core/i18n/i18n.state';
import { GamingService } from '../../../core/gaming/gaming.service';
import { MusicPublicService } from '../../../core/music/music-public.service';

type StageWorld = 'music' | 'gaming' | 'community';
type StagePosition = 'center' | 'left' | 'right';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, RouterLink],
  selector: 'app-home-stage',
  styleUrl: './home-stage.scss',
  templateUrl: './home-stage.html',
})
export class HomeStage {
  readonly community = input<CommunityDiscordSummary | null>(null);

  private readonly store = inject(Store);
  private readonly music = inject(MusicPublicService);
  private readonly gaming = inject(GamingService);
  private readonly language = this.store.selectSignal(I18nState.language);

  protected readonly activeWorld = signal<StageWorld>('music');

  protected readonly albums = toSignal(
    toObservable(this.language).pipe(
      distinctUntilChanged(),
      switchMap((locale) =>
        this.music.getAlbums(locale).pipe(catchError(() => of<MusicAlbumSummary[]>([]))),
      ),
    ),
    { initialValue: [] as MusicAlbumSummary[] },
  );

  protected readonly upcomingGame = toSignal(
    toObservable(this.language).pipe(
      distinctUntilChanged(),
      switchMap((locale) =>
        this.gaming.getNextStream(locale).pipe(catchError(() => of<GamingNextStream | null>(null))),
      ),
    ),
    { initialValue: null as GamingNextStream | null },
  );

  protected readonly featuredAlbum = computed(() => this.albums()[0] ?? null);

  protected selectWorld(world: StageWorld): void {
    this.activeWorld.set(world);
  }

  protected positionFor(world: StageWorld): StagePosition {
    const active = this.activeWorld();

    if (world === active) {
      return 'center';
    }

    if (world === 'gaming' || (world === 'music' && active === 'gaming')) {
      return 'left';
    }

    return 'right';
  }

  protected coverUrl(assetId: string): string {
    return `/api/assets/${assetId}/image/thumbnail/webp`;
  }
}
