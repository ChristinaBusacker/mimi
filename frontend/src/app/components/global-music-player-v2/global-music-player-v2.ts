import { isPlatformBrowser, AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { MusicPlaybackService } from '../../core/music/music-playback.service';
import { LocalStorageService } from '../../core/storage/local-storage.service';
import { MusicWaveformService } from '../../core/music/music-waveform.service';
import { Icon } from '../icon/icon';

const UI_STORAGE_KEY = 'music.player.collapsed.v2';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-global-music-player',
  imports: [AsyncPipe, RouterLink, I18nPipe, Icon],
  styleUrl: './global-music-player-v2.scss',
  templateUrl: './global-music-player-v2.html',
  host: {
    '[class.is-visible]': 'playback.activeTrack() !== null',
    '[class.is-collapsed]': 'collapsed()',
    '[class.is-expanded]': 'mobileExpanded()',
  },
})
export class GlobalMusicPlayer {
  protected readonly playback = inject(MusicPlaybackService);
  private readonly storage = inject(LocalStorageService);
  private readonly waveformService = inject(MusicWaveformService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly collapsed = signal(this.browser && this.storage.get<boolean>(UI_STORAGE_KEY) === true);
  protected readonly mobileExpanded = signal(false);
  protected readonly panel = signal<'queue' | 'info' | null>(null);
  protected readonly waveform = signal<readonly number[] | null>(null);
  private waveformRequest = 0;

  protected readonly currentDuration = computed(() =>
    this.playback.activeTrack()?.previewDurationSeconds ?? 0,
  );
  protected readonly playedPercent = computed(() => {
    const duration = this.currentDuration();
    return duration > 0 ? Math.min(100, Math.max(0, 100 * this.playback.currentTime() / duration)) : 0;
  });

  constructor() {
    effect(() => {
      const assetId = this.playback.activeTrack()?.previewAssetId;
      const request = ++this.waveformRequest;
      this.waveform.set(null);
      if (!this.browser || !assetId) return;
      void this.waveformService.get(assetId).then((peaks) => {
        if (request === this.waveformRequest) this.waveform.set(peaks);
      });
    });
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
    if (this.browser) this.storage.set(UI_STORAGE_KEY, this.collapsed());
    if (this.collapsed()) { this.mobileExpanded.set(false); this.panel.set(null); }
  }
  protected toggleExpanded(): void {
    this.mobileExpanded.update((expanded) => !expanded);
    if (!this.mobileExpanded()) this.panel.set(null);
  }
  protected togglePanel(target: 'queue' | 'info'): void {
    this.panel.update((current) => current === target ? null : target);
  }
  protected seek(event: Event): void {
    const element = event.target;
    if (element instanceof HTMLInputElement) this.playback.seekTo(Number(element.value));
  }
  protected volume(event: Event): void {
    const element = event.target;
    if (element instanceof HTMLInputElement) this.playback.setVolume(Number(element.value));
  }
  protected formatTime(seconds: number): string {
    const value = Math.max(0, Math.floor(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }
  protected assetUrl(assetId: string): string { return `/api/assets/${assetId}`; }
  protected playQueued(id: string): void {
    const track = this.playback.queue().find((item) => item.id === id);
    if (track) void this.playback.toggleTrack(track, this.playback.queue());
  }
}
