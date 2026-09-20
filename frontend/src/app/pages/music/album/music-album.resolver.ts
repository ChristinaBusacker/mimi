import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  ResolveFn,
} from '@angular/router';
import { Store } from '@ngxs/store';

import { I18nState } from '../../../core/i18n/i18n.state';
import {
  type MusicAlbumPageData,
  MusicPublicService,
} from '../../../core/music/music-public.service';

export const musicAlbumResolver: ResolveFn<MusicAlbumPageData> =
  (
    route: ActivatedRouteSnapshot,
  ) => {
    const store = inject(Store);
    const music =
      inject(MusicPublicService);
    const locale =
      store.selectSnapshot(
        I18nState.language,
      );
    const slug =
      route.paramMap.get('slug');

    if (!slug) {
      throw new Error(
        'Music album slug is missing.',
      );
    }

    return music.getAlbumPage(
      slug,
      locale,
    );
  };
