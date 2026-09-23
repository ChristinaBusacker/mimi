import {
  inject,
} from '@angular/core';
import type {
  ActivatedRouteSnapshot,
  ResolveFn,
} from '@angular/router';
import { Store } from '@ngxs/store';

import {
  type BlogAuthorPageData,
  BlogPublicService,
} from '../../../core/blog/blog-public.service';
import { I18nState } from '../../../core/i18n/i18n.state';

export const blogAuthorResolver:
  ResolveFn<BlogAuthorPageData> =
    (
      route:
        ActivatedRouteSnapshot,
    ) => {
      const slug =
        route.paramMap.get(
          'slug',
        );

      if (!slug) {
        throw new Error(
          'Blog author slug is missing.',
        );
      }

      const store =
        inject(Store);
      const blog =
        inject(BlogPublicService);

      return blog.getAuthorPage(
        slug,
        store.selectSnapshot(
          I18nState.language,
        ),
      );
    };
