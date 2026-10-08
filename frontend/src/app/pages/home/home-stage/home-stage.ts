import type { CommunityDiscordSummary } from '@shared/community/community-public';
import type { GamingNextStream } from '@shared/gaming/gaming';
import type { MusicAlbumSummary } from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import { catchError, distinctUntilChanged, of, switchMap } from 'rxjs';

import { GamingService } from '../../../core/gaming/gaming.service';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { I18nState } from '../../../core/i18n/i18n.state';
import { MusicPublicService } from '../../../core/music/music-public.service';
import { STAGE_WORLDS, type StageWorld } from './stage-orbit';
import type { StageOrbitRenderer } from './stage-orbit-renderer';

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
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('stageCanvas');
  private readonly language = this.store.selectSignal(I18nState.language);
  private renderer: StageOrbitRenderer | null = null;

  protected readonly worlds = STAGE_WORLDS;
  protected readonly activeWorld = signal<StageWorld>('music');
  protected readonly webglReady = signal(false);

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

  constructor() {
    afterNextRender(() => {
      const canvas = this.canvas()?.nativeElement;
      if (canvas && typeof window.WebGLRenderingContext !== 'undefined') {
        void this.createScene(canvas);
      }
    });
    this.destroyRef.onDestroy(() => {
      this.renderer?.dispose();
      this.renderer = null;
    });
  }

  protected selectWorld(world: StageWorld): void {
    this.activeWorld.set(world);
    this.renderer?.select(world);
  }

  protected step(direction: -1 | 1): void {
    if (this.renderer && this.webglReady()) {
      this.renderer.step(direction);
      return;
    }
    const current = this.worlds.indexOf(this.activeWorld());
    const next = (current + direction + this.worlds.length) % this.worlds.length;
    this.activeWorld.set(this.worlds[next]);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.step(1);
    }
  }

  protected coverUrl(assetId: string): string {
    return `/api/assets/${assetId}/image/thumbnail/webp`;
  }

  private async createScene(canvas: HTMLCanvasElement): Promise<void> {
    let instance: StageOrbitRenderer | null = null;
    try {
      // Kept out of the SSR bundle and loaded only when the browser can render WebGL.
      const { StageOrbitRenderer } = await import('./stage-orbit-renderer');
      if (this.destroyRef.destroyed) {
        return;
      }
      instance = new StageOrbitRenderer(
        canvas,
        (world) => this.activeWorld.set(world),
        () => this.webglReady.set(true),
        () => this.webglReady.set(false),
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
      this.renderer = instance;
      await instance.init();
      if (this.destroyRef.destroyed) {
        instance.dispose();
        this.renderer = null;
        return;
      }
      instance.select(this.activeWorld());
    } catch {
      instance?.dispose();
      this.renderer = null;
      this.webglReady.set(false);
    }
  }
}
