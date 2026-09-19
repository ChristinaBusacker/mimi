import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

import { I18nPipe } from '../../core/i18n/i18n.pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe],
  selector: 'app-content-page',
  styleUrl: './content-page.scss',
  templateUrl: './content-page.html',
})
export class ContentPage {
  readonly titleKey = input.required<string>();
}
