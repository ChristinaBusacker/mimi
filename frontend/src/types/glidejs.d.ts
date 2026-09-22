declare module '@glidejs/glide' {
  export interface GlideOptions {
    type: 'slider' | 'carousel';
    startAt: number;
    perView: number;
    focusAt: string | number;
    gap: number;
    autoplay: number | false;
    hoverpause: boolean;
    keyboard: boolean;
    bound: boolean;
    swipeThreshold: number | boolean;
    dragThreshold: number | boolean;
    touchRatio: number;
    touchAngle: number;
    animationDuration: number;
    rewind: boolean;
    rewindDuration: number;
    animationTimingFunc: string;
    waitForTransition: boolean;
    throttle: number;
    direction: 'ltr' | 'rtl';
    peek: number | string | {
      before: number;
      after: number;
    };
    breakpoints: Record<string, Partial<GlideOptions>>;
  }

  export default class Glide {
    constructor(
      selector: string | HTMLElement,
      options?: Partial<GlideOptions>,
    );

    mount(): Glide;
    update(settings?: Partial<GlideOptions>): Glide;
    destroy(): Glide;
    go(pattern: string): Glide;

    readonly index: number;
  }
}
