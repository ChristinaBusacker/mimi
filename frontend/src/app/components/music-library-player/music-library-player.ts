import type { MusicTrack, MusicTrackListItem } from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import type { Language } from '../../core/i18n/i18n.types';
import { MusicPlaybackService } from '../../core/music/music-playback.service';
import { MusicPublicService } from '../../core/music/music-public.service';
import { Icon } from '../icon/icon';
import { RenderedContent } from '../rendered-content/rendered-content';
import { SupportButton } from '../support-button/support-button';

/** Track browser and song stories. Audio always belongs to MusicPlaybackService. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, Icon, RenderedContent, RouterLink, SupportButton],
  selector: 'app-music-library-player',
  styleUrl: './music-library-player.scss',
  templateUrl: './music-library-player.html',
})
export class MusicLibraryPlayer {
  private readonly music = inject(MusicPublicService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly playback = inject(MusicPlaybackService);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly searchToggle = viewChild<ElementRef<HTMLButtonElement>>('searchToggle');
  private detailRequestVersion = 0;

  readonly tracks = input.required<readonly MusicTrackListItem[]>();
  readonly locale = input.required<Language>();

  protected readonly activeTrackId = computed(() => this.playback.activeTrack()?.id ?? null);
  protected readonly playing = this.playback.playing;
  protected readonly currentTime = this.playback.currentTime;
  protected readonly volume = this.playback.volume;
  protected readonly storyTrackId = signal<string | null>(null);
  protected readonly trackDetail = signal<MusicTrack | null>(null);
  protected readonly trackDetailLoading = signal(false);
  protected readonly searchOpen = signal(false);
  protected readonly searchQuery = signal('');

  protected readonly currentTrack = computed(() =>
    this.playback.activeTrack() ??
    this.tracks().find((track) => track.previewAssetId !== null) ??
    this.tracks()[0] ?? null,
  );
  protected readonly storyTrack = computed(() =>
    this.tracks().find((track) => track.id === this.storyTrackId()) ?? null,
  );
  protected readonly storyVisible = computed(() => this.storyTrack()?.hasContent ?? false);
  protected readonly previousTrack = computed(() => this.playback.previousTrack());
  protected readonly nextTrack = computed(() =>
    this.playback.activeTrack()
      ? this.playback.nextTrack()
      : this.tracks().filter((track) => track.previewAssetId !== null)[1] ?? null,
  );
  protected readonly filteredTracks = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase();
    return query
      ? this.tracks().filter((track) =>
          `${track.title} ${track.album?.title ?? ''}`.toLocaleLowerCase().includes(query),
        )
      : this.tracks();
  });

  private readonly detailEffect = effect(() => {
    const track = this.storyTrack();
    const locale = this.locale();
    const version = ++this.detailRequestVersion;
    this.trackDetail.set(null);
    this.trackDetailLoading.set(false);
    if (!track?.hasContent) return;
    this.trackDetailLoading.set(true);
    void this.loadTrackDetail(track, locale, version);
  });

  constructor() {
    this.destroyRef.onDestroy(this.playback.registerFullPlayer());
  }

  protected async toggleTrack(track: MusicTrackListItem): Promise<void> {
    await this.playback.toggleTrack(track, this.tracks());
  }

  protected playAdjacent(direction: -1 | 1): void {
    if (this.playback.activeTrack()) {
      void this.playback.playAdjacent(direction);
      return;
    }
    // Match the original player: Next starts the second playable track.
    const track = this.tracks().filter((item) => item.previewAssetId !== null)[1];
    if (track && direction === 1) void this.toggleTrack(track);
  }

  protected isTrackPlaying(track: MusicTrackListItem): boolean {
    return this.activeTrackId() === track.id && this.playing();
  }

  protected setVolume(event: Event): void {
    const element = event.target;
    if (element instanceof HTMLInputElement) this.playback.setVolume(Number(element.value));
  }

  protected mute(): void {
    this.playback.mute();
  }

  protected unmute(): void {
    this.playback.unmute();
  }

  protected seek(event: Event): void {
    const element = event.target;
    if (element instanceof HTMLInputElement) this.playback.seekTo(Number(element.value));
  }

  protected toggleSearch(): void {
    this.searchOpen.update((open) => !open);
    if (this.searchOpen()) {
      setTimeout(() => this.searchInput()?.nativeElement.focus(), 0);
    } else {
      this.searchQuery.set('');
      this.searchToggle()?.nativeElement.focus();
    }
  }

  protected updateSearch(event: Event): void {
    const element = event.target;
    if (element instanceof HTMLInputElement) this.searchQuery.set(element.value);
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
    this.searchQuery.set('');
    this.searchToggle()?.nativeElement.focus();
  }

  protected onPlayerKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.searchOpen()) {
        event.preventDefault();
        this.closeSearch();
      } else if (this.storyTrackId()) {
        event.preventDefault();
        this.closeStory();
      }
      return;
    }

    // Only the player region owns shortcuts; interactive descendants keep native behavior.
    if (
      event.target !== event.currentTarget ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    ) return;

    if (event.code === 'Space') {
      event.preventDefault();
      const track = this.currentTrack();
      if (track) void this.toggleTrack(track);
      return;
    }

    switch (event.key.toLocaleLowerCase()) {
      case 'n':
        event.preventDefault();
        this.playAdjacent(1);
        break;
      case 'p':
        event.preventDefault();
        this.playAdjacent(-1);
        break;
      case 'm':
        event.preventDefault();
        this.volume() === 0 ? this.unmute() : this.mute();
        break;
    }
  }

  protected onTrackRowClick(track: MusicTrackListItem, event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest('a, button, input')) return;
    if (window.matchMedia('(max-width: 900px)').matches) return;
    this.openStory(track);
  }

  protected openStory(track: MusicTrackListItem, event?: Event): void {
    event?.stopPropagation();
    if (track.hasContent) this.storyTrackId.set(track.id);
  }

  protected toggleStory(track: MusicTrackListItem, event: Event): void {
    event.stopPropagation();
    if (track.hasContent) {
      this.storyTrackId.update((id) => id === track.id ? null : track.id);
    }
  }

  protected closeStory(): void {
    this.storyTrackId.set(null);
  }

  protected formatDuration(seconds: number): string {
    const value = Math.max(0, Math.floor(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  protected assetUrl(assetId: string): string {
    return `/api/assets/${assetId}`;
  }

  protected coverAssetId(track: MusicTrackListItem): string | null {
    return track.coverAssetId ?? track.album?.coverAssetId ?? null;
  }

  private async loadTrackDetail(
    track: MusicTrackListItem,
    locale: Language,
    version: number,
  ): Promise<void> {
    try {
      const detail = await firstValueFrom(this.music.getTrack(track.slug, locale));
      if (version === this.detailRequestVersion) this.trackDetail.set(detail);
    } catch {
      if (version === this.detailRequestVersion) this.trackDetail.set(null);
    } finally {
      if (version === this.detailRequestVersion) this.trackDetailLoading.set(false);
    }
  }
}
