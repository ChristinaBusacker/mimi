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
  computed,
  forwardRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { AssetLibrary } from '../asset-library/asset-library';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AssetLibrary,
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
  private readonly library = viewChild(AssetLibrary);

  readonly type = input.required<AssetType>();
  readonly label = input.required<string>();
  readonly buttonLabel = input.required<string>();
  readonly assets = input<readonly Asset[]>([]);

  readonly assetUploaded = output<Asset>();
  readonly assetDeleted = output<string>();
  readonly assetSelected = output<Asset | null>();

  protected readonly selectedId = signal('');
  private readonly disabled = signal(false);

  protected readonly availableAssets = computed(
    () =>
      this.assets().filter(
        (asset) => asset.type === this.type(),
      ),
  );

  protected readonly selectedAsset = computed(
    () =>
      this.availableAssets().find(
        (asset) => asset.id === this.selectedId(),
      ) ?? null,
  );

  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.selectedId.set(value ?? '');
  }

  registerOnChange(callback: (value: string) => void): void {
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

  protected open(): void {
    if (this.disabled()) {
      return;
    }

    void this.library()?.open();
  }

  protected select(asset: Asset): void {
    this.selectedId.set(asset.id);
    this.onChange(asset.id);
    this.assetSelected.emit(asset);
    this.onTouched();
  }

  protected clearSelection(): void {
    this.selectedId.set('');
    this.onChange('');
    this.assetSelected.emit(null);
    this.onTouched();
  }

  protected addAsset(asset: Asset): void {
    this.assetUploaded.emit(asset);
  }

  protected removeAsset(assetId: string): void {
    if (this.selectedId() === assetId) {
      this.clearSelection();
    }

    this.assetDeleted.emit(assetId);
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
}
