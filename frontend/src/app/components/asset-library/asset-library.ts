import type { Asset, AssetFolder, AssetType } from '@shared/assets/asset';

import { AsyncPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AdminAssetsService } from '../../core/assets/admin-assets.service';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { Button } from '../button/button';
import { ImageEditor } from '../image-editor/image-editor';

type AssetSort = 'newest' | 'oldest' | 'nameAsc' | 'nameDesc';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, I18nPipe, Button, ImageEditor],
  selector: 'app-asset-library',
  styleUrl: './asset-library.scss',
  templateUrl: './asset-library.html',
})
export class AssetLibrary implements OnInit {
  private readonly assetsService = inject(AdminAssetsService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly type = input.required<AssetType>();
  readonly embedded = input(false);
  readonly assets = input<readonly Asset[]>([]);
  readonly selectedId = input<string | null>('');

  readonly assetSelected = output<Asset>();
  readonly assetUploaded = output<Asset>();
  readonly assetUpdated = output<Asset>();
  readonly assetDeleted = output<string>();
  readonly closed = output<void>();

  private readonly loadedAssets = signal<Asset[]>([]);
  private readonly deletedIds = signal<ReadonlySet<string>>(new Set<string>());
  private dragDepth = 0;

  protected readonly search = signal('');
  protected readonly folders = signal<AssetFolder[]>([]);
  protected readonly folderId = signal<string | null>(null);
  protected readonly folderName = signal('');
  protected readonly folderBusy = signal(false);
  protected readonly childFolders = computed(() =>
    this.folders().filter((folder) => folder.parentId === this.folderId()),
  );
  protected readonly currentFolder = computed(
    () => this.folders().find((folder) => folder.id === this.folderId()) ?? null,
  );
  protected readonly focusedId = signal<string | null>(null);
  protected readonly editingAsset = signal<Asset | null>(null);
  readonly decorative = input(false);
  protected readonly incompleteOnly = signal(false);
  protected readonly sort = signal<AssetSort>('newest');
  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);
  protected readonly dragActive = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly savingDescriptionsId = signal<string | null>(null);
  protected readonly confirmingDeleteId = signal<string | null>(null);
  protected readonly descriptionDrafts = signal<Record<string, { de: string; en: string }>>({});
  protected readonly errorKey = signal<string | null>(null);

  protected readonly availableAssets = computed(() => {
    const byId = new Map<string, Asset>();
    const deletedIds = this.deletedIds();

    for (const asset of [...this.assets(), ...this.loadedAssets()]) {
      if (asset.type === this.type() && !deletedIds.has(asset.id)) {
        byId.set(asset.id, asset);
      }
    }

    return [...byId.values()];
  });

  protected readonly filteredAssets = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();

    const assets = this.availableAssets()
      .filter((asset) => asset.folderId === this.folderId())
      .filter((asset) => !this.incompleteOnly())
      .filter(
        (asset) =>
          !query ||
          [asset.originalFilename, asset.descriptionDe ?? '', asset.descriptionEn ?? ''].some(
            (value) => value.toLocaleLowerCase().includes(query),
          ),
      )
      .slice();

