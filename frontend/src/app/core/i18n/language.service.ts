import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  PLATFORM_ID,
  REQUEST,
  inject,
} from '@angular/core';
import { Store } from '@ngxs/store';
import { Observable, catchError, map, of } from 'rxjs';

import { LocalStorageService } from '../storage/local-storage.service';
import { SetLanguage } from './i18n.actions';
import { I18nState } from './i18n.state';
import {
  DEFAULT_LANGUAGE,
  type Language,
  isLanguage,
} from './i18n.types';

const LANGUAGE_STORAGE_KEY = 'language';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private readonly store = inject(Store);
  private readonly storage = inject(LocalStorageService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly request = inject(REQUEST, {
    optional: true,
  });

  readonly language$ = this.store.select(I18nState.language);

  initialize(): Observable<void> {
    return this.activateLanguage(this.resolveInitialLanguage(), false).pipe(
      catchError(() => of(undefined)),
    );
  }

  setLanguage(language: Language): Observable<void> {
    return this.activateLanguage(language, true);
  }

  private activateLanguage(
    language: Language,
    persist: boolean,
  ): Observable<void> {
    if (persist) {
      this.storage.set(LANGUAGE_STORAGE_KEY, language);
    }

    this.document.documentElement.lang = language;

    return this.store.dispatch(new SetLanguage(language)).pipe(
      map(() => undefined),
    );
  }

  private resolveInitialLanguage(): Language {
    const storedLanguage = this.storage.get<unknown>(LANGUAGE_STORAGE_KEY);

    if (isLanguage(storedLanguage)) {
      return storedLanguage;
    }

    const requestLanguage = this.request?.headers.get('accept-language');

    if (requestLanguage) {
      return this.fromLocale(requestLanguage);
    }

    if (this.isBrowser && typeof navigator !== 'undefined') {
      return this.fromLocale(navigator.languages[0] ?? navigator.language);
    }

    return DEFAULT_LANGUAGE;
  }

  private fromLocale(locale: string): Language {
    const primaryLocale = locale.split(',')[0]?.trim().toLowerCase() ?? '';

    return primaryLocale.startsWith('en') ? 'en' : DEFAULT_LANGUAGE;
  }
}
