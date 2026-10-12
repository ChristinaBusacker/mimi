import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { prepareBookletPortal } from '../../core/navigation/booklet-transition';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, RouterLink],
  selector: 'app-booklet-navigation',
  styleUrl: './booklet-navigation.scss',
  templateUrl: './booklet-navigation.html',
})
export class BookletNavigation {
  protected prepareReturn(): void {
    prepareBookletPortal(document.querySelector('.booklet__cover img'));
  }
}
