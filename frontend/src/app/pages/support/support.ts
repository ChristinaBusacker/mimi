import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Hero } from '../../components/hero/hero';
import { I18nPipe } from '../../core/i18n/i18n.pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, Hero, I18nPipe],
  selector: 'app-support',
  styleUrl: './support.scss',
  templateUrl: './support.html',
})
export class Support {}
