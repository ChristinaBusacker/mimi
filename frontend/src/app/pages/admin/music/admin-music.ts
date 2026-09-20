import type {
  MusicAdminAlbum,
  MusicAdminTrack,
} from '@shared/music/music-admin';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';

import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { AdminMusicService } from '../../../core/music/admin-music.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    I18nPipe,
    RouterLink,
  ],
  selector: 'app-admin-music',
  styleUrl: './admin-music.scss',
  templateUrl: './admin-music.html',
})
export class AdminMusic implements OnInit {
  private readonly music = inject(AdminMusicService);

  protected readonly albums = signal<MusicAdminAlbum[]>([]);
  protected readonly tracks = signal<MusicAdminTrack[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly confirmingAlbumId = signal<string | null>(null);
  protected readonly confirmingTrackId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected albumTitle(album: MusicAdminAlbum): string {
    return album.translations.de.title || album.slug;
  }

  protected trackTitle(track: MusicAdminTrack): string {
    return track.translations.de.title || track.slug;
  }

  protected async deleteAlbum(id: string): Promise<void> {
    try {
      await firstValueFrom(this.music.deleteAlbum(id));
      this.confirmingAlbumId.set(null);
      await this.reload();
    } catch {
      this.error.set(true);
    }
  }

  protected async deleteTrack(id: string): Promise<void> {
    try {
      await firstValueFrom(this.music.deleteTrack(id));
      this.confirmingTrackId.set(null);
      await this.reload();
    } catch {
      this.error.set(true);
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);

    try {
      const result = await firstValueFrom(
        forkJoin({
          albums: this.music.getAlbums(),
          tracks: this.music.getTracks(),
        }),
      );

      this.albums.set(result.albums);
      this.tracks.set(result.tracks);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
