import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import { take } from 'rxjs';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { I18nState } from '../../core/i18n/i18n.state';
import type { Language } from '../../core/i18n/i18n.types';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, RouterLink],
  selector: 'app-footer',
  styleUrl: './footer.scss',
  templateUrl: './footer.html',
})
export class Footer {
  private readonly store = inject(Store);
  private readonly languageService = inject(LanguageService);

  protected readonly language = this.store.selectSignal(I18nState.language);

  protected setLanguage(language: Language): void {
    if (this.language() === language) {
      return;
    }

    this.languageService
      .setLanguage(language)
      .pipe(take(1))
      .subscribe();
  }
}
