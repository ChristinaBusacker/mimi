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
import { Icon } from '../icon/icon';

type AssetSort = 'newest' | 'oldest' | 'nameAsc' | 'nameDesc';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, I18nPipe, Button, ImageEditor, Icon],
  selector: 'app-asset-library',
  styleUrl: './asset-library.scss',
  templateUrl: './asset-library.html',
})
export class AssetLibrary implements OnInit {
  private readonly assetsService = inject(AdminAssetsService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly type = input.required<AssetType>();
  readonly embedded = input(false);
  readonly pickerWorkspace = input(true);
  readonly multiSelect = input(false);
  protected readonly showWorkspace = computed(() => this.embedded() || this.pickerWorkspace());
  readonly assets = input<readonly Asset[]>([]);
  readonly selectedId = input<string | null>('');

  readonly assetSelected = output<Asset>();
  readonly assetsSelected = output<Asset[]>();
  readonly assetUploaded = output<Asset>();
  readonly assetUpdated = output<Asset>();
  readonly assetDeleted = output<string>();
  readonly closed = output<void>();

  private readonly loadedAssets = signal<Asset[]>([]);
  private readonly deletedIds = signal<ReadonlySet<string>>(new Set<string>());
  private dragDepth = 0;

  protected readonly search = signal('');
  protected readonly searchAllFolders = signal(true);
  protected readonly selectionAnchorId = signal<string | null>(null);
  protected readonly contextFolderId = signal<string | null>(null);
  protected readonly renamingFolderId = signal<string | null>(null);
  protected readonly renameDraft = signal('');
  protected readonly usageForAssetId = signal<string | null>(null);
  protected readonly usages = signal<readonly { ownerType: string; ownerUuid: string; scope: string }[]>([]);
  protected readonly usageLoading = signal(false);
  protected readonly imageLoaded = signal<ReadonlySet<string>>(new Set<string>());
  protected readonly imageFailed = signal<ReadonlySet<string>>(new Set<string>());
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
  protected readonly replaceDraft = signal<{ asset: Asset; file: File } | null>(null);
  protected readonly replacing = signal(false);
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
  protected readonly bulkMode = signal(false);
  protected readonly bulkBusy = signal(false);
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set<string>());
  protected readonly pickerOrder = signal<string[]>([]);
  protected readonly descriptionQueue = signal<string[]>([]);
  protected readonly bulkTargetId = signal<string | null>(null);
  protected readonly dragTargetFolder = signal<string | null>(null);
  private draggedAssetIds: string[] = [];

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

  protected readonly focusedAsset = computed(
    () => this.availableAssets().find((asset) => asset.id === this.focusedId()) ?? null,
  );

  protected readonly folderPaths = computed(() => {
    const byId = new Map(this.folders().map((folder) => [folder.id, folder] as const));
    const paths: Record<string, string> = {};

    for (const folder of this.folders()) {
      const segments: string[] = [];
      const visited = new Set<string>();
      let cursor: string | null = folder.id;

      while (cursor && !visited.has(cursor)) {
        visited.add(cursor);
        const current = byId.get(cursor);
        if (!current) break;
        segments.unshift(current.name);
        cursor = current.parentId;
      }
      paths[folder.id] = segments.join(' / ');
    }

    return paths;
  });

  protected readonly selectedAssets = computed(() =>
    this.availableAssets().filter((asset) => this.selectedIds().has(asset.id)),
  );

  protected readonly movableAssets = computed(() =>
    this.selectedAssets().filter((asset) => asset.folderId !== this.bulkTargetId()),
  );

  protected readonly filteredAssets = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();

    const assets = this.availableAssets()
      .filter(
        (asset) =>
          (query.length > 0 && this.searchAllFolders()) || asset.folderId === this.folderId(),
      )
      .filter((asset) => !this.incompleteOnly() || !this.hasCompleteDescriptions(asset))
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
      this.selectedIds.set(new Set<string>());
      this.pickerOrder.set([]);
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

  protected clearSearch(): void {
    this.search.set('');
  }

