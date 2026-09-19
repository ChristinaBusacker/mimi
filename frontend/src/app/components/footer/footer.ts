import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';

import { I18nPipe } from '../../core/i18n/i18n.pipe';

@Component({
  imports: [AsyncPipe, I18nPipe],
  selector: 'app-footer',
  styleUrl: './footer.scss',
  templateUrl: './footer.html',
})
export class Footer {}
