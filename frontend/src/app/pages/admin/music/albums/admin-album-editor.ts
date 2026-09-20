import type { Asset } from '@shared/assets/asset';
import type {
  MusicAdminAlbum,
  SaveMusicAdminAlbum,
} from '@shared/music/music-admin';
import type { MusicPublicationStatus } from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';

import { Button } from '../../../../components/button/button';
import { I18nPipe } from '../../../../core/i18n/i18n.pipe';
import { AdminMusicService } from '../../../../core/music/admin-music.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    I18nPipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  selector: 'app-admin-album-editor',
  styleUrl: '../admin-music-editor.scss',
  templateUrl: './admin-album-editor.html',
})
export class AdminAlbumEditor implements OnInit {
  private readonly music = inject(AdminMusicService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly albumId =
    this.route.snapshot.paramMap.get('id');
  protected readonly images = signal<Asset[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly form = new FormGroup({
    slug: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        ),
      ],
    }),
    coverAssetId: new FormControl('', {
      nonNullable: true,
    }),
    releasedAt: new FormControl('', {
      nonNullable: true,
    }),
    status: new FormControl<MusicPublicationStatus>(
      'draft',
      {
        nonNullable: true,
      },
    ),
    titleDe: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    contentDe: new FormControl('', {
      nonNullable: true,
    }),
    titleEn: new FormControl('', {
      nonNullable: true,
    }),
    contentEn: new FormControl('', {
      nonNullable: true,
    }),
  });

  async ngOnInit(): Promise<void> {
    try {
      const result = await firstValueFrom(
        forkJoin({
          images: this.music.getAssets('image'),
          album: this.albumId
            ? this.music.getAlbum(this.albumId)
            : Promise.resolve(null),
        }),
      );

      this.images.set(result.images);

      if (result.album) {
        this.patchForm(result.album);
      }
    } catch {
      this.errorKey.set('admin.music.editor.loadFailed');
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();

      return;
    }

    const input = this.createInput();

    if (!input) {
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.errorKey.set(null);

    try {
      const album = await firstValueFrom(
        this.albumId
          ? this.music.updateAlbum(
              this.albumId,
              input,
            )
          : this.music.createAlbum(input),
      );

      this.saved.set(true);

      if (!this.albumId) {
        await this.router.navigate([
          '/admin/music/albums',
          album.id,
        ]);
      }
    } catch {
      this.errorKey.set('admin.music.editor.saveFailed');
    } finally {
      this.saving.set(false);
    }
  }

  private createInput(): SaveMusicAdminAlbum | null {
    const value = this.form.getRawValue();
    const englishTitle = value.titleEn.trim();
    const englishContent = value.contentEn.trim();

    if (englishContent && !englishTitle) {
      this.errorKey.set(
        'admin.music.editor.englishTitleRequired',
      );

      return null;
    }

    return {
      slug: value.slug.trim(),
      coverAssetId:
        value.coverAssetId || null,
      releasedAt:
        value.releasedAt || null,
      status: value.status,
      translations: {
        de: {
          title: value.titleDe.trim(),
          contentMarkdown: value.contentDe,
        },
        en:
          englishTitle || englishContent
            ? {
                title: englishTitle,
                contentMarkdown: value.contentEn,
              }
            : null,
      },
    };
  }

  private patchForm(album: MusicAdminAlbum): void {
    this.form.setValue({
      slug: album.slug,
      coverAssetId:
        album.coverAssetId ?? '',
      releasedAt:
        album.releasedAt ?? '',
      status: album.status,
      titleDe:
        album.translations.de.title,
      contentDe:
        album.translations.de.contentMarkdown,
      titleEn:
        album.translations.en?.title ?? '',
      contentEn:
        album.translations.en?.contentMarkdown ?? '',
    });
  }
}
