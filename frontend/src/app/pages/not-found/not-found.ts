import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  RESPONSE_INIT,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nPipe } from '../../core/i18n/i18n.pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, RouterLink],
  selector: 'app-not-found-page',
  styleUrl: './not-found.scss',
  templateUrl: './not-found.html',
})
export class NotFoundPage {
  private readonly responseInit = inject(RESPONSE_INIT, {
    optional: true,
  });

  constructor() {
    if (this.responseInit) {
      this.responseInit.status = 404;
    }
  }
}
