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

import { Icon } from '../../../components/icon/icon';
import { RenderedContent } from '../../../components/rendered-content/rendered-content';
import {
  type BlogAuthorPageData,
  BlogPublicService,
} from '../../../core/blog/blog-public.service';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { I18nState } from '../../../core/i18n/i18n.state';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Icon,
    I18nPipe,
    RenderedContent,
    RouterLink,
  ],
  selector:
    'app-blog-author',
  styleUrl:
    './blog-author.scss',
  templateUrl:
    './blog-author.html',
})
export class BlogAuthorPageComponent {
  private readonly route =
    inject(ActivatedRoute);
  private readonly store =
    inject(Store);
  private readonly blog =
    inject(BlogPublicService);

  private readonly initialData =
    this.route.snapshot.data[
      'data'
    ] as BlogAuthorPageData;

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
              this.initialData.page.author.slug &&
            locale ===
              this.initialData.locale
          ) {
            return of(
              this.initialData,
            );
          }

          return this.blog
            .getAuthorPage(
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

  protected imageUrl(
    assetId: string,
    variant:
      | 'thumbnail'
      | 'medium',
  ): string {
    return `/api/assets/${assetId}/image/${variant}/webp`;
  }
}
