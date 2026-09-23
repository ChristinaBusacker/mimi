import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngxs/store';

import {
  type BlogLandingData,
  BlogPublicService,
} from '../../core/blog/blog-public.service';
import { I18nState } from '../../core/i18n/i18n.state';

export const blogDataResolver:
  ResolveFn<BlogLandingData> =
    () => {
      const store = inject(Store);
      const blog =
        inject(BlogPublicService);
      const locale =
        store.selectSnapshot(
          I18nState.language,
        );

      return blog.getLanding(
        locale,
      );
    };
