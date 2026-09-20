import type {
  Asset,
  AssetType,
} from '@shared/assets/asset';

import {
  AsyncPipe,
  DatePipe,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AdminAssetsService } from '../../core/assets/admin-assets.service';
import { I18nPipe } from '../../core/i18n/i18n.pipe';

type AssetSort =
  | 'newest'
  | 'oldest'
  | 'nameAsc'
  | 'nameDesc';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    I18nPipe,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(
        () => AssetPicker,
      ),
      multi: true,
    },
  ],
  selector: 'app-asset-picker',
  styleUrl: './asset-picker.scss',
  templateUrl: './asset-picker.html',
})
export class AssetPicker implements ControlValueAccessor {
  private readonly assetsService = inject(AdminAssetsService);
  private readonly dialog =
    viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly type = input.required<AssetType>();
  readonly label = input.required<string>();
  readonly buttonLabel = input.required<string>();
  readonly assets = input<readonly Asset[]>([]);

  readonly assetUploaded = output<Asset>();
  readonly assetDeleted = output<string>();
  readonly assetSelected = output<Asset | null>();

  private readonly loadedAssets = signal<Asset[]>([]);
  protected readonly selectedId = signal('');
  private readonly disabled = signal(false);
  private dragDepth = 0;

  protected readonly search = signal('');
  protected readonly sort = signal<AssetSort>('newest');
  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);
  protected readonly dragActive = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly confirmingDeleteId = signal<string | null>(null);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly availableAssets = computed(() => {
    const byId = new Map<string, Asset>();

    for (const asset of [
      ...this.loadedAssets(),
      ...this.assets(),
    ]) {
      if (asset.type === this.type()) {
        byId.set(asset.id, asset);
      }
    }

    return [...byId.values()];
  });

  protected readonly filteredAssets = computed(() => {
    const query = this.search()
      .trim()
      .toLocaleLowerCase();

    const assets = this.availableAssets()
      .filter((asset) =>
        !query ||
        asset.originalFilename
          .toLocaleLowerCase()
          .includes(query),
      )
      .slice();

    switch (this.sort()) {
      case 'oldest':
        return assets.sort(
          (left, right) =>
            this.createdAt(left) -
            this.createdAt(right),
        );
      case 'nameAsc':
        return assets.sort(
          (left, right) =>
            left.originalFilename.localeCompare(
              right.originalFilename,
            ),
        );
      case 'nameDesc':
        return assets.sort(
          (left, right) =>
            right.originalFilename.localeCompare(
              left.originalFilename,
            ),
        );
      case 'newest':
      default:
        return assets.sort(
          (left, right) =>
            this.createdAt(right) -
            this.createdAt(left),
        );
    }
  });

  protected readonly selectedAsset = computed(
    () =>
      this.availableAssets().find(
        (asset) =>
          asset.id === this.selectedId(),
      ) ?? null,
  );

  private onChange: (value: string) => void =
    () => undefined;
  private onTouched: () => void =
    () => undefined;

  writeValue(value: string | null): void {
    this.selectedId.set(value ?? '');
  }

  registerOnChange(
    callback: (value: string) => void,
  ): void {
    this.onChange = callback;
  }

  registerOnTouched(callback: () => void): void {
    this.onTouched = callback;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected isDisabled(): boolean {
    return this.disabled();
  }

  protected async open(): Promise<void> {
    if (this.disabled()) {
      return;
    }

    this.errorKey.set(null);
    this.confirmingDeleteId.set(null);
    this.dialog()?.nativeElement.showModal();

    await this.reload();
  }

  protected close(): void {
    this.dialog()?.nativeElement.close();
  }

  protected onDialogClosed(): void {
    this.dragDepth = 0;
    this.dragActive.set(false);
    this.confirmingDeleteId.set(null);
    this.errorKey.set(null);
    this.onTouched();
  }

  protected setSearch(event: Event): void {
    this.search.set(
      this.readControlValue(event),
    );
  }

  protected setSort(event: Event): void {
    const value = this.readControlValue(event);

    if (
      value === 'newest' ||
      value === 'oldest' ||
      value === 'nameAsc' ||
      value === 'nameDesc'
    ) {
      this.sort.set(value);
    }
  }

  protected select(asset: Asset): void {
    this.selectedId.set(asset.id);
    this.onChange(asset.id);
    this.assetSelected.emit(asset);
    this.onTouched();
    this.close();
  }

  protected clearSelection(): void {
    this.selectedId.set('');
    this.onChange('');
    this.assetSelected.emit(null);
    this.onTouched();
  }

  protected async uploadFromInput(
    event: Event,
  ): Promise<void> {
    const target = event.target;

    if (
      !(target instanceof HTMLInputElement) ||
      !target.files?.length
    ) {
      return;
    }

    await this.uploadFile(target.files[0]);

    target.value = '';
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
    this.dragDepth = Math.max(
      this.dragDepth - 1,
      0,
    );

    if (this.dragDepth === 0) {
      this.dragActive.set(false);
    }
  }

  protected async onDrop(
    event: DragEvent,
  ): Promise<void> {
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

    if (files.length > 1) {
      this.errorKey.set(
        'admin.assetPicker.singleFileOnly',
      );

      return;
    }

    await this.uploadFile(files[0]);
  }

  protected requestDelete(asset: Asset): void {
    this.confirmingDeleteId.set(asset.id);
    this.errorKey.set(null);
  }

  protected cancelDelete(): void {
    this.confirmingDeleteId.set(null);
  }

  protected async deleteAsset(
    asset: Asset,
  ): Promise<void> {
    if (this.deletingId()) {
      return;
    }

    this.deletingId.set(asset.id);
    this.errorKey.set(null);

    try {
      await firstValueFrom(
        this.assetsService.delete(asset.id),
      );

      this.loadedAssets.update(
        (assets) =>
          assets.filter(
            (candidate) =>
              candidate.id !== asset.id,
          ),
      );

      this.assetDeleted.emit(asset.id);

      if (this.selectedId() === asset.id) {
        this.clearSelection();
      }

      this.confirmingDeleteId.set(null);
    } catch {
      this.errorKey.set(
        'admin.assetPicker.deleteFailed',
      );
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
      this.loadedAssets.set(
        await firstValueFrom(
          this.assetsService.getAll(this.type()),
        ),
      );
    } catch {
      this.errorKey.set(
        'admin.assetPicker.loadFailed',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async uploadFile(
    file: File,
  ): Promise<void> {
    if (this.uploading()) {
      return;
    }

    this.uploading.set(true);
    this.errorKey.set(null);

    try {
      const asset = await firstValueFrom(
        this.assetsService.upload(file),
      );

      if (asset.type !== this.type()) {
        this.errorKey.set(
          'admin.assetPicker.wrongType',
        );

        return;
      }

      this.loadedAssets.update(
        (assets) => [
          asset,
          ...assets.filter(
            (candidate) =>
              candidate.id !== asset.id,
          ),
        ],
      );

      this.assetUploaded.emit(asset);
      this.select(asset);
    } catch {
      this.errorKey.set(
        'admin.assetPicker.uploadFailed',
      );
    } finally {
      this.uploading.set(false);
    }
  }

  private hasFiles(event: DragEvent): boolean {
    return (
      event.dataTransfer?.types.includes(
        'Files',
      ) ?? false
    );
  }

  private readControlValue(event: Event): string {
    const target = event.target;

    return target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement
      ? target.value
      : '';
  }

  private createdAt(asset: Asset): number {
    return new Date(asset.createdAt).getTime();
  }
}
