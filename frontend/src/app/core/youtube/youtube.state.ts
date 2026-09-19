import { Injectable, inject } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { EMPTY, Observable, catchError, tap } from 'rxjs';

import type { YouTubeVideo } from '@shared/youtube/youtube-video';

import { RequestService } from '../http/request.service';
import { LoadYouTubeVideos } from './youtube.actions';

interface YouTubeStateModel {
  videos: YouTubeVideo[];
}

@State<YouTubeStateModel>({
  name: 'youtube',
  defaults: {
    videos: [],
  },
})
@Injectable()
export class YouTubeState {
  private readonly request = inject(RequestService);

  @Selector()
  static videos(state: YouTubeStateModel): YouTubeVideo[] {
    return state.videos;
  }

  @Action(LoadYouTubeVideos, {
    cancelUncompleted: true,
  })
  loadVideos(
    context: StateContext<YouTubeStateModel>,
  ): Observable<YouTubeVideo[]> {
    return this.request.get<YouTubeVideo[]>('/youtube/videos').pipe(
      tap((videos) => {
        context.patchState({
          videos,
        });
      }),
      catchError(() => EMPTY),
    );
  }
}
