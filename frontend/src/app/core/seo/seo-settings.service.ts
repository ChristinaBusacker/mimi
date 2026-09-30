import type {
  SeoLocale,
  SeoPageOverride,
  SeoStaticPageKey,
} from '@shared/seo/seo';

import {
  Injectable,
  inject,
} from '@angular/core';
import {
  catchError,
  firstValueFrom,
  of,
  timeout,
} from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class SeoSettingsService {
  private readonly request =
    inject(RequestService);
  private readonly pages =
    new Map<string, SeoPageOverride>();

  async load(): Promise<void> {
    const pages = await firstValueFrom(
      this.request
        .get<SeoPageOverride[]>(
          '/seo/pages',
          {
            deduplicateAcrossTabs: false,
            transferCache: true,
          },
        )
        .pipe(
          timeout(2000),
          catchError(() =>
            of<SeoPageOverride[]>([]),
          ),
        ),
    );

    this.pages.clear();

    for (const page of pages) {
      this.pages.set(
        this.key(page.pageKey, page.locale),
        page,
      );
    }
  }

  get(
    pageKey: SeoStaticPageKey,
    locale: SeoLocale,
  ): SeoPageOverride | null {
    return (
      this.pages.get(
        this.key(pageKey, locale),
      ) ?? null
    );
  }

  private key(
    pageKey: SeoStaticPageKey,
    locale: SeoLocale,
  ): string {
    return `${pageKey}:${locale}`;
  }
}
