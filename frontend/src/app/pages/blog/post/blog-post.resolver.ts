import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  ResolveFn,
} from '@angular/router';
import { Store } from '@ngxs/store';

import {
  type BlogPostPageData,
  BlogPublicService,
} from '../../../core/blog/blog-public.service';
import { I18nState } from '../../../core/i18n/i18n.state';

export const blogPostResolver:
  ResolveFn<BlogPostPageData> =
    (
      route:
        ActivatedRouteSnapshot,
    ) => {
      const store = inject(Store);
      const blog =
        inject(BlogPublicService);
      const locale =
        store.selectSnapshot(
          I18nState.language,
        );
      const slug =
        route.paramMap.get('slug');

      if (!slug) {
        throw new Error(
          'Blog post slug is missing.',
        );
      }

      return blog.getPostPage(
        slug,
        locale,
      );
    };
