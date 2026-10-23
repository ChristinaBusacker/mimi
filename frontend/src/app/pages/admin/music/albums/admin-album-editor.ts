import type { Asset } from '@shared/assets/asset';
import type { MusicAlbumCredit } from '@shared/music/music';
import type {
  MusicAdminAlbum,
  MusicAdminTrack,
  SaveMusicAdminAlbum,
  SaveMusicAdminTrack,
} from '@shared/music/music-admin';
import type { MusicPublicationStatus } from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
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

import { AssetPicker } from '../../../../components/asset-picker/asset-picker';
import { Button } from '../../../../components/button/button';
import { MarkdownEditor } from '../../../../components/markdown-editor/markdown-editor';
import { AdminAssetsService } from '../../../../core/assets/admin-assets.service';
import { I18nPipe } from '../../../../core/i18n/i18n.pipe';
import { AdminMusicService } from '../../../../core/music/admin-music.service';
import { formatAlbumTags, parseAlbumTags } from './album-tags';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    AssetPicker,
    Button,
    I18nPipe,
    MarkdownEditor,
    ReactiveFormsModule,
    RouterLink,
  ],
  selector: 'app-admin-album-editor',
  styleUrl: '../admin-music-editor.scss',
  templateUrl: './admin-album-editor.html',
})
export class AdminAlbumEditor implements OnInit {
  private readonly music = inject(AdminMusicService);
  private readonly assets = inject(AdminAssetsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly albumId =
    this.route.snapshot.paramMap.get('id');
  protected readonly images = signal<Asset[]>([]);
  protected readonly tracks = signal<MusicAdminTrack[]>([]);
  protected readonly credits = signal<MusicAlbumCredit[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly trackUploading = signal(false);
  protected readonly trackUploadCurrent = signal(0);
  protected readonly trackUploadTotal = signal(0);
  protected readonly trackDropActive = signal(false);
  protected readonly trackOrderSaving = signal(false);
  protected readonly trackErrorKey = signal<string | null>(null);
  protected readonly trackMessageKey = signal<string | null>(null);
  protected readonly publishingTracks = signal(false);
  protected readonly unpublishedTrackCount = computed(
    () =>
      this.tracks().filter(
        (track) => track.status !== 'published',
      ).length,
  );

  private readonly knownTrackSlugs = new Set<string>();
  private draggedTrackId: string | null = null;
  private fileDragDepth = 0;

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
    heroAssetId: new FormControl('', {
      nonNullable: true,
    }),
    releasedAt: new FormControl('', {
      nonNullable: true,
    }),
    genreDe: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    genreEn: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    moodDe: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    moodEn: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    spotifyUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500), Validators.pattern(/^https:\/\/\S+$/)] }),
    deezerUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500), Validators.pattern(/^https:\/\/\S+$/)] }),
    supportUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500), Validators.pattern(/^(?:https:\/\/\S+|\/(?!\/)\S+)$/)] }),
    tagsDe: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(800)] }),
    tagsEn: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(800)] }),
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
          images: this.assets.getAll('image'),
          tracks: this.albumId
            ? this.music.getTracks()
            : Promise.resolve([]),
          album: this.albumId
            ? this.music.getAlbum(this.albumId)
            : Promise.resolve(null),
        }),
      );

      this.images.set(result.images);

      for (const track of result.tracks) {
        this.knownTrackSlugs.add(track.slug);
      }

      if (this.albumId) {
        this.tracks.set(
          this.sortAlbumTracks(
            result.tracks.filter(
              (track) =>
                track.albumId === this.albumId,
            ),
          ),
        );
      }

      if (result.album) {
        this.patchForm(result.album);
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

  protected removeImage(assetId: string): void {
    this.images.update(
      (images) =>
        images.filter(
          (asset) =>
            asset.id !== assetId,
        ),
    );
  }

  protected formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  }

  protected async handleTrackFilesInput(
    event: Event,
  ): Promise<void> {
    const target = event.target;

    if (
      !(target instanceof HTMLInputElement) ||
      !target.files?.length
    ) {
      return;
    }

    await this.createTracksFromFiles(
      Array.from(target.files),
    );

    target.value = '';
  }

  protected onTrackFilesDragEnter(
    event: DragEvent,
  ): void {
    if (!this.hasFiles(event)) {
      return;
    }

    event.preventDefault();
    this.fileDragDepth += 1;
    this.trackDropActive.set(true);
  }

  protected onTrackFilesDragOver(
    event: DragEvent,
  ): void {
    if (!this.hasFiles(event)) {
      return;
    }

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  protected onTrackFilesDragLeave(
    event: DragEvent,
  ): void {
    if (!this.hasFiles(event)) {
      return;
    }

    event.preventDefault();
    this.fileDragDepth = Math.max(
      0,
      this.fileDragDepth - 1,
    );

    if (this.fileDragDepth === 0) {
      this.trackDropActive.set(false);
    }
  }

  protected async onTrackFilesDrop(
    event: DragEvent,
  ): Promise<void> {
    if (!this.hasFiles(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.fileDragDepth = 0;
    this.trackDropActive.set(false);

    const files = event.dataTransfer?.files;

    if (!files?.length) {
      return;
    }

    await this.createTracksFromFiles(
      Array.from(files),
    );
  }

  protected startTrackDrag(
    trackId: string,
    event: DragEvent,
  ): void {
    this.draggedTrackId = trackId;

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(
        'text/plain',
        trackId,
      );
    }
  }

  protected allowTrackDrop(event: DragEvent): void {
    if (this.hasFiles(event)) {
      return;
    }

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  protected async dropTrack(
    event: DragEvent,
    targetIndex: number,
  ): Promise<void> {
    if (this.hasFiles(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const trackId =
      this.draggedTrackId ??
      event.dataTransfer?.getData('text/plain');

    if (!trackId) {
      return;
    }

    const current = this.tracks().slice();
    const sourceIndex = current.findIndex(
      (track) => track.id === trackId,
    );

    if (
      sourceIndex < 0 ||
      sourceIndex === targetIndex
    ) {
      return;
    }

    const [movedTrack] = current.splice(
      sourceIndex,
      1,
    );

    current.splice(
      targetIndex,
      0,
      movedTrack,
    );

    const reordered = current.map(
      (track, index) => ({
        ...track,
        trackNumber: index + 1,
      }),
    );

    this.tracks.set(reordered);
    await this.saveTrackOrder(reordered);
  }

  protected endTrackDrag(): void {
    this.draggedTrackId = null;
  }

  protected async publishAllTracks(): Promise<void> {
    if (
      !this.albumId ||
      this.publishingTracks() ||
      this.unpublishedTrackCount() === 0
    ) {
      return;
    }

    this.publishingTracks.set(true);
    this.trackErrorKey.set(null);
    this.trackMessageKey.set(null);

    try {
      const tracks = await firstValueFrom(
        this.music.publishAlbumTracks(
          this.albumId,
        ),
      );

      this.tracks.set(
        this.sortAlbumTracks(tracks),
      );
      this.trackMessageKey.set(
        'admin.music.albumTracks.publishedAll',
      );
    } catch {
      this.trackErrorKey.set(
        'admin.music.albumTracks.publishAllFailed',
      );
    } finally {
      this.publishingTracks.set(false);
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

  private async createTracksFromFiles(
    files: File[],
  ): Promise<void> {
    if (
      !this.albumId ||
      this.trackUploading() ||
      files.length === 0
    ) {
      return;
    }

    this.trackUploading.set(true);
    this.trackUploadCurrent.set(0);
    this.trackUploadTotal.set(files.length);
    this.trackErrorKey.set(null);

    const createdTracks: MusicAdminTrack[] = [];
    let nextTrackNumber =
      this.tracks().reduce(
        (highest, track) =>
          Math.max(
            highest,
            track.trackNumber ?? 0,
          ),
        0,
      ) + 1;
    let failed = false;

    for (
      let index = 0;
      index < files.length;
      index += 1
    ) {
      const file = files[index];

      this.trackUploadCurrent.set(index + 1);

      try {
        const asset = await firstValueFrom(
          this.assets.upload(file),
        );

        if (asset.type !== 'audio') {
          throw new Error(
            'Uploaded asset is not audio.',
          );
        }

        const duration =
          await this.assets.readAudioDuration(asset);
        const title = this.titleFromFilename(
          file.name,
        );
        const input: SaveMusicAdminTrack = {
          slug: this.createUniqueTrackSlug(title),
          albumId: this.albumId,
          trackNumber: nextTrackNumber,
          durationSeconds: duration,
          previewDurationSeconds: duration,
          previewAssetId: asset.id,
          coverAssetId: null,
          spotifyUrl: null,
          deezerUrl: null,
          supportUrl: null,
          status: 'draft',
          translations: {
            de: {
              title,
              contentMarkdown: '',
            },
            en: null,
          },
        };

        const track = await firstValueFrom(
          this.music.createTrack(input),
        );

        this.knownTrackSlugs.add(track.slug);
        createdTracks.push(track);
        nextTrackNumber += 1;
      } catch {
        failed = true;
      }
    }

    if (createdTracks.length > 0) {
      this.tracks.update(
        (tracks) =>
          this.sortAlbumTracks([
            ...tracks,
            ...createdTracks,
          ]),
      );
    }

    if (failed) {
      this.trackErrorKey.set(
        'admin.music.albumTracks.uploadPartialFailure',
      );
    }

    this.trackUploading.set(false);
    this.trackUploadCurrent.set(0);
    this.trackUploadTotal.set(0);
  }

  private async saveTrackOrder(
    tracks: MusicAdminTrack[],
  ): Promise<void> {
    if (!this.albumId) {
      return;
    }

    this.trackOrderSaving.set(true);
    this.trackErrorKey.set(null);

    try {
      const saved = await firstValueFrom(
        this.music.reorderAlbumTracks(
          this.albumId,
          tracks.map((track) => track.id),
        ),
      );

      this.tracks.set(saved);
    } catch {
      this.trackErrorKey.set(
        'admin.music.albumTracks.reorderFailed',
      );

      await this.reloadAlbumTracks();
    } finally {
      this.trackOrderSaving.set(false);
      this.draggedTrackId = null;
    }
  }

  private async reloadAlbumTracks(): Promise<void> {
    if (!this.albumId) {
      return;
    }

    try {
      const tracks = await firstValueFrom(
        this.music.getTracks(),
      );

      this.tracks.set(
        this.sortAlbumTracks(
          tracks.filter(
            (track) =>
              track.albumId === this.albumId,
          ),
        ),
      );
    } catch {
      this.trackErrorKey.set(
        'admin.music.albumTracks.loadFailed',
      );
    }
  }

  private createInput(): SaveMusicAdminAlbum | null {
    const value = this.form.getRawValue();
    const englishTitle = value.titleEn.trim();
    const englishContent = value.contentEn.trim();
    const credits = this.credits()
      .map((credit) => ({
        name: credit.name.trim(),
        role: { de: credit.role.de.trim(), en: credit.role.en.trim() },
      }))
      .filter((credit) => credit.name || credit.role.de || credit.role.en);

    if (credits.some((credit) => !credit.name)) {
      this.errorKey.set('admin.music.editorial.creditNameRequired');
      return null;
    }

    const tagsDe = parseAlbumTags(value.tagsDe);
    const tagsEn = parseAlbumTags(value.tagsEn);
    if (!tagsDe || !tagsEn) {
      this.errorKey.set('admin.music.albumMeta.tagsInvalid');
      return null;
    }

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
      editorial: {
        heroAssetId: value.heroAssetId || null,
        genre: { de: value.genreDe.trim(), en: value.genreEn.trim() },
        mood: { de: value.moodDe.trim(), en: value.moodEn.trim() },
        spotifyUrl: value.spotifyUrl.trim() || null,
        deezerUrl: value.deezerUrl.trim() || null,
        supportUrl: value.supportUrl.trim() || null,
        tags: { de: tagsDe, en: tagsEn },
        credits,
      },
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
    this.credits.set(album.editorial.credits.map((credit) => ({
      name: credit.name,
      role: { ...credit.role },
    })));
    this.form.setValue({
      slug: album.slug,
      coverAssetId:
        album.coverAssetId ?? '',
      heroAssetId: album.editorial.heroAssetId ?? '',
      releasedAt:
        album.releasedAt ?? '',
      genreDe: album.editorial.genre.de,
      genreEn: album.editorial.genre.en,
      moodDe: album.editorial.mood.de,
      moodEn: album.editorial.mood.en,
      spotifyUrl: album.editorial.spotifyUrl ?? '',
      deezerUrl: album.editorial.deezerUrl ?? '',
      supportUrl: album.editorial.supportUrl ?? '',
      tagsDe: formatAlbumTags(album.editorial.tags?.de ?? []),
      tagsEn: formatAlbumTags(album.editorial.tags?.en ?? []),
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

  protected addAlbumCredit(): void {
    if (this.credits().length >= 40) return;
    this.credits.update((current) => [...current, { name: '', role: { de: '', en: '' } }]);
  }

  protected removeAlbumCredit(index: number): void {
    this.credits.update((current) => current.filter((_, position) => position !== index));
  }

  protected updateAlbumCredit(index: number, field: 'name' | 'de' | 'en', event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const value = target.value;
    this.credits.update((current) => current.map((credit, position) => {
      if (position !== index) return credit;
      return field === 'name'
        ? { ...credit, name: value }
        : { ...credit, role: { ...credit.role, [field]: value } };
    }));
  }

  private titleFromFilename(filename: string): string {
    const withoutExtension = filename.replace(
      /\.[^.]+$/,
      '',
    );

    return (
      withoutExtension.trim() ||
      filename.trim() ||
      'Track'
    ).slice(0, 255);
  }

  private createUniqueTrackSlug(title: string): string {
    const albumSlug =
      this.form.controls.slug.value.trim() ||
      'album';
    const normalized = `${albumSlug}-${title}`
      .replace(/ß/g, 'ss')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const base = (
      normalized ||
      `${albumSlug}-track`
    ).slice(0, 160);

    let candidate = base;
    let suffix = 2;

    while (this.knownTrackSlugs.has(candidate)) {
      const ending = `-${suffix}`;
      const availableLength =
        160 - ending.length;

      candidate =
        `${base.slice(0, availableLength)}${ending}`;
      suffix += 1;
    }

    this.knownTrackSlugs.add(candidate);

    return candidate;
  }

  private sortAlbumTracks(
    tracks: MusicAdminTrack[],
  ): MusicAdminTrack[] {
    return tracks
      .slice()
      .sort((left, right) => {
        const leftNumber =
          left.trackNumber ??
          Number.MAX_SAFE_INTEGER;
        const rightNumber =
          right.trackNumber ??
          Number.MAX_SAFE_INTEGER;

        if (leftNumber !== rightNumber) {
          return leftNumber - rightNumber;
        }

        return left.createdAt.localeCompare(
          right.createdAt,
        );
      });
  }

  private hasFiles(event: DragEvent): boolean {
    return (
      event.dataTransfer?.types.includes(
        'Files',
      ) ?? false
    );
  }
}
