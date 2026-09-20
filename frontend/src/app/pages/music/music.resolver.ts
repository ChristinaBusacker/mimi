import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngxs/store';

import { I18nState } from '../../core/i18n/i18n.state';
import {
  type MusicLandingData,
  MusicPublicService,
} from '../../core/music/music-public.service';

export const musicDataResolver: ResolveFn<MusicLandingData> =
  () => {
    const store = inject(Store);
    const music = inject(MusicPublicService);
    const locale =
      store.selectSnapshot(I18nState.language);

    return music.getLanding(locale);
  };