  protected imageReady(id: string): void {
    this.imageLoaded.update((current) => new Set(current).add(id));
    this.imageFailed.update((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  protected imageError(id: string): void {
    this.imageFailed.update((current) => new Set(current).add(id));
  }

  protected setSort(event: Event): void {
    const value = this.readControlValue(event);

    if (value === 'newest' || value === 'oldest' || value === 'nameAsc' || value === 'nameDesc') {
      this.sort.set(value);
    }
  }

  protected setSearchAllFolders(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.searchAllFolders.set(target.checked);
  }

  protected startBulkMode(): void {
    if (!this.embedded()) return;
    this.selectedIds.set(new Set<string>());
    this.bulkTargetId.set(this.folderId());
    this.bulkMode.set(true);
    this.errorKey.set(null);
  }

  protected stopBulkMode(): void {
    if (this.bulkBusy()) return;
    this.selectedIds.set(new Set<string>());
    this.bulkMode.set(false);
    this.errorKey.set(null);
  }

  protected toggleBulkAsset(id: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || this.bulkBusy()) return;

    const next = new Set(this.selectedIds());
    if (target.checked) next.add(id);
    else next.delete(id);

    if (next.size > 1000) {
      target.checked = false;
      this.errorKey.set('admin.media.bulkLimit');
      return;
    }
    this.selectedIds.set(next);
  }

  protected selectVisibleAssets(): void {
    const next = new Set(this.selectedIds());
    for (const asset of this.filteredAssets()) next.add(asset.id);
    if (next.size > 1000) {
      this.errorKey.set('admin.media.bulkLimit');
      return;
    }
    this.selectedIds.set(next);
  }

  protected clearBulkSelection(): void {
    this.selectedIds.set(new Set<string>());
  }

  protected setBulkTarget(event: Event): void {
    this.bulkTargetId.set(this.readControlValue(event) || null);
  }

  protected async moveSelectedAssets(): Promise<void> {
    if (!this.embedded() || this.bulkBusy()) return;
    const assets = this.movableAssets();
    if (!assets.length) return;

    this.bulkBusy.set(true);
    this.errorKey.set(null);
    try {
      const updated = await firstValueFrom(
        this.assetsService.moveAssets({
          ids: assets.map((asset) => asset.id),
          folderId: this.bulkTargetId(),
        }),
      );
      const moved = new Set(updated.map((asset) => asset.id));
      this.loadedAssets.update((current) => [
        ...updated,
        ...current.filter((asset) => !moved.has(asset.id)),
      ]);
      for (const asset of updated) this.assetUpdated.emit(asset);
      this.selectedIds.set(new Set<string>());
      this.bulkMode.set(false);
    } catch {
      this.errorKey.set('admin.media.bulkMoveFailed');
    } finally {
      this.bulkBusy.set(false);
    }
  }

  protected openAsset(asset: Asset, event: MouseEvent): void {
    if (!this.embedded()) {
      this.focusedId.set(asset.id);
      this.confirmingDeleteId.set(null);
      if (!this.multiSelect()) return;
      const previous = this.pickerOrder();
      let next: string[];
      if (event.shiftKey) {
        const visible = this.filteredAssets();
        const startIndex = visible.findIndex((item) => item.id === this.selectionAnchorId());
        const endIndex = visible.findIndex((item) => item.id === asset.id);
        const range = startIndex < 0 || endIndex < 0
          ? [asset.id]
          : visible.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1)
              .map((item) => item.id);
        next = [...new Set([...previous, ...range])];
      } else if (event.ctrlKey || event.metaKey) {
        next = previous.includes(asset.id)
          ? previous.filter((id) => id !== asset.id)
          : [...previous, asset.id];
        this.selectionAnchorId.set(asset.id);
      } else {
        next = [asset.id];
        this.selectionAnchorId.set(asset.id);
      }
      if (next.length > 36) {
        this.errorKey.set('admin.media.bulkLimit');
        return;
      }
      this.pickerOrder.set(next);
      this.selectedIds.set(new Set(next));
      return;
    }
    const range = event.shiftKey;
    const toggle = event.ctrlKey || event.metaKey;
    const next = new Set(this.selectedIds());
    if (range) {
      const items = this.filteredAssets();
      const anchor = items.findIndex((item) => item.id === this.selectionAnchorId());
      const current = items.findIndex((item) => item.id === asset.id);
      if (anchor >= 0 && current >= 0) {
        for (const item of items.slice(Math.min(anchor, current), Math.max(anchor, current) + 1)) {
          next.add(item.id);
        }
      } else {
        next.add(asset.id);
      }
    } else if (toggle || this.bulkMode()) {
      if (next.has(asset.id)) next.delete(asset.id);
      else if (next.size < 1000) next.add(asset.id);
      else {
        this.errorKey.set('admin.media.bulkLimit');
        return;
      }
      this.selectionAnchorId.set(asset.id);
    } else {
      next.clear();
      this.selectionAnchorId.set(asset.id);
    }
    if (next.size > 1000) {
      this.errorKey.set('admin.media.bulkLimit');
      return;
    }
    this.selectedIds.set(next);
    this.bulkMode.set(next.size > 0);
    this.focusedId.set(asset.id);
    this.confirmingDeleteId.set(null);
  }

  protected clearFocus(): void {
    this.focusedId.set(null);
    this.confirmingDeleteId.set(null);
  }

  protected startAssetDrag(event: DragEvent, asset: Asset): void {
    if (!this.embedded() || !event.dataTransfer) return;
    this.draggedAssetIds =
      this.selectedIds().has(asset.id) && this.selectedIds().size > 1
        ? [...this.selectedIds()]
        : [asset.id];
    event.dataTransfer.setData('application/x-mimi-asset', asset.id);
    event.dataTransfer.effectAllowed = 'move';
  }

  protected endAssetDrag(): void {
    this.draggedAssetIds = [];
    this.dragTargetFolder.set(null);
  }

  protected dragOverFolder(event: DragEvent, folderId: string | null): void {
    if (this.draggedAssetIds.length === 0 || !event.dataTransfer) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    this.dragTargetFolder.set(folderId ?? 'root');
  }

  protected dragLeaveFolder(event: DragEvent): void {
    event.stopPropagation();
    this.dragTargetFolder.set(null);
  }

  protected async dropOnFolder(event: DragEvent, folderId: string | null): Promise<void> {
    if (this.draggedAssetIds.length === 0 || this.bulkBusy()) return;
    event.preventDefault();
    event.stopPropagation();
    const ids = this.draggedAssetIds;
    this.endAssetDrag();
    const moved = this.availableAssets().filter(
      (asset) => ids.includes(asset.id) && asset.folderId !== folderId,
    );
    if (!moved.length) return;
    this.bulkBusy.set(true);
    this.errorKey.set(null);
    try {
      const updated = await firstValueFrom(
        this.assetsService.moveAssets({
          ids: moved.map((asset) => asset.id),
          folderId,
        }),
      );
      const idSet = new Set(updated.map((asset) => asset.id));
      this.loadedAssets.update((assets) => [
        ...updated,
        ...assets.filter((asset) => !idSet.has(asset.id)),
      ]);
      for (const asset of updated) this.assetUpdated.emit(asset);
      this.selectedIds.set(new Set<string>());
      this.bulkMode.set(false);
      this.dragTargetFolder.set(null);
    } catch {
      this.errorKey.set('admin.media.bulkMoveFailed');
    } finally {
      this.bulkBusy.set(false);
    }
  }

  protected changeFolder(id: string | null): void {
    this.folderId.set(id);
    this.focusedId.set(null);
    this.confirmingDeleteId.set(null);
    this.contextFolderId.set(null);
    this.errorKey.set(null);
  }

  protected openFolderContext(event: MouseEvent, id: string): void {
    if (!this.embedded()) return;
    event.preventDefault();
    event.stopPropagation();
    this.contextFolderId.set(id);
  }

  protected beginFolderRename(id: string): void {
    const folder = this.folders().find((item) => item.id === id);
    if (!folder) return;
    this.renameDraft.set(folder.name);
    this.renamingFolderId.set(id);
    this.contextFolderId.set(null);
  }

  protected setRenameDraft(event: Event): void {
    this.renameDraft.set(this.readControlValue(event));
  }

  protected cancelFolderRename(): void {
    this.renamingFolderId.set(null);
  }

  protected async saveFolderRename(): Promise<void> {
    const id = this.renamingFolderId();
    const name = this.renameDraft().trim();
    if (!id || !name || this.folderBusy()) return;
    this.folderBusy.set(true);
    this.errorKey.set(null);
    try {
      const folder = await firstValueFrom(this.assetsService.renameFolder(id, name));
      this.folders.update((current) => current.map((item) => item.id === id ? folder : item));
      this.renamingFolderId.set(null);
    } catch {
      this.errorKey.set('admin.media.folderCreateFailed');
    } finally {
      this.folderBusy.set(false);
    }
  }

  protected async deleteContextFolder(id: string): Promise<void> {
    this.contextFolderId.set(null);
    this.errorKey.set(null);
    this.folderBusy.set(true);
    try {
      await firstValueFrom(this.assetsService.deleteFolder(id));
      const parent = this.folders().find((item) => item.id === id)?.parentId ?? null;
      this.folders.update((items) => items.filter((item) => item.id !== id));
      if (this.folderId() === id) this.changeFolder(parent);
    } catch {
      this.errorKey.set('admin.media.folderDeleteFailed');
    } finally {
      this.folderBusy.set(false);
    }
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

  protected confirmPickerSelection(): void {
    const byId = new Map(this.availableAssets().map((asset) => [asset.id, asset] as const));
    const chosen = this.pickerOrder()
      .map((id) => byId.get(id))
      .filter((asset): asset is Asset => asset !== undefined);
    if (!chosen.length || chosen.some((asset) =>
      asset.type === 'image' && !this.decorative() && !this.hasCompleteDescriptions(asset)
    )) {
      this.errorKey.set('admin.assetPicker.descriptionsRequired');
      return;
    }
    this.assetsSelected.emit(chosen);
    this.close();
  }

  protected pickerSelectionValid(): boolean {
    if (!this.pickerOrder().length) return false;
    const byId = new Map(this.availableAssets().map((asset) => [asset.id, asset] as const));
    return this.pickerOrder().every((id) => {
      const asset = byId.get(id);
      return asset && (this.decorative() || this.hasCompleteDescriptions(asset));
    });
  }

  protected pickerIndex(id: string): number {
    return this.pickerOrder().indexOf(id) + 1;
  }

  protected stageReplacement(asset: Asset, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.files?.length) return;
    const file = target.files[0];
    target.value = '';
    this.replaceDraft.set({ asset, file });
  }

  protected async confirmReplacement(): Promise<void> {
    const draft = this.replaceDraft();
    if (!draft || this.replacing()) return;
    this.replacing.set(true);
    this.errorKey.set(null);
    try {
      const saved = await firstValueFrom(this.assetsService.replaceImage(draft.asset.id, draft.file));
      this.loadedAssets.update((assets) => [saved, ...assets.filter((item) => item.id !== saved.id)]);
      this.imageLoaded.update((current) => { const next = new Set(current); next.delete(saved.id); return next; });
      this.imageFailed.update((current) => { const next = new Set(current); next.delete(saved.id); return next; });
      this.assetUpdated.emit(saved);
      this.replaceDraft.set(null);
    } catch {
      this.errorKey.set('admin.media.workflow.replaceFailed');
    } finally {
      this.replacing.set(false);
    }
  }

  protected openEditor(asset: Asset): void {
    this.editingAsset.set(asset);
  }

  protected closeEditor(): void {
    this.editingAsset.set(null);
  }

  protected editorSaved(asset: Asset): void {
    this.loadedAssets.update((assets) => [
      asset,
      ...assets.filter((candidate) => candidate.id !== asset.id),
    ]);
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
      this.descriptionQueue.update((ids) => ids.filter((id) => id !== updated.id));
      const nextId = this.descriptionQueue()[0];
      if (nextId) {
        const nextAsset = this.availableAssets().find((item) => item.id === nextId);
        if (nextAsset) {
          this.folderId.set(nextAsset.folderId);
          this.focusedId.set(nextId);
        }
      }
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

  protected async requestDelete(asset: Asset): Promise<void> {
    this.confirmingDeleteId.set(asset.id);
    this.usageForAssetId.set(asset.id);
    this.usages.set([]);
    this.usageLoading.set(true);
    this.errorKey.set(null);
    try {
      const usages = await firstValueFrom(this.assetsService.getUsages(asset.id));
      if (this.usageForAssetId() === asset.id) this.usages.set(usages);
    } catch {
      this.errorKey.set('admin.assetPicker.loadFailed');
      this.usages.set([{ ownerType: 'unknown', ownerUuid: '', scope: '' }]);
    } finally {
      this.usageLoading.set(false);
    }
  }

  protected cancelDelete(): void {
    this.confirmingDeleteId.set(null);
    this.usageForAssetId.set(null);
    this.usages.set([]);
  }

  protected async deleteAsset(asset: Asset): Promise<void> {
    if (this.deletingId() || this.usageLoading() || this.usages().length > 0) {
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
      } else if (asset.type === 'image') {
        this.descriptionDrafts.update((drafts) => ({
          ...drafts,
          [asset.id]: {
            de: asset.descriptionDe ?? '',
            en: asset.descriptionEn ?? '',
          },
        }));
        if (!this.hasCompleteDescriptions(asset)) {
          const firstPending = this.descriptionQueue().length === 0;
          if (!this.descriptionQueue().includes(asset.id)) {
            this.descriptionQueue.update((ids) => [...ids, asset.id]);
          }
          if (firstPending) {
            this.folderId.set(asset.folderId);
            this.focusedId.set(asset.id);
          }
        } else if (!this.descriptionQueue().length) {
          this.focusedId.set(asset.id);
        }
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
