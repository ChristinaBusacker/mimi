import {
  Directive,
  ElementRef,
  HostListener,
  inject,
} from '@angular/core';

import {
  LightboxService,
  type LightboxItem,
} from './lightbox.service';

@Directive({
  selector: '[appLightbox]',
})
export class LightboxDirective {
  private readonly element =
    inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly lightbox =
    inject(LightboxService);

  @HostListener('click', ['$event'])
  protected open(event: MouseEvent): void {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const clickedImage =
      target.closest('img') ??
      target
        .closest('[data-lightbox-item]')
        ?.querySelector('img');

    if (
      !clickedImage ||
      !this.element.nativeElement.contains(
        clickedImage,
      )
    ) {
      return;
    }

    const items = this.collectItems();

    if (items.length === 0) {
      return;
    }

    const clickedSource =
      this.getSource(clickedImage);

    const index = Math.max(
      items.findIndex(
        (item) => item.src === clickedSource,
      ),
      0,
    );

    event.preventDefault();
    this.lightbox.open(items, index);
  }

  private collectItems(): LightboxItem[] {
    const host = this.element.nativeElement;

    const images =
      host.tagName === 'IMG'
        ? [host as HTMLImageElement]
        : Array.from(
            host.querySelectorAll('img'),
          );

    const seen = new Set<string>();
    const items: LightboxItem[] = [];

    for (const image of images) {
      const src = this.getSource(image);

      if (!src || seen.has(src)) {
        continue;
      }

      seen.add(src);
      items.push({
        src,
        alt: image.alt,
      });
    }

    return items;
  }

  private getSource(
    image: HTMLImageElement,
  ): string {
    return (
      image.dataset['lightboxSrc'] ??
      image.currentSrc ??
      image.src
    );
  }
}
