import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngxs/store';
import { map } from 'rxjs';

import { LoadTwitchStatus } from '../../core/twitch/twitch.actions';
import { LoadYouTubeVideos } from '../../core/youtube/youtube.actions';

export const homeDataResolver: ResolveFn<void> = () =>
  inject(Store)
    .dispatch([
      new LoadTwitchStatus(),
      new LoadYouTubeVideos(),
    ])
    .pipe(map(() => undefined));
