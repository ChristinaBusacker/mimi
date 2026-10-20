import type { Asset, AssetCropRect, AssetImageEdits } from '@shared/assets/asset';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
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
import { Icon } from '../icon/icon';

type EditorMode = 'image' | 'thumbnail';
type Aspect = 'free' | 'square' | 'wide' | 'portrait' | 'classic';
type CropAxis = 'width' | 'height';
type CropHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  pointerId: number;
  clientX: number;
  clientY: number;
  crop: AssetCropRect;
  handle: CropHandle;
}

const FULL: AssetCropRect = { x: 0, y: 0, width: 1, height: 1 };

function constrain(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function fitAspect(width: number, height: number, aspect: number): AssetCropRect {
  const imageAspect = width / height;
  const cropWidth = Math.min(1, aspect / imageAspect);
  const cropHeight = Math.min(1, imageAspect / aspect);
  return {
    x: (1 - cropWidth) / 2,
    y: (1 - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, Icon],
  selector: 'app-image-editor',
  styleUrl: './image-editor.scss',
  templateUrl: './image-editor.html',
})
export class ImageEditor {
  private readonly service = inject(AdminAssetsService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly thumbnail = viewChild<ElementRef<HTMLCanvasElement>>('thumbnail');
  private source: HTMLImageElement | null = null;
  private sourceCanvas: HTMLCanvasElement | null = null;
  private drag: DragState | null = null;

  readonly asset = input.required<Asset>();
  readonly saved = output<Asset>();
  readonly closed = output<void>();

  protected readonly mode = signal<EditorMode>('image');
  protected readonly aspect = signal<Aspect>('free');
  protected readonly rotation = signal<AssetImageEdits['rotation']>(0);
  protected readonly flipX = signal(false);
  protected readonly flipY = signal(false);
  protected readonly crop = signal<AssetCropRect>(FULL);
  protected readonly thumbnailCrop = signal<AssetCropRect>(FULL);
  protected readonly zoom = signal(1);
  protected readonly cropHandles: readonly Exclude<CropHandle, 'move'>[] = ['nw', 'ne', 'sw', 'se'];
  protected readonly ready = signal(false);
  protected readonly preciseControls = signal(false);
  protected readonly loadingError = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly previewRatio = signal('1 / 1');
  protected readonly cropSelection = computed(() =>
    this.mode() === 'thumbnail' ? this.thumbnailCrop() : this.crop(),
  );

  constructor() {
    afterNextRender(() => {
      this.dialog()?.nativeElement.showModal();
      const image = new Image();
      image.onload = () => {
        this.source = image;
        this.restore();
        this.ready.set(true);
        this.render();
      };
      image.onerror = () => this.loadingError.set(true);
      image.src = this.asset().originalUrl;
    });
  }

  protected togglePreciseControls(): void {
    this.preciseControls.update((visible) => !visible);
  }

  protected close(): void {
    this.dialog()?.nativeElement.close();
  }

  protected changeMode(mode: EditorMode): void {
    this.mode.set(mode);
    this.zoom.set(1);
    this.render();
  }

  protected rotate(direction: -1 | 1): void {
    this.rotation.update(
      (value) => ((value + direction * 90 + 360) % 360) as AssetImageEdits['rotation'],
    );
    this.crop.set(FULL);
    this.thumbnailCrop.set(this.centeredThumbnail(FULL));
    this.aspect.set('free');
    this.zoom.set(1);
    this.render();
  }

  protected flip(axis: 'x' | 'y'): void {
    if (axis === 'x') this.flipX.update((value) => !value);
    else this.flipY.update((value) => !value);
    this.render();
  }

  protected changeAspect(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const value = target.value;
    if (!['free', 'square', 'wide', 'portrait', 'classic'].includes(value)) return;
    const aspect = value as Aspect;
    this.aspect.set(aspect);
    this.zoom.set(1);
    const dimensions = this.orientedDimensions();
    const ratio = this.aspectRatio(aspect, dimensions.width / dimensions.height);
    this.updateCrop(this.centeredOnCurrent(fitAspect(dimensions.width, dimensions.height, ratio)));
  }

  protected changeZoom(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const scale = Number(target.value);
    this.zoom.set(scale);
    const selected = this.cropSelection();
    const dimensions = this.previewDimensions();
    const base =
      this.mode() === 'thumbnail'
        ? fitAspect(dimensions.width, dimensions.height, 1)
        : fitAspect(
            dimensions.width,
            dimensions.height,
            this.aspectRatio(this.aspect(), dimensions.width / dimensions.height),
          );
    this.setSelection(
      this.centeredOnCurrent(
        { ...base, width: base.width / scale, height: base.height / scale },
        selected,
      ),
    );
  }

  protected changeFreeAxis(axis: CropAxis, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const selected = this.crop();
    const amount = Number(target.value) / 100;
    const next = { ...selected, [axis]: amount };
    this.updateCrop(this.centeredOnCurrent(next, selected));
  }

  protected moveAxis(axis: 'x' | 'y', event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const current = this.cropSelection();
    const size = axis === 'x' ? current.width : current.height;
    this.setSelection({
      ...current,
      [axis]: (Number(target.value) / 100) * (1 - size),
    });
  }

  protected pointerDown(event: PointerEvent, handle: CropHandle = 'move'): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement) || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    target.setPointerCapture(event.pointerId);
    this.drag = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      crop: this.cropSelection(),
      handle,
    };
  }

  protected pointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const canvas = this.canvas()?.nativeElement;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const dx = (event.clientX - drag.clientX) / bounds.width;
    const dy = (event.clientY - drag.clientY) / bounds.height;
    if (drag.handle === 'move') {
      this.setSelection({
        ...drag.crop,
        x: constrain(drag.crop.x + dx, 0, 1 - drag.crop.width),
        y: constrain(drag.crop.y + dy, 0, 1 - drag.crop.height),
      });
      return;
    }
    this.setSelection(this.resizedCrop(drag.crop, dx, dy, drag.handle));
  }

  protected pointerUp(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) this.drag = null;
  }

  protected nudgeCrop(event: KeyboardEvent): void {
    const step = event.shiftKey ? 0.05 : 0.01;
    const delta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    } as const;
    if (!Object.hasOwn(delta, event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const [dx, dy] = delta[event.key as keyof typeof delta];
    const crop = this.cropSelection();
    this.setSelection({
      ...crop,
      x: constrain(crop.x + dx, 0, 1 - crop.width),
      y: constrain(crop.y + dy, 0, 1 - crop.height),
    });
  }

  private resizedCrop(
    current: AssetCropRect,
    dx: number,
    dy: number,
    handle: Exclude<CropHandle, 'move'>,
  ): AssetCropRect {
    const west = handle.endsWith('w');
    const north = handle.startsWith('n');
    const anchorX = west ? current.x + current.width : current.x;
    const anchorY = north ? current.y + current.height : current.y;
    const maxWidth = west ? anchorX : 1 - anchorX;
    const maxHeight = north ? anchorY : 1 - anchorY;
    let width = constrain(current.width + (west ? -dx : dx), 0.06, maxWidth);
    let height = constrain(current.height + (north ? -dy : dy), 0.06, maxHeight);

    if (this.mode() === 'thumbnail' || this.aspect() !== 'free') {
      // Keep the ratio of the current crop in normalized image coordinates.
      const ratio = current.width / current.height;
      if (Math.abs(dx) / current.width > Math.abs(dy) / current.height) {
        height = width / ratio;
      } else {
        width = height * ratio;
      }
      width = Math.min(width, maxWidth, maxHeight * ratio);
      height = width / ratio;
    }

    return {
      x: west ? anchorX - width : anchorX,
      y: north ? anchorY - height : anchorY,
      width,
      height,
    };
  }

  protected reset(): void {
    this.rotation.set(0);
    this.flipX.set(false);
    this.flipY.set(false);
    this.aspect.set('free');
    this.crop.set(FULL);
    this.thumbnailCrop.set(this.centeredThumbnail(FULL));
    this.zoom.set(1);
    this.render();
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.ready()) return;
    this.saving.set(true);
    this.saveFailed.set(false);
    const crop = this.crop();
    const edits: AssetImageEdits = {
      rotation: this.rotation(),
      flipX: this.flipX(),
      flipY: this.flipY(),
      crop: this.isFull(crop) ? null : crop,
      thumbnailCrop: this.thumbnailCrop(),
    };
    try {
      const saved = await firstValueFrom(this.service.updateImageEdits(this.asset().id, edits));
      this.saved.emit(saved);
      this.close();
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  private restore(): void {
    const edits = this.asset().imageEdits;
    this.rotation.set(edits?.rotation ?? 0);
    this.flipX.set(edits?.flipX ?? false);
    this.flipY.set(edits?.flipY ?? false);
    const crop = edits?.crop ?? FULL;
    this.crop.set(crop);
    this.thumbnailCrop.set(edits?.thumbnailCrop ?? this.centeredThumbnail(crop));
    this.aspect.set('free');
  }

  private isFull(rect: AssetCropRect): boolean {
    return rect.x === 0 && rect.y === 0 && rect.width === 1 && rect.height === 1;
  }

  private aspectRatio(aspect: Aspect, natural: number): number {
    switch (aspect) {
      case 'square':
        return 1;
      case 'wide':
        return 16 / 9;
      case 'portrait':
        return 4 / 5;
      case 'classic':
        return 3 / 2;
      default:
        return natural;
    }
  }

  private orientedDimensions(): { width: number; height: number } {
    const image = this.source;
    if (!image) return { width: 1, height: 1 };
    const swapped = this.rotation() === 90 || this.rotation() === 270;
    return {
      width: swapped ? image.naturalHeight : image.naturalWidth,
      height: swapped ? image.naturalWidth : image.naturalHeight,
    };
  }

  private previewDimensions(): { width: number; height: number } {
    const full = this.orientedDimensions();
    return this.mode() === 'thumbnail'
      ? { width: full.width * this.crop().width, height: full.height * this.crop().height }
      : full;
  }

  private centeredThumbnail(mainCrop: AssetCropRect): AssetCropRect {
    const { width, height } = this.orientedDimensions();
    return fitAspect(width * mainCrop.width, height * mainCrop.height, 1);
  }

  private centeredOnCurrent(next: AssetCropRect, current = this.cropSelection()): AssetCropRect {
    const centerX = current.x + current.width / 2;
    const centerY = current.y + current.height / 2;
    return {
      x: constrain(centerX - next.width / 2, 0, 1 - next.width),
      y: constrain(centerY - next.height / 2, 0, 1 - next.height),
      width: next.width,
      height: next.height,
    };
  }

  private setSelection(rect: AssetCropRect): void {
    if (this.mode() === 'thumbnail') {
      this.thumbnailCrop.set(rect);
    } else {
      this.updateCrop(rect);
      return;
    }
    this.renderThumbnail();
  }

  private updateCrop(rect: AssetCropRect): void {
    this.crop.set(rect);
    this.thumbnailCrop.set(this.centeredThumbnail(rect));
    this.render();
  }

  private render(): void {
    const image = this.source;
    const canvas = this.canvas()?.nativeElement;
    if (!image || !canvas) return;
    const dimensions = this.orientedDimensions();
    const scale = Math.min(1, 1100 / Math.max(dimensions.width, dimensions.height));
    const fullWidth = Math.max(1, Math.round(dimensions.width * scale));
    const fullHeight = Math.max(1, Math.round(dimensions.height * scale));
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = fullWidth;
    sourceCanvas.height = fullHeight;
    const sourceContext = sourceCanvas.getContext('2d');
    if (!sourceContext) return;
    this.sourceCanvas = sourceCanvas;
    sourceContext.translate(fullWidth / 2, fullHeight / 2);
    sourceContext.scale(this.flipX() ? -1 : 1, this.flipY() ? -1 : 1);
    sourceContext.rotate((this.rotation() * Math.PI) / 180);
    const imageScale = scale;
    sourceContext.drawImage(
      image,
      (-image.naturalWidth * imageScale) / 2,
      (-image.naturalHeight * imageScale) / 2,
      image.naturalWidth * imageScale,
      image.naturalHeight * imageScale,
    );

    const main = this.mode() === 'thumbnail' ? this.crop() : FULL;
    canvas.width = Math.max(1, Math.round(fullWidth * main.width));
    canvas.height = Math.max(1, Math.round(fullHeight * main.height));
    const context = canvas.getContext('2d');
    context?.drawImage(
      sourceCanvas,
      main.x * fullWidth,
      main.y * fullHeight,
      main.width * fullWidth,
      main.height * fullHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    this.previewRatio.set(`${canvas.width} / ${canvas.height}`);
    this.renderThumbnail(sourceCanvas);
  }

  private renderThumbnail(sourceCanvas?: HTMLCanvasElement): void {
    const preview = this.thumbnail()?.nativeElement;
    if (!preview || !this.source) return;
    const rect = this.thumbnailCrop();
    const main = this.crop();
    const canvas = sourceCanvas ?? this.sourceCanvas;
    if (!canvas) return;
    const ctx = preview.getContext('2d');
    if (!ctx) return;
    preview.width = 256;
    preview.height = 256;
    ctx.drawImage(
      canvas,
      (main.x + rect.x * main.width) * canvas.width,
      (main.y + rect.y * main.height) * canvas.height,
      rect.width * main.width * canvas.width,
      rect.height * main.height * canvas.height,
      0,
      0,
      256,
      256,
    );
  }
}
