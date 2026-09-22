import { Directive } from '@angular/core';

@Directive({
  selector: '[carouselSlide]',
  host: {
    class: 'glide__slide',
  },
})
export class CarouselSlide {}
