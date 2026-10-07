import type { BlogPostSummary } from '@shared/blog/blog';
import type { CommunityPublicSummary } from '@shared/community/community-public';

import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngxs/store';
import {
  catchError,
  forkJoin,
  map,
  of,
} from 'rxjs';

import { BlogPublicService } from '../../core/blog/blog-public.service';
import { CommunityPublicService } from '../../core/community/community-public.service';
import { I18nState } from '../../core/i18n/i18n.state';
import type { Language } from '../../core/i18n/i18n.types';
import { LoadTwitchStatus } from '../../core/twitch/twitch.actions';
import { LoadYouTubeVideos } from '../../core/youtube/youtube.actions';

export interface HomeData {
  locale: Language;
  posts: BlogPostSummary[];
  community: CommunityPublicSummary | null;
}

export const homeDataResolver: ResolveFn<HomeData> = () => {
  const store = inject(Store);
  const blog = inject(BlogPublicService);
  const community = inject(CommunityPublicService);
  const locale = store.selectSnapshot(I18nState.language);

  return forkJoin({
    bootstrap: store.dispatch([
      new LoadTwitchStatus(),
      new LoadYouTubeVideos(),
    ]),
    posts: blog.getPosts(locale).pipe(
      map((posts) => posts.slice(0, 3)),
      catchError(() => of<BlogPostSummary[]>([])),
    ),
    community: community.getSummary().pipe(
      catchError(() => of(null)),
    ),
  }).pipe(
    map(({ posts, community: communitySummary }) => ({
      locale,
      posts,
      community: communitySummary,
    })),
  );
};
