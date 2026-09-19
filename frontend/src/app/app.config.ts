import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngxs/store';

import { routes } from './app.routes';
import { I18nState } from './core/i18n/i18n.state';
import { LanguageService } from './core/i18n/language.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideStore([I18nState]),
    provideAppInitializer(() => inject(LanguageService).initialize()),
  ],
};
