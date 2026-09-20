import type { Asset } from '@shared/assets/asset';
import type {
  MusicAdminAlbum,
  MusicAdminTrack,
  SaveMusicAdminTrack,
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
import { MarkdownEditor } from '../../../../components/markdown-editor/markdown-editor';
import { AdminAssetsService } from '../../../../core/assets/admin-assets.service';
import { I18nPipe } from '../../../../core/i18n/i18n.pipe';
import { AdminMusicService } from '../../../../core/music/admin-music.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    I18nPipe,
    MarkdownEditor,
    ReactiveFormsModule,
    RouterLink,
  ],
  selector: 'app-admin-track-editor',
  styleUrl: '../admin-music-editor.scss',
  templateUrl: './admin-track-editor.html',
})
export class AdminTrackEditor implements OnInit {
  private readonly music = inject(AdminMusicService);
  private readonly assets = inject(AdminAssetsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly trackId =
    this.route.snapshot.paramMap.get('id');
  protected readonly albums = signal<MusicAdminAlbum[]>([]);
  protected readonly images = signal<Asset[]>([]);
  protected readonly audio = signal<Asset[]>([]);
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
    albumId: new FormControl('', {
      nonNullable: true,
    }),
    trackNumber: new FormControl<number | null>(null),
    durationSeconds: new FormControl<number>(1, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(1),
      ],
    }),
    previewDurationSeconds: new FormControl<number>(1, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(1),
      ],
    }),
    previewAssetId: new FormControl('', {
      nonNullable: true,
    }),
    coverAssetId: new FormControl('', {
      nonNullable: true,
    }),
    spotifyUrl: new FormControl('', {
      nonNullable: true,
    }),
    deezerUrl: new FormControl('', {
      nonNullable: true,
    }),
    supportUrl: new FormControl('', {
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
          albums: this.music.getAlbums(),
          images: this.assets.getAll('image'),
          audio: this.assets.getAll('audio'),
          track: this.trackId
            ? this.music.getTrack(this.trackId)
            : Promise.resolve(null),
        }),
      );

      this.albums.set(result.albums);
      this.images.set(result.images);
      this.audio.set(result.audio);

      if (result.track) {
        this.patchForm(result.track);
      }
    } catch {
      this.errorKey.set('admin.music.editor.loadFailed');
    } finally {
      this.loading.set(false);
    }
  }

  protected addImage(asset: Asset): void {
    this.images.update(
      (images) => [
        asset,
        ...images.filter(
          (candidate) =>
            candidate.id !== asset.id,
        ),
      ],
    );
  }

  protected albumTitle(album: MusicAdminAlbum): string {
    return album.translations.de.title || album.slug;
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
      const track = await firstValueFrom(
        this.trackId
          ? this.music.updateTrack(
              this.trackId,
              input,
            )
          : this.music.createTrack(input),
      );

      this.saved.set(true);

      if (!this.trackId) {
        await this.router.navigate([
          '/admin/music/tracks',
          track.id,
        ]);
      }
    } catch {
      this.errorKey.set('admin.music.editor.saveFailed');
    } finally {
      this.saving.set(false);
    }
  }

  private createInput(): SaveMusicAdminTrack | null {
    const value = this.form.getRawValue();
    const englishTitle = value.titleEn.trim();
    const englishContent = value.contentEn.trim();

    if (englishContent && !englishTitle) {
      this.errorKey.set(
        'admin.music.editor.englishTitleRequired',
      );

      return null;
    }

    if (
      value.previewDurationSeconds >
      value.durationSeconds
    ) {
      this.errorKey.set(
        'admin.music.editor.previewTooLong',
      );

      return null;
    }

    return {
      slug: value.slug.trim(),
      albumId: value.albumId || null,
      trackNumber: value.trackNumber,
      durationSeconds: value.durationSeconds,
      previewDurationSeconds:
        value.previewDurationSeconds,
      previewAssetId:
        value.previewAssetId || null,
      coverAssetId:
        value.coverAssetId || null,
      spotifyUrl:
        this.optionalText(value.spotifyUrl),
      deezerUrl:
        this.optionalText(value.deezerUrl),
      supportUrl:
        this.optionalText(value.supportUrl),
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

  private patchForm(track: MusicAdminTrack): void {
    this.form.setValue({
      slug: track.slug,
      albumId: track.albumId ?? '',
      trackNumber: track.trackNumber,
      durationSeconds: track.durationSeconds,
      previewDurationSeconds:
        track.previewDurationSeconds,
      previewAssetId:
        track.previewAssetId ?? '',
      coverAssetId:
        track.coverAssetId ?? '',
      spotifyUrl: track.spotifyUrl ?? '',
      deezerUrl: track.deezerUrl ?? '',
      supportUrl: track.supportUrl ?? '',
      status: track.status,
      titleDe:
        track.translations.de.title,
      contentDe:
        track.translations.de.contentMarkdown,
      titleEn:
        track.translations.en?.title ?? '',
      contentEn:
        track.translations.en?.contentMarkdown ?? '',
    });
  }

  private optionalText(value: string): string | null {
    const trimmed = value.trim();

    return trimmed || null;
  }
}
