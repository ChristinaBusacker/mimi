import type {
  MusicTrack,
  MusicTrackListItem,
} from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
import { MusicPublicService } from '../../core/music/music-public.service';
import { Icon } from '../icon/icon';
import { RenderedContent } from '../rendered-content/rendered-content';
import { SupportButton } from '../support-button/support-button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    I18nPipe,
    Icon,
    RenderedContent,
    RouterLink,
    SupportButton,
  ],
  selector: 'app-music-library-player',
  styleUrl: './music-library-player.scss',
  templateUrl: './music-library-player.html',
})
export class MusicLibraryPlayer {
  private readonly music =
    inject(MusicPublicService);
  private readonly audio =
    viewChild<ElementRef<HTMLAudioElement>>(
      'audio',
    );

  readonly tracks =
    input.required<
      readonly MusicTrackListItem[]
    >();
  readonly locale =
    input.required<Language>();

  protected readonly activeTrackId =
    signal<string | null>(null);
  protected readonly storyTrackId =
    signal<string | null>(null);
  protected readonly playing =
    signal(false);
  protected readonly currentTime =
    signal(0);
  protected readonly volume =
    signal(0.8);
  protected readonly trackDetail =
    signal<MusicTrack | null>(null);
  protected readonly trackDetailLoading =
    signal(false);

  private detailRequestVersion = 0;

  protected readonly activeTrack =
    computed(
      () =>
        this.tracks().find(
          (track) =>
            track.id ===
            this.activeTrackId(),
        ) ?? null,
    );

  protected readonly storyTrack =
    computed(
      () =>
        this.tracks().find(
          (track) =>
            track.id ===
            this.storyTrackId(),
        ) ?? null,
    );

  protected readonly currentTrack =
    computed(
      () =>
        this.activeTrack() ??
        this.tracks().find(
          (track) =>
            track.previewAssetId !== null,
        ) ??
        this.tracks()[0] ??
        null,
    );

  protected readonly storyVisible =
    computed(
      () =>
        this.storyTrack()?.hasContent ??
        false,
    );

  private readonly detailEffect = effect(
    () => {
      const track = this.storyTrack();
      const locale = this.locale();
      const requestVersion =
        ++this.detailRequestVersion;

      this.trackDetail.set(null);
      this.trackDetailLoading.set(false);

      if (!track?.hasContent) {
        return;
      }

      this.trackDetailLoading.set(true);

      void this.loadTrackDetail(
        track,
        locale,
        requestVersion,
      );
    },
  );

  protected async toggleTrack(
    track: MusicTrackListItem,
  ): Promise<void> {
    if (!track.previewAssetId) {
      return;
    }

    const audio =
      this.audio()?.nativeElement;

    if (!audio) {
      return;
    }

    this.storyTrackId.set(
      track.hasContent
        ? track.id
        : null,
    );
    audio.volume = this.volume();

    if (
      this.activeTrackId() === track.id
    ) {
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

  protected async onTrackRowClick(
    track: MusicTrackListItem,
    event: MouseEvent,
  ): Promise<void> {
    const target = event.target;

    if (
      target instanceof Element &&
      target.closest('a, button, input')
    ) {
      return;
    }

    if (
      window.matchMedia(
        '(max-width: 900px)',
      ).matches &&
      track.previewAssetId
    ) {
      await this.toggleTrack(track);

      return;
    }

    if (track.hasContent) {
      this.storyTrackId.set(track.id);
    }
  }

  protected closeStory(): void {
    this.storyTrackId.set(null);
  }

  protected setVolume(event: Event): void {
    const target = event.target;

    if (
      !(target instanceof HTMLInputElement)
    ) {
      return;
    }

    const value = Number(target.value);

    if (!Number.isFinite(value)) {
      return;
    }

    const volume = Math.min(
      1,
      Math.max(0, value),
    );

    this.volume.set(volume);

    const audio =
      this.audio()?.nativeElement;

    if (audio) {
      audio.volume = volume;
    }
  }

  protected seek(event: Event): void {
    const target = event.target;
    const audio =
      this.audio()?.nativeElement;

    if (
      !(target instanceof HTMLInputElement) ||
      !audio
    ) {
      return;
    }

    const value = Number(
      target.value,
    );

    if (!Number.isFinite(value)) {
      return;
    }

    audio.currentTime = value;
    this.currentTime.set(value);
  }

  protected onTimeUpdate(
    event: Event,
  ): void {
    const target =
      event.currentTarget;

    if (
      !(target instanceof HTMLAudioElement)
    ) {
      return;
    }

    this.currentTime.set(
      target.currentTime,
    );
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
    track: MusicTrackListItem,
  ): boolean {
    return (
      this.activeTrackId() ===
        track.id &&
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
    const remainder =
      safeSeconds % 60;

    return `${minutes}:${remainder
      .toString()
      .padStart(2, '0')}`;
  }

  protected assetUrl(
    assetId: string,
  ): string {
    return `/api/assets/${assetId}`;
  }

  protected coverAssetId(
    track: MusicTrackListItem,
  ): string | null {
    return (
      track.coverAssetId ??
      track.album?.coverAssetId ??
      null
    );
  }

  private async loadTrackDetail(
    track: MusicTrackListItem,
    locale: Language,
    requestVersion: number,
  ): Promise<void> {
    try {
      const detail =
        await firstValueFrom(
          this.music.getTrack(
            track.slug,
            locale,
          ),
        );

      if (
        requestVersion !==
        this.detailRequestVersion
      ) {
        return;
      }

      this.trackDetail.set(detail);
    } catch {
      if (
        requestVersion ===
        this.detailRequestVersion
      ) {
        this.trackDetail.set(null);
      }
    } finally {
      if (
        requestVersion ===
        this.detailRequestVersion
      ) {
        this.trackDetailLoading.set(
          false,
        );
      }
    }
  }

}
