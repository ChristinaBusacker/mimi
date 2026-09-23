import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import {
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  RouterLink,
} from '@angular/router';
import { Store } from '@ngxs/store';
import {
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  switchMap,
} from 'rxjs';

import { Hero } from '../../../components/hero/hero';
import { Icon } from '../../../components/icon/icon';
import { RenderedContent } from '../../../components/rendered-content/rendered-content';
import {
  type BlogPostPageData,
  BlogPublicService,
} from '../../../core/blog/blog-public.service';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { I18nState } from '../../../core/i18n/i18n.state';
import type { Language } from '../../../core/i18n/i18n.types';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Hero,
    Icon,
    I18nPipe,
    RenderedContent,
    RouterLink,
  ],
  selector: 'app-blog-post',
  styleUrl: './blog-post.scss',
  templateUrl: './blog-post.html',
})
export class BlogPostPage {
  private readonly route =
    inject(ActivatedRoute);
  private readonly store =
    inject(Store);
  private readonly blog =
    inject(BlogPublicService);

  private readonly initialData =
    this.route.snapshot.data[
      'data'
    ] as BlogPostPageData;

  private readonly language =
    this.store.selectSignal(
      I18nState.language,
    );

  protected readonly data = toSignal(
    combineLatest([
      this.route.paramMap.pipe(
        map((params) =>
          params.get('slug'),
        ),
        distinctUntilChanged(),
      ),
      toObservable(
        this.language,
      ).pipe(
        distinctUntilChanged(),
      ),
    ]).pipe(
      switchMap(
        ([slug, locale]) => {
          if (!slug) {
            return of(
              this.initialData,
            );
          }

          if (
            slug ===
              this.initialData.post.slug &&
            locale ===
              this.initialData.locale
          ) {
            return of(
              this.initialData,
            );
          }

          return this.blog.getPostPage(
            slug,
            locale,
          );
        },
      ),
    ),
    {
      initialValue:
        this.initialData,
    },
  );

  protected imageVariantUrl(
    assetId: string,
    variant:
      | 'thumbnail'
      | 'medium'
      | 'large',
  ): string {
    return `/api/assets/${assetId}/image/${variant}/webp`;
  }

  protected assetUrl(
    assetId: string,
  ): string {
    return `/api/assets/${assetId}`;
  }

  protected formatDate(
    value: string,
    locale: Language,
  ): string {
    return new Intl.DateTimeFormat(
      locale === 'de'
        ? 'de-DE'
        : 'en-US',
      {
        year: 'numeric',
        month: 'long',
        day: '2-digit',
      },
    ).format(
      new Date(value),
    );
  }
}
