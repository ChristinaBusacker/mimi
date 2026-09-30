import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-about',
  template: '<section class="page about-page"></section>',
})
export class About {}