    switch (this.sort()) {
      case 'oldest':
        return assets.sort((left, right) => this.createdAt(left) - this.createdAt(right));
      case 'nameAsc':
        return assets.sort((left, right) =>
          left.originalFilename.localeCompare(right.originalFilename),
        );
      case 'nameDesc':
        return assets.sort((left, right) =>
          right.originalFilename.localeCompare(left.originalFilename),
        );
      case 'newest':
      default:
        return assets.sort((left, right) => this.createdAt(right) - this.createdAt(left));
    }
  });

  ngOnInit(): void {
    if (this.embedded()) {
      void this.reload();
    }
  }

  async open(): Promise<void> {
    this.errorKey.set(null);
    this.confirmingDeleteId.set(null);
    this.focusedId.set(null);
    this.incompleteOnly.set(false);
    if (!this.embedded()) {
      this.dialog()?.nativeElement.showModal();
    }

    await this.reload();
  }

  protected close(): void {
    if (!this.embedded()) {
      this.dialog()?.nativeElement.close();
    }
  }

  protected onClosed(): void {
    this.dragDepth = 0;
    this.dragActive.set(false);
    this.confirmingDeleteId.set(null);
    this.errorKey.set(null);
    this.closed.emit();
  }

  protected setSearch(event: Event): void {
    this.search.set(this.readControlValue(event));
  }

  protected setSort(event: Event): void {
    const value = this.readControlValue(event);

    if (value === 'newest' || value === 'oldest' || value === 'nameAsc' || value === 'nameDesc') {
      this.sort.set(value);
    }
  }

  protected changeFolder(id: string | null): void {
    this.folderId.set(id);
    this.focusedId.set(null);
    this.confirmingDeleteId.set(null);
    this.errorKey.set(null);
  }

  protected goToParent(): void {
    this.changeFolder(this.currentFolder()?.parentId ?? null);
  }

  protected setFolderName(event: Event): void {
    this.folderName.set(this.readControlValue(event));
  }

  protected async createFolder(): Promise<void> {
    const name = this.folderName().trim();
    if (!name || this.folderBusy()) {
      return;
    }
    this.folderBusy.set(true);
    this.errorKey.set(null);
    try {
      const folder = await firstValueFrom(this.assetsService.createFolder(name, this.folderId()));
      this.folders.update((folders) => [...folders, folder]);
      this.folderName.set('');
    } catch {
      this.errorKey.set('admin.media.folderCreateFailed');
    } finally {
      this.folderBusy.set(false);
    }
  }

  protected async deleteCurrentFolder(): Promise<void> {
    const folder = this.currentFolder();
    if (!folder || this.folderBusy()) {
      return;
    }
    this.folderBusy.set(true);
    this.errorKey.set(null);
    try {
      await firstValueFrom(this.assetsService.deleteFolder(folder.id));
      this.folders.update((folders) => folders.filter((item) => item.id !== folder.id));
      this.changeFolder(folder.parentId);
    } catch {
      this.errorKey.set('admin.media.folderDeleteFailed');
    } finally {
      this.folderBusy.set(false);
    }
  }

  protected async moveAsset(asset: Asset, event: Event): Promise<void> {
    const id = this.readControlValue(event) || null;
    if (id === asset.folderId) {
      return;
    }
    this.errorKey.set(null);
    try {
      const updated = await firstValueFrom(this.assetsService.moveAsset(asset.id, id));
      this.loadedAssets.update((assets) => [
        updated,
        ...assets.filter((item) => item.id !== updated.id),
      ]);
      this.assetUpdated.emit(updated);
    } catch {
      this.errorKey.set('admin.media.moveFailed');
    }
  }

  protected select(asset: Asset): void {
    if (asset.type === 'image' && !this.decorative() && !this.hasCompleteDescriptions(asset)) {
      this.errorKey.set('admin.assetPicker.descriptionsRequired');
      return;
    }

    this.assetSelected.emit(asset);
    this.close();
  }

  protected openEditor(asset: Asset): void {
    this.editingAsset.set(asset);
  }

  protected closeEditor(): void {
    this.editingAsset.set(null);
  }

  protected editorSaved(asset: Asset): void {
    this.loadedAssets.update((assets) => [asset, ...assets.filter((candidate) => candidate.id !== asset.id)]);
    this.assetUpdated.emit(asset);
    this.editingAsset.set(null);
  }

  protected toggleDetails(id: string): void {
    this.focusedId.update((current) => (current === id ? null : id));
  }

  protected toggleIncomplete(): void {
    this.incompleteOnly.update((value) => !value);
  }

  protected descriptionValue(asset: Asset, locale: 'de' | 'en'): string {
    const draft = this.descriptionDrafts()[asset.id];

    if (draft) {
      return draft[locale];
    }

    return locale === 'de' ? (asset.descriptionDe ?? '') : (asset.descriptionEn ?? '');
  }

  protected setDescription(asset: Asset, locale: 'de' | 'en', event: Event): void {
    const value = this.readControlValue(event);

    this.descriptionDrafts.update((drafts) => {
      const current = drafts[asset.id] ?? {
        de: asset.descriptionDe ?? '',
        en: asset.descriptionEn ?? '',
      };

      return {
        ...drafts,
        [asset.id]: {
          ...current,
          [locale]: value,
        },
      };
    });
  }

  protected async saveDescriptions(asset: Asset): Promise<void> {
    if (asset.type !== 'image' || this.savingDescriptionsId()) {
      return;
    }

    const draft = this.descriptionDrafts()[asset.id] ?? {
      de: asset.descriptionDe ?? '',
      en: asset.descriptionEn ?? '',
    };
    const descriptionDe = draft.de.trim();
    const descriptionEn = draft.en.trim();

    if (!descriptionDe || !descriptionEn) {
      this.errorKey.set('admin.assetPicker.descriptionsRequired');
      return;
    }

    this.savingDescriptionsId.set(asset.id);
    this.errorKey.set(null);

    try {
      const updated = await firstValueFrom(
        this.assetsService.updateDescriptions(asset.id, {
          descriptionDe,
          descriptionEn,
        }),
      );

      this.loadedAssets.update((assets) => [
        updated,
        ...assets.filter((candidate) => candidate.id !== updated.id),
      ]);
      this.descriptionDrafts.update((drafts) => {
        const next = { ...drafts };
        delete next[asset.id];
        return next;
      });
      this.assetUpdated.emit(updated);
    } catch {
      this.errorKey.set('admin.assetPicker.descriptionSaveFailed');
    } finally {
      this.savingDescriptionsId.set(null);
    }
  }

  protected hasCompleteDescriptions(asset: Asset): boolean {
    return (
      asset.type !== 'image' || Boolean(asset.descriptionDe?.trim() && asset.descriptionEn?.trim())
    );
  }

  protected async uploadFromInput(event: Event): Promise<void> {
    const target = event.target;

    if (!(target instanceof HTMLInputElement) || !target.files?.length) {
      return;
    }

    const files = Array.from(target.files);
    target.value = '';
    for (const file of files) {
      await this.uploadFile(file);
    }
  }

  protected onDragEnter(event: DragEvent): void {
    if (!this.hasFiles(event)) {
      return;
    }

    event.preventDefault();
    this.dragDepth += 1;
    this.dragActive.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (!this.hasFiles(event)) {
      return;
    }

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  protected onDragLeave(event: DragEvent): void {
    if (!this.dragActive()) {
      return;
    }

    event.preventDefault();
    this.dragDepth = Math.max(this.dragDepth - 1, 0);

    if (this.dragDepth === 0) {
      this.dragActive.set(false);
    }
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    if (!this.hasFiles(event)) {
      return;
    }

    event.preventDefault();
    this.dragDepth = 0;
    this.dragActive.set(false);

    const files = event.dataTransfer?.files;

    if (!files?.length) {
      return;
    }

    for (const file of Array.from(files)) {
      await this.uploadFile(file);
    }
  }

  protected requestDelete(asset: Asset): void {
    this.confirmingDeleteId.set(asset.id);
    this.errorKey.set(null);
  }

  protected cancelDelete(): void {
    this.confirmingDeleteId.set(null);
  }

  protected async deleteAsset(asset: Asset): Promise<void> {
    if (this.deletingId()) {
      return;
    }

    this.deletingId.set(asset.id);
    this.errorKey.set(null);

    try {
      await firstValueFrom(this.assetsService.delete(asset.id));

      this.loadedAssets.update((assets) => assets.filter((candidate) => candidate.id !== asset.id));
      this.deletedIds.update((deletedIds) => {
        const next = new Set(deletedIds);
        next.add(asset.id);
        return next;
      });

      this.assetDeleted.emit(asset.id);
      this.confirmingDeleteId.set(null);
    } catch {
      this.errorKey.set('admin.assetPicker.deleteFailed');
    } finally {
      this.deletingId.set(null);
    }
  }

  protected formatSize(sizeBytes: number): string {
    if (sizeBytes < 1024) {
      return `${sizeBytes} B`;
    }

    const kilobytes = sizeBytes / 1024;

    if (kilobytes < 1024) {
      return `${kilobytes.toFixed(1)} KB`;
    }

    return `${(kilobytes / 1024).toFixed(1)} MB`;
  }

  protected accept(): string {
    return this.type() === 'image'
      ? 'image/jpeg,image/png,image/webp,image/avif'
      : 'audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/x-wav';
  }

  private async reload(): Promise<void> {
    this.loading.set(true);

    try {
      const [assets, folders] = await Promise.all([
        firstValueFrom(this.assetsService.getAll(this.type())),
        firstValueFrom(this.assetsService.getFolders()),
      ]);
      this.loadedAssets.set(assets);
      this.folders.set(folders);
    } catch {
      this.errorKey.set('admin.assetPicker.loadFailed');
    } finally {
      this.loading.set(false);
    }
  }

  private async uploadFile(file: File): Promise<void> {
    if (this.uploading()) {
      return;
    }

    this.uploading.set(true);
    this.errorKey.set(null);

    try {
      const asset = await firstValueFrom(this.assetsService.upload(file, this.folderId()));

      if (asset.type !== this.type()) {
        this.errorKey.set('admin.assetPicker.wrongType');
        return;
      }

      if (asset.folderId !== this.folderId()) {
        this.errorKey.set('admin.media.duplicateOtherFolder');
      }
      this.loadedAssets.update((assets) => [
        asset,
        ...assets.filter((candidate) => candidate.id !== asset.id),
      ]);

      this.assetUploaded.emit(asset);

      if (asset.type === 'audio' && !this.embedded()) {
        this.select(asset);
      } else {
        this.descriptionDrafts.update((drafts) => ({
          ...drafts,
          [asset.id]: {
            de: asset.descriptionDe ?? '',
            en: asset.descriptionEn ?? '',
          },
        }));
      }
    } catch {
      this.errorKey.set('admin.assetPicker.uploadFailed');
    } finally {
      this.uploading.set(false);
    }
  }

  private hasFiles(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes('Files') ?? false;
  }

  private readControlValue(event: Event): string {
    const target = event.target;

    return target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
      ? target.value
      : '';
  }

  private createdAt(asset: Asset): number {
    return new Date(asset.createdAt).getTime();
  }
}
