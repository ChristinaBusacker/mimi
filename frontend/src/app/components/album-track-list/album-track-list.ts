import type { PageLocale } from '@shared/content/page-document';
import type { MusicTrackListItem } from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { MusicPlaybackService } from '../../core/music/music-playback.service';
import { Icon } from '../icon/icon';

/** One compact queue view for the Composer, live booklets and legacy album pages. */
@Component({
  selector: 'app-album-track-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, RouterLink, I18nPipe, Icon],
  templateUrl: './album-track-list.html',
  styleUrl: './album-track-list.scss',
})
export class AlbumTrackList {
  readonly tracks = input.required<readonly MusicTrackListItem[]>();
  readonly locale = input.required<PageLocale>();
  readonly albumTitle = input('');
  /** The studio is a faithful visual preview, not a second audio player. */
  readonly studio = input(false);

  protected readonly playback = inject(MusicPlaybackService);
  protected readonly activeTrackId = computed(() => this.playback.activeTrack()?.id ?? null);

  protected isPlaying(id: string): boolean {
    return this.activeTrackId() === id && this.playback.playing();
  }

  protected toggle(track: MusicTrackListItem): void {
    if (!this.studio() && track.previewAssetId) {
      void this.playback.toggleTrack(track, this.tracks());
    }
  }

  protected duration(seconds: number): string {
    const value = Math.max(0, Math.floor(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }
}
