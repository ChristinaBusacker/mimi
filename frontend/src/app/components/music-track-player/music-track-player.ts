import type { MusicTrackSummary } from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { Icon } from '../icon/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    I18nPipe,
    Icon,
  ],
  selector: 'app-music-track-player',
  styleUrl: './music-track-player.scss',
  templateUrl: './music-track-player.html',
})
export class MusicTrackPlayer {
  readonly tracks =
    input.required<readonly MusicTrackSummary[]>();

  private readonly audio =
    viewChild<ElementRef<HTMLAudioElement>>('audio');

  protected readonly activeTrackId =
    signal<string | null>(null);
  protected readonly playing = signal(false);
  protected readonly currentTime = signal(0);

  protected readonly activeTrack = computed(
    () =>
      this.tracks().find(
        (track) =>
          track.id === this.activeTrackId(),
      ) ?? null,
  );

  protected async toggleTrack(
    track: MusicTrackSummary,
  ): Promise<void> {
    if (!track.previewAssetId) {
      return;
    }

    const audio = this.audio()?.nativeElement;

    if (!audio) {
      return;
    }

    if (this.activeTrackId() === track.id) {
      if (audio.paused) {
        await audio.play().catch(
          () => undefined,
        );
      } else {
        audio.pause();
      }

      return;
    }

    this.activeTrackId.set(track.id);
    this.currentTime.set(0);
    this.playing.set(false);

    audio.src = this.assetUrl(
      track.previewAssetId,
    );
    audio.currentTime = 0;
    audio.load();

    await audio.play().catch(() => {
      this.playing.set(false);
    });
  }

  protected seek(event: Event): void {
    const target = event.target;
    const audio = this.audio()?.nativeElement;

    if (
      !(target instanceof HTMLInputElement) ||
      !audio
    ) {
      return;
    }

    const value = Number(target.value);

    if (!Number.isFinite(value)) {
      return;
    }

    audio.currentTime = value;
    this.currentTime.set(value);
  }

  protected onTimeUpdate(event: Event): void {
    const target = event.currentTarget;

    if (!(target instanceof HTMLAudioElement)) {
      return;
    }

    this.currentTime.set(target.currentTime);
  }

  protected onPlay(): void {
    this.playing.set(true);
  }

  protected onPause(): void {
    this.playing.set(false);
  }

  protected onEnded(): void {
    this.playing.set(false);
    this.currentTime.set(0);
  }

  protected isTrackPlaying(
    track: MusicTrackSummary,
  ): boolean {
    return (
      this.activeTrackId() === track.id &&
      this.playing()
    );
  }

  protected formatDuration(
    seconds: number,
  ): string {
    const safeSeconds = Math.max(
      0,
      Math.floor(seconds),
    );
    const minutes = Math.floor(
      safeSeconds / 60,
    );
    const remainder = safeSeconds % 60;

    return `${minutes}:${remainder
      .toString()
      .padStart(2, '0')}`;
  }

  protected assetUrl(
    assetId: string,
  ): string {
    return `/api/assets/${assetId}`;
  }
}
