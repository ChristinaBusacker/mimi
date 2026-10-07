import type { MusicAlbumSummary } from '@shared/music/music';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../components/icon/icon';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';

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
export class AlbumFan {
  readonly albums = input.required<readonly MusicAlbumSummary[]>();
  protected readonly activeIndex = signal(0);
  protected readonly dragProgress = signal(0);
  protected readonly isDragging = signal(false);

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
        y: `${(absoluteOffset * 13).toFixed(2)}px`,
        depth: `${(-absoluteOffset * 108).toFixed(2)}px`,
        rotateY: `${(-offset * 10).toFixed(2)}deg`,
        rotateZ: `${(offset * 3.25).toFixed(2)}deg`,
        scale: Math.max(0.7, 1 - absoluteOffset * 0.09),
        opacity: Math.max(0, 1 - absoluteOffset * 0.18),
        zIndex: 100 - Math.round(absoluteOffset * 10),
        visible: absoluteOffset <= 3.2,
        active: index === activeIndex,
      };
    });
  });

  protected readonly showDots = computed(() => this.albums().length <= 12);

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

    this.activeIndex.set(this.normalizeIndex(index, this.albums().length));
    this.dragProgress.set(0);
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
      this.activeIndex.set(0);
      this.dragProgress.set(0);

      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.activeIndex.set(Math.max(0, this.albums().length - 1));
      this.dragProgress.set(0);
    }
  }

  private step(direction: -1 | 1): void {
    const count = this.albums().length;

    if (count < 2) {
      return;
    }

    this.activeIndex.set(this.normalizeIndex(this.normalizedActiveIndex() + direction, count));
    this.dragProgress.set(0);
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
      this.activeIndex.set(
        this.normalizeIndex(this.normalizedActiveIndex() + direction, this.albums().length),
      );
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

    const minimum = 78 * absoluteOffset;
    const preferred = 11.5 * offset;
    const maximum = 150 * absoluteOffset;

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
