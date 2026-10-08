import type { MusicTrack, MusicTrackListItem } from '@shared/music/music';

import { AsyncPipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  PLATFORM_ID,
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
import { MusicPublicService } from '../../core/music/music-public.service';
import { MusicPlaybackStorageService } from '../../core/music/music-playback-storage.service';
import { Icon } from '../icon/icon';
import { RenderedContent } from '../rendered-content/rendered-content';
import { SupportButton } from '../support-button/support-button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, Icon, RenderedContent, RouterLink, SupportButton],
  selector: 'app-music-library-player',
  styleUrl: './music-library-player.scss',
  templateUrl: './music-library-player.html',
})
export class MusicLibraryPlayer {
  private readonly music = inject(MusicPublicService);
  private readonly playbackStorage = inject(MusicPlaybackStorageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly savedPlayback = this.playbackStorage.read();
  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audio');
  private readonly volumeControl = viewChild<ElementRef<HTMLElement>>('volumeControl');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly searchToggle = viewChild<ElementRef<HTMLButtonElement>>('searchToggle');
  private readonly destroyRef = inject(DestroyRef);

  private volumeCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  private restored = false;
  private pendingRestorePosition: number | null = null;
  private lastSavedAt = 0;
  private detailRequestVersion = 0;

  private readonly mediaActions = [
    'play',
    'pause',
    'nexttrack',
    'previoustrack',
    'seekto',
    'seekbackward',
    'seekforward',
  ] as const;

  readonly tracks = input.required<readonly MusicTrackListItem[]>();
  readonly locale = input.required<Language>();

  protected readonly activeTrackId = signal<string | null>(null);
  protected readonly storyTrackId = signal<string | null>(null);
  protected readonly playing = signal(false);
  protected readonly currentTime = signal(0);
  protected readonly volume = signal(this.savedPlayback?.volume ?? 0.8);
  protected readonly prevVolume = signal(this.savedPlayback?.volume || 0.8);
  protected readonly volumeExpanded = signal(false);
  protected readonly trackDetail = signal<MusicTrack | null>(null);
  protected readonly trackDetailLoading = signal(false);
  protected readonly searchOpen = signal(false);
  protected readonly searchQuery = signal('');

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearVolumeCloseTimeout();
      this.persistPlayback();
      this.clearMediaSession();
    });
  }

  protected readonly activeTrack = computed(
    () => this.tracks().find((track) => track.id === this.activeTrackId()) ?? null,
  );

  protected readonly storyTrack = computed(
    () => this.tracks().find((track) => track.id === this.storyTrackId()) ?? null,
  );

  protected readonly currentTrack = computed(
    () =>
      this.activeTrack() ??
      this.tracks().find((track) => track.previewAssetId !== null) ??
      this.tracks()[0] ??
      null,
  );

  protected readonly storyVisible = computed(() => this.storyTrack()?.hasContent ?? false);

  protected readonly filteredTracks = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase();

    if (!query) {
      return this.tracks();
    }

    return this.tracks().filter((track) =>
      `${track.title} ${track.album?.title ?? ''}`.toLocaleLowerCase().includes(query),
    );
  });

  protected readonly previousTrack = computed(() => this.adjacentTrack(-1));
  protected readonly nextTrack = computed(() => this.adjacentTrack(1));

  private readonly detailEffect = effect(() => {
    const track = this.storyTrack();
    const locale = this.locale();
    const requestVersion = ++this.detailRequestVersion;

    this.trackDetail.set(null);
    this.trackDetailLoading.set(false);

    if (!track?.hasContent) {
      return;
    }

    this.trackDetailLoading.set(true);

    void this.loadTrackDetail(track, locale, requestVersion);
  });

  private readonly restoreEffect = effect(() => {
    const tracks = this.tracks();
    const audio = this.audio()?.nativeElement;

    if (this.restored || !audio || !tracks.length) {
      return;
    }

    this.restored = true;
    audio.volume = this.volume();

    const saved = this.savedPlayback;
    const track = tracks.find((item) => item.id === saved?.trackId && item.previewAssetId);

    if (track?.previewAssetId && saved) {
      this.activeTrackId.set(track.id);
      this.currentTime.set(saved.positionSeconds);
      this.pendingRestorePosition = saved.positionSeconds;
      this.volume.set(this.savedPlayback.volume);
      audio.volume = this.savedPlayback.volume;
      this.updateMediaSession(track);
    }

    this.registerMediaActions();
  });

  protected async toggleTrack(track: MusicTrackListItem): Promise<void> {
    if (!track.previewAssetId) {
      return;
    }

    const audio = this.audio()?.nativeElement;

    if (!audio) {
      return;
    }

    if (this.activeTrackId() === track.id) {
      if (!audio.paused) {
        audio.pause();
        return;
      }

      if (!audio.currentSrc || audio.error) {
        audio.src = this.assetUrl(track.previewAssetId);
        audio.load();
      }

      try {
        await audio.play();
      } catch (error: unknown) {
        console.error('Could not resume music playback:', error);
        this.playing.set(false);
      }

      return;
    }

    await this.startTrack(track);
  }

  private async startTrack(track: MusicTrackListItem): Promise<void> {
    if (!track.previewAssetId) {
      return;
    }

    const audio = this.audio()?.nativeElement;

    if (!audio) {
      return;
    }

    this.persistPlayback();
    this.pendingRestorePosition = null;
    this.activeTrackId.set(track.id);
    this.currentTime.set(0);
    this.playing.set(false);
    audio.volume = this.volume();
    audio.src = this.assetUrl(track.previewAssetId);
    audio.load();
    this.persistPlayback();
    this.updateMediaSession(track);

    await audio.play().catch(() => {
      this.playing.set(false);
    });
  }

  protected playAdjacent(direction: -1 | 1): void {
    const track = this.adjacentTrack(direction);

    if (track) {
      void this.startTrack(track);
    }
  }

  private adjacentTrack(direction: -1 | 1): MusicTrackListItem | null {
    const tracks = this.tracks();
    const currentId = this.currentTrack()?.id;
    const index = tracks.findIndex((track) => track.id === currentId);

    for (
      let position = index + direction;
      position >= 0 && position < tracks.length;
      position += direction
    ) {
      if (tracks[position]?.previewAssetId) {
        return tracks[position];
      }
    }

    return null;
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
    const input = event.target;

    if (input instanceof HTMLInputElement) {
      this.searchQuery.set(input.value);
    }
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

    // Shortcut keys are active only when the player region itself has focus.
    // Inputs, links, buttons and browser shortcuts keep their native behavior.
    if (
      event.target !== event.currentTarget ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      const track = this.currentTrack();

      if (track) {
        void this.toggleTrack(track);
      }

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

    if (target instanceof Element && target.closest('a, button, input')) {
      return;
    }

    if (window.matchMedia('(max-width: 900px)').matches) {
      return;
    }

    this.openStory(track);
  }

  protected openStory(track: MusicTrackListItem, event?: Event): void {
    event?.stopPropagation();

    if (!track.hasContent) {
      return;
    }

    this.storyTrackId.set(track.id);
  }

  protected toggleStory(track: MusicTrackListItem, event: Event): void {
    event.stopPropagation();

    if (!track.hasContent) {
      return;
    }

    this.storyTrackId.update((current) => (current === track.id ? null : track.id));
  }

  protected closeStory(): void {
    this.storyTrackId.set(null);
  }

  protected toggleVolume(event: Event): void {
    event.stopPropagation();

    if (this.volumeExpanded()) {
      this.closeVolume();

      return;
    }

    this.volumeExpanded.set(true);
    this.scheduleVolumeClose();
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.volumeExpanded()) {
      return;
    }

    const target = event.target;
    const control = this.volumeControl()?.nativeElement;

    if (target instanceof Node && control?.contains(target)) {
      return;
    }
  }

  protected mute(): void {
    this.prevVolume.set(this.volume());
    this.volume.set(0);

    const audio = this.audio()?.nativeElement;

    if (audio) {
      audio.volume = 0;
    }

    this.persistPlayback();
  }

  protected unmute(): void {
    const prev = this.prevVolume();
    this.volume.set(prev);

    const audio = this.audio()?.nativeElement;

    if (audio) {
      audio.volume = prev;
    }

    this.persistPlayback();
  }

  protected setVolume(event: Event): void {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const value = Number(target.value);

    if (!Number.isFinite(value)) {
      return;
    }

    const volume = Math.min(1, Math.max(0, value));

    this.volume.set(volume);
    if (volume > 0) {
      this.prevVolume.set(volume);
    }

    const audio = this.audio()?.nativeElement;

    if (audio) {
      audio.volume = volume;
    }

    this.persistPlayback();

    if (this.volumeExpanded()) {
      this.scheduleVolumeClose();
    }
  }

  protected seek(event: Event): void {
    const target = event.target;
    const audio = this.audio()?.nativeElement;

    if (!(target instanceof HTMLInputElement) || !audio) {
      return;
    }

    const value = Number(target.value);

    if (!Number.isFinite(value)) {
      return;
    }

    audio.currentTime = value;
    this.currentTime.set(value);
    this.persistPlayback();
  }

  protected onTimeUpdate(event: Event): void {
    const target = event.currentTarget;

    if (!(target instanceof HTMLAudioElement)) {
      return;
    }

    this.currentTime.set(target.currentTime);

    if (this.pendingRestorePosition === null && Date.now() - this.lastSavedAt >= 4_000) {
      this.persistPlayback();
    }
  }

  protected onLoadedMetadata(): void {
    const audio = this.audio()?.nativeElement;
    const position = this.pendingRestorePosition;

    if (!audio || position === null) {
      return;
    }

    this.pendingRestorePosition = null;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const safePosition = duration > 0 && position < duration - 1 ? position : 0;
    audio.currentTime = safePosition;
    this.currentTime.set(safePosition);
  }

  protected onPlay(): void {
    this.playing.set(true);
    this.setMediaPlaybackState('playing');
  }

  protected onPause(): void {
    this.playing.set(false);
    this.setMediaPlaybackState('paused');

    if (this.pendingRestorePosition === null) {
      this.persistPlayback();
    }
  }

  protected onEnded(): void {
    const next = this.adjacentTrack(1);

    if (next) {
      void this.startTrack(next);
      return;
    }

    const audio = this.audio()?.nativeElement;
    if (audio) {
      audio.currentTime = 0;
    }

    this.playing.set(false);
    this.currentTime.set(0);
    this.persistPlayback();
    this.setMediaPlaybackState('paused');
  }

  @HostListener('window:pagehide')
  protected onPageHide(): void {
    this.persistPlayback();
  }

  private persistPlayback(): void {
    const track = this.activeTrack();

    // An album page must not overwrite the last song from another album.
    if (!track?.previewAssetId || this.pendingRestorePosition !== null) {
      return;
    }

    this.playbackStorage.save({
      trackId: track.id,
      positionSeconds: this.currentTime(),
      volume: this.volume(),
    });
    this.lastSavedAt = Date.now();
    this.updateMediaPosition();
  }

  private registerMediaActions(): void {
    if (!this.isBrowser || !('mediaSession' in navigator)) {
      return;
    }

    const actions: Partial<Record<(typeof this.mediaActions)[number], MediaSessionActionHandler>> =
      {
        play: () => {
          if (this.audio()?.nativeElement.paused) {
            const track = this.currentTrack();
            if (track) void this.toggleTrack(track);
          }
        },
        pause: () => this.audio()?.nativeElement.pause(),
        nexttrack: () => this.playAdjacent(1),
        previoustrack: () => this.playAdjacent(-1),
        seekto: ({ seekTime }) => this.seekToSeconds(seekTime ?? this.currentTime()),
        seekbackward: ({ seekOffset }) =>
          this.seekToSeconds(this.currentTime() - (seekOffset ?? 5)),
        seekforward: ({ seekOffset }) => this.seekToSeconds(this.currentTime() + (seekOffset ?? 5)),
      };

    for (const action of this.mediaActions) {
      try {
        navigator.mediaSession.setActionHandler(action, actions[action] ?? null);
      } catch {
        // The browser may not support every media action.
      }
    }
  }

  private seekToSeconds(seconds: number): void {
    const audio = this.audio()?.nativeElement;
    if (!audio || !Number.isFinite(audio.duration)) return;

    const position = Math.max(0, Math.min(audio.duration, seconds));
    audio.currentTime = position;
    this.currentTime.set(position);
    this.persistPlayback();
  }

  private updateMediaSession(track: MusicTrackListItem): void {
    if (!this.isBrowser || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') {
      return;
    }

    const cover = this.coverAssetId(track);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: 'Mimi',
      album: track.album?.title ?? '',
      artwork: cover ? [{ src: this.assetUrl(cover) }] : [],
    });
    this.updateMediaPosition();
  }

  private updateMediaPosition(): void {
    if (!this.isBrowser || !('mediaSession' in navigator)) return;

    const duration = this.activeTrack()?.previewDurationSeconds ?? 0;
    if (!duration || !Number.isFinite(duration)) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.max(0, Math.min(this.currentTime(), duration)),
      });
    } catch {
      // Position updates are optional and vary by browser.
    }
  }

  private setMediaPlaybackState(state: MediaSessionPlaybackState): void {
    if (this.isBrowser && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  private clearMediaSession(): void {
    if (!this.isBrowser || !('mediaSession' in navigator)) return;

    for (const action of this.mediaActions) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {
        // Unsupported action.
      }
    }
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }

  protected isTrackPlaying(track: MusicTrackListItem): boolean {
    return this.activeTrackId() === track.id && this.playing();
  }

  protected formatDuration(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;

    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  }

  protected assetUrl(assetId: string): string {
    return `/api/assets/${assetId}`;
  }

  protected coverAssetId(track: MusicTrackListItem): string | null {
    return track.coverAssetId ?? track.album?.coverAssetId ?? null;
  }

  private closeVolume(): void {
    this.volumeExpanded.set(false);
    this.clearVolumeCloseTimeout();
  }

  private scheduleVolumeClose(): void {
    this.clearVolumeCloseTimeout();

    this.volumeCloseTimeout = setTimeout(() => {
      this.volumeExpanded.set(false);
      this.volumeCloseTimeout = null;
    }, 3_000);
  }

  private clearVolumeCloseTimeout(): void {
    if (this.volumeCloseTimeout === null) {
      return;
    }

    clearTimeout(this.volumeCloseTimeout);
    this.volumeCloseTimeout = null;
  }

  private async loadTrackDetail(
    track: MusicTrackListItem,
    locale: Language,
    requestVersion: number,
  ): Promise<void> {
    try {
      const detail = await firstValueFrom(this.music.getTrack(track.slug, locale));

      if (requestVersion !== this.detailRequestVersion) {
        return;
      }

      this.trackDetail.set(detail);
    } catch {
      if (requestVersion === this.detailRequestVersion) {
        this.trackDetail.set(null);
      }
    } finally {
      if (requestVersion === this.detailRequestVersion) {
        this.trackDetailLoading.set(false);
      }
    }
  }
}
