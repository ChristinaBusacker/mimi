import type { MusicAlbumSummary } from '@shared/music/music';
import type { OnInit } from '@angular/core';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../components/icon/icon';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { AlbumSelectionService } from '../../../core/music/album-selection.service';
import { prepareBookletPortal } from '../../../core/navigation/booklet-transition';
import type { AlbumStageRenderer } from './album-stage-renderer';

interface AlbumFanCard {
  album: MusicAlbumSummary;
  index: number;
  x: string;
  y: string;
  depth: string;
  rotateY: string;
  rotateZ: string;
  scale: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  active: boolean;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, Icon, RouterLink],
  selector: 'app-album-fan',
  styleUrl: './album-fan.scss',
  templateUrl: './album-fan.html',
})
export class AlbumFan implements OnInit {
  readonly albums = input.required<readonly MusicAlbumSummary[]>();
  protected readonly activeIndex = signal(0);
  protected readonly dragProgress = signal(0);
  protected readonly isDragging = signal(false);
  protected readonly webglReady = signal(false);
  private readonly destroyRef = inject(DestroyRef);
  private readonly selection = inject(AlbumSelectionService);
  private readonly stageCanvas = viewChild<ElementRef<HTMLCanvasElement>>('albumStageCanvas');
  private renderer: AlbumStageRenderer | null = null;

  protected readonly normalizedActiveIndex = computed(() =>
    this.normalizeIndex(this.activeIndex(), this.albums().length),
  );

  protected readonly activeAlbum = computed(
    () => this.albums()[this.normalizedActiveIndex()] ?? null,
  );

  protected readonly activeYear = computed(() =>
    this.formatYear(this.activeAlbum()?.releasedAt ?? null),
  );

  protected readonly activeCoverBackground = computed(() => {
    const coverAssetId = this.activeAlbum()?.coverAssetId;

    return coverAssetId ? `url("${this.assetUrl(coverAssetId)}")` : 'none';
  });

  protected readonly cards = computed<AlbumFanCard[]>(() => {
    const albums = this.albums();
    const count = albums.length;

    if (count === 0) {
      return [];
    }

    const activeIndex = this.normalizedActiveIndex();
    const position = activeIndex + this.dragProgress();

    return albums.map((album, index) => {
      const offset = this.circularOffset(index, position, count);
      const absoluteOffset = Math.abs(offset);
      const x = this.horizontalOffset(offset);

      return {
        album,
        index,
        x,
        y: `${(absoluteOffset * 18).toFixed(2)}px`,
        depth: `${(-absoluteOffset * 155).toFixed(2)}px`,
        rotateY: `${(-offset * 12).toFixed(2)}deg`,
        rotateZ: `${(offset * 3.25).toFixed(2)}deg`,
        scale: Math.max(0.6, 1 - absoluteOffset * 0.14),
        opacity: Math.max(0, 1 - absoluteOffset * 0.20),
        zIndex: 100 - Math.round(absoluteOffset * 10),
        visible: absoluteOffset <= 3.2,
        active: index === activeIndex,
      };
    });
  });

  protected readonly showDots = computed(() => this.albums().length <= 12);

  constructor() {
    // The accessible cover carousel renders in SSR; WebGL is a progressive enhancement.
    afterNextRender(() => {
      if (typeof window.WebGLRenderingContext !== 'undefined') {
        void this.initializeStage();
      }
    });
    effect(() => {
      this.renderer?.setAlbum(this.activeAlbum()?.coverAssetId ?? null);
    });
    this.destroyRef.onDestroy(() => {
      this.renderer?.dispose();
      this.renderer = null;
    });
  }

  ngOnInit(): void {
    const index = this.albums().findIndex((album) => album.slug === this.selection.selectedSlug);
    if (index >= 0) this.activeIndex.set(index);
  }

  private setSelection(index: number): void {
    const normalized = this.normalizeIndex(index, this.albums().length);
    this.activeIndex.set(normalized);
    this.dragProgress.set(0);
    const album = this.albums()[normalized];
    if (album) this.selection.selectedSlug = album.slug;
  }

  private async initializeStage(): Promise<void> {
    const canvas = this.stageCanvas()?.nativeElement;
    if (!canvas) return;
    let stage: AlbumStageRenderer | null = null;
    try {
      const { AlbumStageRenderer } = await import('./album-stage-renderer');
      if (this.destroyRef.destroyed) return;
      stage = new AlbumStageRenderer(
        canvas,
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        () => this.webglReady.set(false),
      );
      this.renderer = stage;
      stage.setAlbum(this.activeAlbum()?.coverAssetId ?? null);
      this.webglReady.set(true);
    } catch {
      stage?.dispose();
      this.renderer = null;
      this.webglReady.set(false);
    }
  }

  private pointerId: number | null = null;
  private pointerStartX = 0;
  private pointerLastX = 0;
  private pointerLastTime = 0;
  private pointerVelocity = 0;
  private dragMoved = false;
  private suppressNextCardClick = false;
  private wheelCooldownUntil = 0;

  protected assetUrl(assetId: string): string {
    return `/api/assets/${assetId}`;
  }

  protected prepareOpening(event: MouseEvent): void {
    const target = event.currentTarget;
    const fan = target instanceof Element ? target.closest('.album-fan') : null;
    const cover = fan?.querySelector('.album-fan__card.is-active img') ?? null;
    prepareBookletPortal(cover ?? (target instanceof Element ? target : null));
  }

