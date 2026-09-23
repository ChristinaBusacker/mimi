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
  Router,
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

import { Hero } from '../../components/hero/hero';
import { Icon } from '../../components/icon/icon';
import {
  type BlogLandingData,
  BlogPublicService,
} from '../../core/blog/blog-public.service';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { I18nState } from '../../core/i18n/i18n.state';
import type { Language } from '../../core/i18n/i18n.types';

interface BlogFilter {
  author: string | null;
  category: string | null;
}

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
  private readonly router =
    inject(Router);
  private readonly store =
    inject(Store);
  private readonly blog =
    inject(BlogPublicService);

  private readonly initialData =
    this.route.snapshot.data[
      'data'
    ] as BlogLandingData;

  private readonly initialFilter:
    BlogFilter = {
      author:
        this.route.snapshot
          .queryParamMap
          .get('autor'),
      category:
        this.route.snapshot
          .queryParamMap
          .get('thema'),
    };

  private readonly language =
    this.store.selectSignal(
      I18nState.language,
    );

  private readonly filterStream =
    this.route.queryParamMap.pipe(
      map((params) => ({
        author:
          params.get('autor'),
        category:
          params.get('thema'),
      })),
      distinctUntilChanged(
        (left, right) =>
          left.author ===
            right.author &&
          left.category ===
            right.category,
      ),
    );

  protected readonly filter =
    toSignal(
      this.filterStream,
      {
        initialValue:
          this.initialFilter,
      },
    );

  protected readonly data = toSignal(
    combineLatest([
      toObservable(
        this.language,
      ).pipe(
        distinctUntilChanged(),
      ),
      this.filterStream,
    ]).pipe(
      switchMap(
        ([locale, filter]) =>
          locale ===
            this.initialData.locale &&
          filter.author ===
            this.initialFilter.author &&
          filter.category ===
            this.initialFilter.category
            ? of(this.initialData)
            : this.blog.getLanding(
                locale,
                filter.author,
                filter.category,
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

  protected setAuthorFilter(
    event: Event,
  ): void {
    const value =
      this.readSelectValue(
        event,
      );

    if (value === null) {
      return;
    }

    void this.setFilter(
      'autor',
      value,
    );
  }

  protected setCategoryFilter(
    event: Event,
  ): void {
    const value =
      this.readSelectValue(
        event,
      );

    if (value === null) {
      return;
    }

    void this.setFilter(
      'thema',
      value,
    );
  }

  private setFilter(
    key:
      | 'autor'
      | 'thema',
    value: string,
  ): Promise<boolean> {
    return this.router.navigate(
      [],
      {
        relativeTo:
          this.route,
        queryParams: {
          [key]:
            value || null,
        },
        queryParamsHandling:
          'merge',
      },
    );
  }

  private readSelectValue(
    event: Event,
  ): string | null {
    return event.target instanceof
      HTMLSelectElement
      ? event.target.value
      : null;
  }
}
