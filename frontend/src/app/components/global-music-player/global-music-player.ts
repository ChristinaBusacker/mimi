import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { MusicPlaybackService } from '../../core/music/music-playback.service';
import { Icon } from '../icon/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-global-music-player',
  imports: [AsyncPipe, RouterLink, I18nPipe, Icon],
  styleUrl: './global-music-player.scss',
  templateUrl: './global-music-player.html',
  host: {
    '[class.is-visible]': 'playback.activeTrack() !== null && playback.fullPlayerCount() === 0',
    '[class.is-collapsed]': 'collapsed()',
  },
})
export class GlobalMusicPlayer {
  protected readonly playback = inject(MusicPlaybackService);
  protected readonly collapsed = signal(false);

  protected readonly currentDuration = computed(() =>
    this.playback.activeTrack()?.previewDurationSeconds ?? 0,
  );

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }

  protected seek(event: Event): void {
    const element = event.target;
    if (element instanceof HTMLInputElement) {
      this.playback.seekTo(Number(element.value));
    }
  }

  protected formatTime(seconds: number): string {
    const value = Math.max(0, Math.floor(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  protected assetUrl(assetId: string): string {
    return `/api/assets/${assetId}`;
  }
}
