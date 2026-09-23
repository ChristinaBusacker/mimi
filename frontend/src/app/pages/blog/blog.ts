import type {
  BlogPostSummary,
} from '@shared/blog/blog';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
  distinctUntilChanged,
  of,
  switchMap,
} from 'rxjs';

import { Hero } from '../../components/hero/hero';
import { Icon } from '../../components/icon/icon';
import {
  type BlogLandingData,
  BlogPublicService,
} from '../../core/blog/blog-public.service';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { I18nState } from '../../core/i18n/i18n.state';
import type { Language } from '../../core/i18n/i18n.types';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Hero,
    Icon,
    I18nPipe,
    RouterLink,
  ],
  selector: 'app-blog',
  styleUrl: './blog.scss',
  templateUrl: './blog.html',
})
export class Blog {
  private readonly route =
    inject(ActivatedRoute);
  private readonly store =
    inject(Store);
  private readonly blog =
    inject(BlogPublicService);

  private readonly initialData =
    this.route.snapshot.data[
      'data'
    ] as BlogLandingData;

  private readonly language =
    this.store.selectSignal(
      I18nState.language,
    );

  protected readonly data = toSignal(
    toObservable(
      this.language,
    ).pipe(
      distinctUntilChanged(),
      switchMap((locale) =>
        locale ===
        this.initialData.locale
          ? of(this.initialData)
          : this.blog.getLanding(
              locale,
            ),
      ),
    ),
    {
      initialValue:
        this.initialData,
    },
  );

  protected readonly featured =
    computed(
      () =>
        this.data().posts[0] ??
        null,
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

  protected trackPost(
    post: BlogPostSummary,
  ): string {
    return post.id;
  }
}
