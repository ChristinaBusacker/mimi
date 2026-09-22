import type { GlideOptions } from '@glidejs/glide';

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  viewChild,
} from '@angular/core';

export type CarouselBreakpoint = Pick<Partial<GlideOptions>, 'gap' | 'peek' | 'perView'>;

export type CarouselBreakpoints = Record<number, CarouselBreakpoint>;

interface GlideInstance {
  destroy(): unknown;
  go(pattern: string): unknown;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-carousel',
  styleUrl: './carousel.scss',
  templateUrl: './carousel.html',
})
export class Carousel {
  readonly perView = input(1);
  readonly gap = input(16);
  readonly peek = input<GlideOptions['peek']>(0);
  readonly breakpoints = input<CarouselBreakpoints>({});
  readonly previousLabel = input.required<string>();
  readonly nextLabel = input.required<string>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');

  private glide: GlideInstance | null = null;

  constructor() {
    afterNextRender(() => {
      void this.mount();
    });

    this.destroyRef.onDestroy(() => {
      this.glide?.destroy();
      this.glide = null;
    });
  }

  protected previous(): void {
    this.glide?.go('<');
  }

  protected next(): void {
    this.glide?.go('>');
  }

  private async mount(): Promise<void> {
    const { default: Glide } = await import('@glidejs/glide');

    this.glide?.destroy();

    this.glide = new Glide(this.root().nativeElement, {
      type: 'carousel',
      perView: this.perView(),
      gap: this.gap(),
      peek: this.peek(),
      keyboard: true,
      animationDuration: 360,
      breakpoints: this.toGlideBreakpoints(this.breakpoints()),
    }).mount();
  }

  private toGlideBreakpoints(breakpoints: CarouselBreakpoints): Record<string, CarouselBreakpoint> {
    return Object.fromEntries(
      Object.entries(breakpoints).map(([width, options]) => [width, options]),
    );
  }
}
