import type { Asset } from '@shared/assets/asset';
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
  protected readonly images = signal<Asset[]>([]);
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
        }),
      );
      this.album.set(result.album);
      this.images.set(result.images);
      this.document.set(result.booklet.draft ?? result.booklet.published ?? emptyPage());
    } catch {
      this.notice.set('error');
    } finally {
      this.loading.set(false);
    }
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
