import { isPlatformBrowser, AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, PLATFORM_ID,
  afterNextRender, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { MusicPlaybackService } from '../../core/music/music-playback.service';
import { MusicWaveformService, visibleWaveform } from '../../core/music/music-waveform.service';
import { LocalStorageService } from '../../core/storage/local-storage.service';
import { Icon } from '../icon/icon';

const UI_STORAGE_KEY = 'music.player.collapsed.v2';
const MOBILE_MEDIA = '(max-width: 820px)';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-global-music-player',
  imports: [AsyncPipe, RouterLink, I18nPipe, Icon],
  styleUrl: './global-music-player-v2.scss',
  templateUrl: './global-music-player-v2.html',
  host: {
    '[class.is-visible]': 'playback.activeTrack() !== null',
    '[class.is-collapsed]': 'compact()',
    '[class.is-expanded]': 'mobile() && !compact()',
  },
})
export class GlobalMusicPlayer {
  protected readonly playback = inject(MusicPlaybackService);
  private readonly storage = inject(LocalStorageService);
  private readonly waveformService = inject(MusicWaveformService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly waveformElement = viewChild<ElementRef<HTMLElement>>('waveformElement');

  protected readonly mobile = signal(false);
  private readonly desktopCollapsed = signal(this.browser && this.storage.get<boolean>(UI_STORAGE_KEY) === true);
  private readonly mobileExpanded = signal(false);
  protected readonly compact = computed(() => this.mobile() ? !this.mobileExpanded() : this.desktopCollapsed());
  protected readonly panel = signal<'queue' | 'info' | null>(null);
  private readonly waveform = signal<readonly number[] | null>(null);
  private readonly waveWidth = signal(460);
  protected readonly waveBars = computed(() => visibleWaveform(
    this.waveform() ?? [], Math.max(64, Math.min(320, Math.floor(this.waveWidth() / 2.5))),
  ));
  protected readonly waveViewBox = computed(() => `0 0 ${this.waveBars().length * 2.5} 40`);
  private waveformRequest = 0;

  protected readonly currentDuration = computed(() =>
    this.playback.activeTrack()?.previewDurationSeconds ?? 0,
  );
  protected readonly playedPercent = computed(() => {
    const duration = this.currentDuration();
    return duration > 0 ? Math.min(100, Math.max(0, 100 * this.playback.currentTime() / duration)) : 0;
  });

  constructor() {
    afterNextRender(() => {
      const media = window.matchMedia(MOBILE_MEDIA);
      const sync = () => {
        this.mobile.set(media.matches);
        this.panel.set(null);
      };
      sync();
      media.addEventListener('change', sync);
      this.destroyRef.onDestroy(() => media.removeEventListener('change', sync));
    });
    effect((onCleanup) => {
      const element = this.waveformElement()?.nativeElement;
      if (!this.browser || !element || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        if (width && Number.isFinite(width)) this.waveWidth.set(width);
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
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

  protected toggleView(): void {
    if (this.mobile()) {
      this.mobileExpanded.update((expanded) => !expanded);
    } else {
      this.desktopCollapsed.update((collapsed) => !collapsed);
      if (this.browser) this.storage.set(UI_STORAGE_KEY, this.desktopCollapsed());
    }
    if (this.compact()) this.panel.set(null);
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
