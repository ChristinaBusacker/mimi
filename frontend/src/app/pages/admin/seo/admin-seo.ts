import type { Asset } from '@shared/assets/asset';
import type {
  SeoLocale,
  SeoPageOverride,
  SeoStaticPageKey,
} from '@shared/seo/seo';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';

import { Button } from '../../../components/button/button';
import { AdminAssetsService } from '../../../core/assets/admin-assets.service';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { AdminSeoService } from '../../../core/seo/admin-seo.service';
import { STATIC_SEO_COPY } from '../../../core/seo/seo.service';

const SEO_STATIC_PAGE_KEYS: readonly SeoStaticPageKey[] = [
  'home',
  'gaming',
  'music',
  'blog',
  'videos',
  'community',
  'contact',
  'support',
  'legalNotice',
  'privacy',
];

const SEO_LOCALES: readonly SeoLocale[] = [
  'de',
  'en',
];

type EditableTextField =
  | 'title'
  | 'description'
  | 'socialTitle'
  | 'socialDescription'
  | 'socialImageAlt';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    I18nPipe,
  ],
  selector: 'app-admin-seo',
  styleUrl: './admin-seo.scss',
  templateUrl: './admin-seo.html',
})
export class AdminSeo {
  private readonly seo =
    inject(AdminSeoService);
  private readonly assets =
    inject(AdminAssetsService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly errorKey =
    signal<string | null>(null);
  protected readonly images =
    signal<Asset[]>([]);
  protected readonly pages =
    signal<SeoPageOverride[]>(
      this.createEmptyPages(),
    );

  protected readonly pageKeys =
    SEO_STATIC_PAGE_KEYS;
  protected readonly locales =
    SEO_LOCALES;

  constructor() {
    void this.load();
  }

  protected page(
    pageKey: SeoStaticPageKey,
    locale: SeoLocale,
  ): SeoPageOverride {
    const page = this.pages().find(
      (candidate) =>
        candidate.pageKey === pageKey &&
        candidate.locale === locale,
    );

    if (!page) {
      throw new Error(
        `SEO editor row "${pageKey}:${locale}" is missing.`,
      );
    }

    return page;
  }

  protected effectiveTitle(
    page: SeoPageOverride,
  ): string {
    return (
      page.socialTitle?.trim() ||
      page.title?.trim() ||
      STATIC_SEO_COPY[page.locale][page.pageKey].title
    );
  }

  protected effectiveDescription(
    page: SeoPageOverride,
  ): string {
    return (
      page.socialDescription?.trim() ||
      page.description?.trim() ||
      STATIC_SEO_COPY[page.locale][page.pageKey].description
    );
  }

  protected socialImageUrl(
    assetId: string,
  ): string {
    return `/api/assets/${encodeURIComponent(assetId)}/image/social/fallback`;
  }

  protected setText(
    pageKey: SeoStaticPageKey,
    locale: SeoLocale,
    field: EditableTextField,
    event: Event,
  ): void {
    const target = event.target;

    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    const value = target.value.trim()
      ? target.value
      : null;

    this.updatePage(
      pageKey,
      locale,
      {
        [field]: value,
      },
    );
  }

  protected setImage(
    pageKey: SeoStaticPageKey,
    locale: SeoLocale,
    event: Event,
  ): void {
    const target = event.target;

    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    this.updatePage(
      pageKey,
      locale,
      {
        socialImageAssetId:
          target.value || null,
      },
    );
  }

  protected async save(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.errorKey.set(null);

    try {
      const pages = await firstValueFrom(
        this.seo.savePages({
          pages: this.pages().map((page) => ({
            ...page,
            title: this.normalize(page.title),
            description:
              this.normalize(page.description),
            socialTitle:
              this.normalize(page.socialTitle),
            socialDescription:
              this.normalize(
                page.socialDescription,
              ),
            socialImageAlt:
              this.normalize(page.socialImageAlt),
          })),
        }),
      );

      this.pages.set(
        this.mergePages(pages),
      );
      this.saved.set(true);
    } catch {
      this.errorKey.set(
        'admin.seo.saveFailed',
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected pageLabelKey(
    pageKey: SeoStaticPageKey,
  ): string {
    return `admin.seo.pages.${pageKey}`;
  }

  private async load(): Promise<void> {
    try {
      const result = await firstValueFrom(
        forkJoin({
          pages: this.seo.getPages(),
          images: this.assets.getAll('image'),
        }),
      );

      this.pages.set(
        this.mergePages(result.pages),
      );
      this.images.set(result.images);
    } catch {
      this.errorKey.set(
        'admin.seo.loadFailed',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private createEmptyPages(): SeoPageOverride[] {
    return SEO_STATIC_PAGE_KEYS.flatMap(
      (pageKey) =>
        SEO_LOCALES.map((locale) => ({
          pageKey,
          locale,
          title: null,
          description: null,
          socialTitle: null,
          socialDescription: null,
          socialImageAssetId: null,
          socialImageAlt: null,
        })),
    );
  }

  private mergePages(
    savedPages: readonly SeoPageOverride[],
  ): SeoPageOverride[] {
    const saved = new Map(
      savedPages.map((page) => [
        `${page.pageKey}:${page.locale}`,
        page,
      ]),
    );

    return this.createEmptyPages().map(
      (page) =>
        saved.get(
          `${page.pageKey}:${page.locale}`,
        ) ?? page,
    );
  }

  private updatePage(
    pageKey: SeoStaticPageKey,
    locale: SeoLocale,
    patch: Partial<SeoPageOverride>,
  ): void {
    this.saved.set(false);
    this.pages.update((pages) =>
      pages.map((page) =>
        page.pageKey === pageKey &&
        page.locale === locale
          ? {
              ...page,
              ...patch,
            }
          : page,
      ),
    );
  }

  private normalize(
    value: string | null,
  ): string | null {
    const normalized = value?.trim() ?? '';

    return normalized || null;
  }
}
