import { HTTP_TRANSFER_CACHE_ORIGIN_MAP } from '@angular/common/http';
import {
  ApplicationConfig,
  REQUEST,
  inject,
  mergeApplicationConfig,
} from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_BASE_URL } from './core/http/api-base-url.token';

const internalApiBaseUrl =
  process.env['MIMI_API_INTERNAL_URL'] ?? 'http://127.0.0.1:3000/api';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: API_BASE_URL,
      useValue: internalApiBaseUrl,
    },
    {
      provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP,
      useFactory: (): Record<string, string> => {
        const request = inject(REQUEST, {
          optional: true,
        });

        if (!request) {
          return {};
        }

        return {
          [new URL(internalApiBaseUrl).origin]: new URL(request.url).origin,
        };
      },
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
