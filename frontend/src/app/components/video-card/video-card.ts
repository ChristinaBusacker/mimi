import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import type { YouTubeVideo } from '@shared/youtube/youtube-video';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'app-video-card',
  styleUrl: './video-card.scss',
  templateUrl: './video-card.html',
})
export class VideoCard {
  readonly video = input.required<YouTubeVideo>();

  protected readonly duration = computed(() =>
    this.formatDuration(this.video().durationSeconds),
  );

  private formatDuration(durationSeconds: number): string {
    const hours = Math.floor(durationSeconds / 3_600);
    const minutes = Math.floor((durationSeconds % 3_600) / 60);
    const seconds = durationSeconds % 60;

    if (hours > 0) {
      return [
        hours,
        String(minutes).padStart(2, '0'),
        String(seconds).padStart(2, '0'),
      ].join(':');
    }

    return [
      minutes,
      String(seconds).padStart(2, '0'),
    ].join(':');
  }
}
