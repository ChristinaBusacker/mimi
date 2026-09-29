import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideStore } from '@ngxs/store';

import { routes } from './app.routes';
import { AuthState } from './core/auth/auth.state';
import { EventStreamService } from './core/events/event-stream.service';
import { I18nState } from './core/i18n/i18n.state';
import { LanguageService } from './core/i18n/language.service';
import { SeoService } from './core/seo/seo.service';
import { TwitchState } from './core/twitch/twitch.state';
import { YouTubeState } from './core/youtube/youtube.state';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    provideClientHydration(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideStore([
      AuthState,
      I18nState,
      TwitchState,
      YouTubeState,
    ]),
    provideAppInitializer(() => inject(LanguageService).initialize()),
    provideAppInitializer(() => inject(SeoService).initialize()),
    provideAppInitializer(() => inject(EventStreamService).start()),
  ],
};
