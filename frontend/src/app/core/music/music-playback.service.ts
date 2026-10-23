import type { MusicTrackListItem } from '@shared/music/music';

import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { Store } from '@ngxs/store';
import { firstValueFrom } from 'rxjs';

import { I18nState } from '../i18n/i18n.state';
import { MusicPlaybackStorageService } from './music-playback-storage.service';
import { MusicPublicService } from './music-public.service';

/** Owns the one audio element used throughout the application. */
@Injectable({ providedIn: 'root' })
export class MusicPlaybackService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly storage = inject(MusicPlaybackStorageService);
  private readonly music = inject(MusicPublicService);
  private readonly store = inject(Store);
  private readonly saved = this.storage.read();

  private audio: HTMLAudioElement | null = null;
  private pendingPosition: number | null = this.saved?.positionSeconds ?? null;
  private lastSavedAt = 0;
  private restoreVersion = 0;
  private playAttempt = 0;
  private lastVolume = this.saved?.volume || 0.8;

  readonly activeTrack = signal<MusicTrackListItem | null>(null);
  readonly queue = signal<readonly MusicTrackListItem[]>([]);
  readonly playing = signal(false);
  readonly currentTime = signal(this.saved?.positionSeconds ?? 0);
  readonly volume = signal(this.saved?.volume ?? 0.8);
  readonly fullPlayerCount = signal(0);
  readonly shuffle = signal(this.saved?.shuffleEnabled ?? false);
  readonly repeat = signal<'off' | 'all' | 'one'>(this.saved?.repeatMode ?? 'off');
  private readonly shuffledIds = signal<readonly string[]>([]);
  readonly orderedQueue = computed(() => {
    const tracks = this.queue();
    if (!this.shuffle()) return tracks;
    const byId = new Map(tracks.map((track) => [track.id, track]));
    const ids = this.shuffledIds();
    return [...ids.map((id) => byId.get(id)).filter((item): item is MusicTrackListItem => !!item),
      ...tracks.filter((item) => !ids.includes(item.id))];
  });
  readonly previousTrack = computed(() => this.adjacent(-1));
  readonly nextTrack = computed(() => this.adjacent(1));

  constructor() {
    if (!this.browser) return;

    window.addEventListener('pagehide', this.onPageHide);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('pagehide', this.onPageHide);
      this.persist();
      this.audio?.pause();
      this.audio?.removeAttribute('src');
      this.audio?.load();
      this.audio = null;
      this.clearMediaSession();
    });

    // Restore metadata only. Never start audio without a user gesture.
    if (this.saved) {
      const language = this.store.selectSignal(I18nState.language);
      effect(() => {
        void this.restore(language());
      });
    }
  }

  /** The full library view suppresses the floating mini player. */
  registerFullPlayer(): () => void {
    this.fullPlayerCount.update((count) => count + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.fullPlayerCount.update((count) => Math.max(0, count - 1));
    };
  }

  async toggleTrack(
    track: MusicTrackListItem,
    sourceQueue?: readonly MusicTrackListItem[],
  ): Promise<void> {
    if (!track.previewAssetId || !this.browser) return;

    if (this.activeTrack()?.id === track.id) {
      if (this.playing()) {
        this.pause();
      } else {
        await this.resume();
      }
      return;
    }

    const playable = (sourceQueue ?? [track]).filter((item) => item.previewAssetId !== null);
    this.queue.set(playable.some((item) => item.id === track.id) ? playable : [track]);
    this.makeShuffleOrder(track.id);
    this.pendingPosition = null;
    this.selectTrack(track, 0);
    await this.resume();
  }

  async toggle(): Promise<void> {
    if (this.playing()) {
      this.pause();
    } else {
      await this.resume();
    }
  }

  pause(): void {
    ++this.playAttempt;
    this.audio?.pause();
  }

  async resume(): Promise<void> {
    const track = this.activeTrack();
    if (!this.browser || !track?.previewAssetId) return;

    const attempt = ++this.playAttempt;
    const audio = this.ensureAudio();
    const src = this.assetUrl(track.previewAssetId);
    if (audio.getAttribute('src') !== src || audio.error) {
      audio.src = src;
      audio.load();
    }
    try {
      await audio.play();
    } catch (error: unknown) {
      if (attempt === this.playAttempt) {
        this.playing.set(false);
        console.error('Could not start music playback:', error);
      }
    }
  }

  async playAdjacent(direction: -1 | 1): Promise<void> {
    const track = this.adjacent(direction);
    if (!track) return;
    this.persist();
    this.pendingPosition = null;
    this.selectTrack(track, 0);
    await this.resume();
  }

  toggleShuffle(): void {
    this.shuffle.update((enabled) => !enabled);
    if (this.shuffle()) this.makeShuffleOrder(this.activeTrack()?.id);
    this.persist();
  }

  cycleRepeat(): void {
    this.repeat.update((mode) => mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off');
    this.persist();
  }

  private makeShuffleOrder(activeId?: string): void {
    const ids = this.queue().map((item) => item.id).filter((id) => id !== activeId);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    this.shuffledIds.set(activeId ? [activeId, ...ids] : ids);
  }

  setVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    const volume = Math.max(0, Math.min(1, value));
    this.volume.set(volume);
    if (volume > 0) this.lastVolume = volume;
    if (this.audio) this.audio.volume = volume;
    this.persist();
  }

  mute(): void {
    this.setVolume(0);
  }

  unmute(): void {
    this.setVolume(this.lastVolume || 0.8);
  }

  seekTo(seconds: number): void {
    if (!Number.isFinite(seconds) || !this.activeTrack()) return;
    const duration = this.audio && Number.isFinite(this.audio.duration)
      ? this.audio.duration
      : this.activeTrack()?.previewDurationSeconds ?? 0;
    const position = Math.max(0, Math.min(seconds, duration));
    this.currentTime.set(position);
    if (this.audio?.getAttribute('src')) {
      this.audio.currentTime = position;
    } else {
      this.pendingPosition = position;
    }
    this.persist();
    this.updateMediaPosition();
  }

  private async restore(locale: 'de' | 'en'): Promise<void> {
    const saved = this.saved;
    if (!saved) return;
    const version = ++this.restoreVersion;
    try {
      const data = await firstValueFrom(this.music.getLanding(locale));
      if (version !== this.restoreVersion || this.activeTrack()) return;
      const track = data.tracks.find((item) => item.id === saved.trackId && item.previewAssetId);
      if (!track) return;
      const byId = new Map(data.tracks.map((item) => [item.id, item]));
      const savedQueue = saved.queueTrackIds?.map((id) => byId.get(id)).filter(
        (item): item is MusicTrackListItem => Boolean(item?.previewAssetId),
      ) ?? [];
      this.queue.set(savedQueue.some((item) => item.id === track.id)
        ? savedQueue
        : data.tracks.filter((item) => item.previewAssetId !== null));
      if (this.shuffle()) this.makeShuffleOrder(track.id);
      this.activeTrack.set(track);
      this.currentTime.set(saved.positionSeconds);
      this.pendingPosition = saved.positionSeconds;
      this.updateMediaSession(track);
    } catch {
      // A stale/offline library must not prevent the rest of the site from loading.
    }
  }

  private selectTrack(track: MusicTrackListItem, position: number): void {
    ++this.restoreVersion;
    ++this.playAttempt;
    this.playing.set(false);
    this.activeTrack.set(track);
    this.currentTime.set(position);
    if (this.audio) {
      this.audio.pause();
      this.audio.src = this.assetUrl(track.previewAssetId!);
      this.audio.volume = this.volume();
      this.audio.load();
    }
    this.updateMediaSession(track);
    this.persist();
  }

  private adjacent(direction: -1 | 1): MusicTrackListItem | null {
    const active = this.activeTrack();
    if (!active) return null;
    const tracks = this.orderedQueue();
    const index = tracks.findIndex((item) => item.id === active.id);
    if (index < 0) return null;
    const nextIndex = index + direction;
    if (nextIndex >= 0 && nextIndex < tracks.length) return tracks[nextIndex];
    return this.repeat() === 'all' && tracks.length > 1
      ? tracks[(nextIndex + tracks.length) % tracks.length] : null;
  }

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = this.volume();
    audio.addEventListener('play', () => {
      this.playing.set(true);
      this.setMediaPlaybackState('playing');
    });
    audio.addEventListener('pause', () => {
      this.playing.set(false);
      this.setMediaPlaybackState('paused');
      if (this.pendingPosition === null) this.persist();
    });
    audio.addEventListener('loadedmetadata', () => {
      if (this.pendingPosition === null) return;
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const position = duration > 0 && this.pendingPosition < duration - 1
        ? this.pendingPosition : 0;
      this.pendingPosition = null;
      audio.currentTime = position;
      this.currentTime.set(position);
      this.updateMediaPosition();
    });
    audio.addEventListener('timeupdate', () => {
      this.currentTime.set(audio.currentTime);
      if (this.pendingPosition === null && Date.now() - this.lastSavedAt >= 4_000) {
        this.persist();
      }
    });
    audio.addEventListener('ended', () => {
      if (this.repeat() === 'one') {
        this.seekTo(0);
        void this.resume();
      } else if (this.nextTrack()) {
        void this.playAdjacent(1);
      } else {
        audio.currentTime = 0;
        this.currentTime.set(0);
        this.playing.set(false);
        this.persist();
        this.setMediaPlaybackState('paused');
      }
    });
    this.audio = audio;
    this.registerMediaSession();
    return audio;
  }

  private persist(): void {
    const track = this.activeTrack();
    if (!this.browser || !track?.previewAssetId || this.pendingPosition !== null) return;
    this.storage.save({
      trackId: track.id,
      positionSeconds: this.currentTime(),
      volume: this.volume(),
      queueTrackIds: this.queue().map((item) => item.id),
      shuffleEnabled: this.shuffle(),
      repeatMode: this.repeat(),
    });
    this.lastSavedAt = Date.now();
    this.updateMediaPosition();
  }

  private readonly onPageHide = (): void => {
    this.persist();
  };

  private assetUrl(assetId: string): string {
    return `/api/assets/${assetId}`;
  }

  private registerMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => { void this.resume(); },
      pause: () => this.pause(),
      previoustrack: () => { void this.playAdjacent(-1); },
      nexttrack: () => { void this.playAdjacent(1); },
      seekto: ({ seekTime }) => this.seekTo(seekTime ?? this.currentTime()),
      seekbackward: ({ seekOffset }) => this.seekTo(this.currentTime() - (seekOffset ?? 5)),
      seekforward: ({ seekOffset }) => this.seekTo(this.currentTime() + (seekOffset ?? 5)),
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler);
      } catch {
        // Media Session actions vary by browser.
      }
    }
  }

  private updateMediaSession(track: MusicTrackListItem): void {
    if (!this.browser || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') {
      return;
    }
    const cover = track.coverAssetId ?? track.album?.coverAssetId;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: 'Mimi',
      album: track.album?.title ?? '',
      artwork: cover ? [{ src: this.assetUrl(cover) }] : [],
    });
    this.updateMediaPosition();
  }

  private updateMediaPosition(): void {
    if (!this.browser || !('mediaSession' in navigator)) return;
    const duration = this.activeTrack()?.previewDurationSeconds ?? 0;
    if (!duration || !Number.isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.max(0, Math.min(this.currentTime(), duration)),
      });
    } catch {
      // Position reporting is optional.
    }
  }

  private setMediaPlaybackState(state: MediaSessionPlaybackState): void {
    if (this.browser && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  private clearMediaSession(): void {
    if (!this.browser || !('mediaSession' in navigator)) return;
    for (const action of [
      'play', 'pause', 'nexttrack', 'previoustrack', 'seekto', 'seekbackward', 'seekforward',
    ] as const) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {
        // Not supported.
      }
    }
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
}