  protected previous(): void {
    this.step(-1);
  }

  protected next(): void {
    this.step(1);
  }

  protected selectAlbum(index: number): void {
    if (this.suppressNextCardClick) {
      this.suppressNextCardClick = false;

      return;
    }

    this.setSelection(index);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.albums().length < 2) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;

    if (target?.closest('[data-fan-control]')) {
      return;
    }

    const stage = event.currentTarget;

    if (!(stage instanceof HTMLElement)) {
      return;
    }

    this.pointerId = event.pointerId;
    this.pointerStartX = event.clientX;
    this.pointerLastX = event.clientX;
    this.pointerLastTime = event.timeStamp;
    this.pointerVelocity = 0;
    this.dragMoved = false;
    this.isDragging.set(true);
    stage.setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    const hoveredStage = event.currentTarget;
    if (hoveredStage instanceof HTMLElement && event.pointerType === 'mouse') {
      this.renderer?.setPointer(event.clientX, event.clientY, hoveredStage.getBoundingClientRect());
    }

    if (event.pointerId !== this.pointerId) {
      return;
    }

    const stage = event.currentTarget;

    if (!(stage instanceof HTMLElement)) {
      return;
    }

    const delta = this.pointerStartX - event.clientX;
    const dragDistance = Math.max(140, Math.min(stage.clientWidth * 0.22, 220));
    const elapsed = Math.max(event.timeStamp - this.pointerLastTime, 1);

    this.pointerVelocity = (event.clientX - this.pointerLastX) / elapsed;
    this.pointerLastX = event.clientX;
    this.pointerLastTime = event.timeStamp;
    this.dragMoved ||= Math.abs(delta) > 7;

    this.dragProgress.set(this.clamp(delta / dragDistance, -1.15, 1.15));
  }

  protected onPointerLeave(): void {
    this.renderer?.clearPointer();
  }

  protected onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }

    this.releasePointer(event);
    this.finishDrag();
  }

  protected onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }

    this.releasePointer(event);
    this.isDragging.set(false);
    this.dragProgress.set(0);
  }

  protected onWheel(event: WheelEvent): void {
    if (this.albums().length < 2) {
      return;
    }

    const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const shiftedVerticalIntent = event.shiftKey && Math.abs(event.deltaY) >= Math.abs(event.deltaX);

    if (!horizontalIntent && !shiftedVerticalIntent) {
      return;
    }

    const delta = shiftedVerticalIntent ? event.deltaY : event.deltaX;

    if (Math.abs(delta) < 8 || event.timeStamp < this.wheelCooldownUntil) {
      return;
    }

    event.preventDefault();
    this.wheelCooldownUntil = event.timeStamp + 260;
    this.step(delta > 0 ? 1 : -1);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previous();

      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();

      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.setSelection(0);

      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.setSelection(Math.max(0, this.albums().length - 1));
    }
  }

  private step(direction: -1 | 1): void {
    const count = this.albums().length;

    if (count < 2) {
      return;
    }

    this.setSelection(this.normalizedActiveIndex() + direction);
  }

  private releasePointer(event: PointerEvent): void {
    const stage = event.currentTarget;

    if (stage instanceof HTMLElement && stage.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }

    this.pointerId = null;
  }

  private finishDrag(): void {
    const progress = this.dragProgress();
    const velocity = this.pointerVelocity;
    let direction: -1 | 0 | 1 = 0;

    if (progress > 0.22 || velocity < -0.45) {
      direction = 1;
    } else if (progress < -0.22 || velocity > 0.45) {
      direction = -1;
    }

    this.isDragging.set(false);

    if (direction !== 0) {
      this.setSelection(this.normalizedActiveIndex() + direction);
    }

    this.dragProgress.set(0);
    this.suppressNextCardClick = this.dragMoved;

    if (this.suppressNextCardClick) {
      window.setTimeout(() => {
        this.suppressNextCardClick = false;
      }, 0);
    }
  }

  private circularOffset(index: number, position: number, count: number): number {
    if (count <= 1) {
      return 0;
    }

    let offset = index - position;
    const half = count / 2;

    while (offset > half) {
      offset -= count;
    }

    while (offset < -half) {
      offset += count;
    }

    return offset;
  }

  private horizontalOffset(offset: number): string {
    const absoluteOffset = Math.abs(offset);

    if (absoluteOffset < 0.001) {
      return '0px';
    }

    const minimum = 92 * absoluteOffset;
    const preferred = 13 * offset;
    const maximum = 190 * absoluteOffset;

    if (offset > 0) {
      return `clamp(${minimum.toFixed(2)}px, ${preferred.toFixed(3)}vw, ${maximum.toFixed(2)}px)`;
    }

    return `clamp(${(-maximum).toFixed(2)}px, ${preferred.toFixed(3)}vw, ${(-minimum).toFixed(2)}px)`;
  }

  private formatYear(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const year = Number(value.slice(0, 4));

    return Number.isInteger(year) ? String(year) : null;
  }

  private normalizeIndex(index: number, count: number): number {
    if (count <= 0) {
      return 0;
    }

    return ((index % count) + count) % count;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }
}
