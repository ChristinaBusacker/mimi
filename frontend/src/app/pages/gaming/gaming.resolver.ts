import type {
  GamingLocale,
  GamingNextStream,
} from '@shared/gaming/gaming';

import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngxs/store';

import { GamingService } from '../../core/gaming/gaming.service';
import { I18nState } from '../../core/i18n/i18n.state';

export const gamingDataResolver: ResolveFn<GamingNextStream> =
  () => {
    const store = inject(Store);
    const gaming = inject(GamingService);
    const locale =
      store.selectSnapshot(
        I18nState.language,
      ) as GamingLocale;

    return gaming.getNextStream(locale);
  };
