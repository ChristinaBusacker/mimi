import type { Asset } from '@shared/assets/asset';
import type { AlbumBookletContext } from '@shared/content/album-booklet-context';
import type { MusicAdminTrack } from '@shared/music/music-admin';
import type { MusicTrackListItem } from '@shared/music/music';
import type { PageDocument } from '@shared/content/page-document';
import type { MusicAdminAlbum } from '@shared/music/music-admin';
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { PageEditor } from '../../../../../components/page-composer/page-editor';
import { AdminAssetsService } from '../../../../../core/assets/admin-assets.service';
import { I18nPipe } from '../../../../../core/i18n/i18n.pipe';
import { AdminMusicService } from '../../../../../core/music/admin-music.service';

const emptyPage = (): PageDocument => ({
  id: 'page',
  styles: { background: 'none', gap: 16, padding: 0, radius: 0, align: 'left' },
  schemaVersion: 1,
  sections: [],
});

@Component({
  selector: 'app-admin-album-booklet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, PageEditor, RouterLink],
  templateUrl: './admin-album-booklet.html',
  styleUrl: './admin-album-booklet.scss',
})
export class AdminAlbumBooklet implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly music = inject(AdminMusicService);
  private readonly assetsService = inject(AdminAssetsService);
  protected readonly albumId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly album = signal<MusicAdminAlbum | null>(null);
  protected readonly albumTracks = signal<MusicAdminTrack[]>([]);
  protected readonly images = signal<Asset[]>([]);
  protected albumContext(): AlbumBookletContext | null {
    const album = this.album();
    if (!album) return null;
    const reference = {
      id: album.id, slug: album.slug, title: album.translations.de.title,
      coverAssetId: album.coverAssetId,
    };
    const tracks: MusicTrackListItem[] = this.albumTracks()
      .filter((track) => track.albumId === album.id && track.status === 'published')
      .sort((left, right) => (left.trackNumber ?? 99999) - (right.trackNumber ?? 99999))
      .map((track) => ({
        id: track.id, slug: track.slug,
        title: track.translations.de.title,
        trackNumber: track.trackNumber,
        durationSeconds: track.durationSeconds,
        previewDurationSeconds: track.previewDurationSeconds,
        previewAssetId: track.previewAssetId,
        coverAssetId: track.coverAssetId,
        spotifyUrl: track.spotifyUrl,
        deezerUrl: track.deezerUrl,
        supportUrl: track.supportUrl,
        hasContent: Boolean(track.translations.de.contentMarkdown.trim()),
        album: reference,
      }));
    return {
      title: album.translations.de.title,
      coverAssetId: album.coverAssetId,
      releasedAt: album.releasedAt,
      editorial: album.editorial,
      tracks,
    };
  }
  protected readonly document = signal<PageDocument>(emptyPage());
  protected readonly loading = signal(true);
  protected readonly working = signal(false);
  protected readonly dirty = signal(false);
  protected readonly notice = signal<'saved' | 'published' | 'error' | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const result = await firstValueFrom(
        forkJoin({
          album: this.music.getAlbum(this.albumId),
          booklet: this.music.getBooklet(this.albumId),
          images: this.assetsService.getAll('image'),
          tracks: this.music.getTracks(),
        }),
      );
      this.album.set(result.album);
      this.albumTracks.set(result.tracks);
      this.images.set(result.images);
      this.document.set(result.booklet.draft ?? result.booklet.published ?? emptyPage());
    } catch {
      this.notice.set('error');
    } finally {
      this.loading.set(false);
    }
  }

  protected async reloadImportedDraft(): Promise<void> {
    this.working.set(true);
    try {
      const [booklet, images] = await firstValueFrom(forkJoin([
        this.music.getBooklet(this.albumId), this.assetsService.getAll('image'),
      ]));
      if (booklet.draft) {
        this.document.set(structuredClone(booklet.draft));
        this.images.set(images);
        this.dirty.set(false);
        this.notice.set('saved');
      }
    } catch { this.notice.set('error'); }
    finally { this.working.set(false); }
  }

  protected updateDocument(next: PageDocument): void {
    this.document.set(next);
    this.dirty.set(true);
    this.notice.set(null);
  }

  protected async save(publish = false): Promise<void> {
    if (this.working()) return;
    this.working.set(true);
    this.notice.set(null);
    try {
      await firstValueFrom(this.music.saveBookletDraft(this.albumId, this.document()));
      if (publish) await firstValueFrom(this.music.publishBooklet(this.albumId));
      this.dirty.set(false);
      this.notice.set(publish ? 'published' : 'saved');
    } catch {
      this.notice.set('error');
    } finally {
      this.working.set(false);
    }
  }
}
