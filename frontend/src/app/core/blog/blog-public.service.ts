import type {
  BlogPost,
  BlogPostSummary,
} from '@shared/blog/blog';

import {
  Injectable,
  inject,
} from '@angular/core';
import {
  Observable,
  map,
} from 'rxjs';

import type { Language } from '../i18n/i18n.types';
import { RequestService } from '../http/request.service';

export interface BlogLandingData {
  locale: Language;
  posts: BlogPostSummary[];
}

export interface BlogPostPageData {
  locale: Language;
  post: BlogPost;
}

@Injectable({
  providedIn: 'root',
})
export class BlogPublicService {
  private readonly request =
    inject(RequestService);

  getLanding(
    locale: Language,
  ): Observable<BlogLandingData> {
    return this.getPosts(
      locale,
    ).pipe(
      map((posts) => ({
        locale,
        posts,
      })),
    );
  }

  getPostPage(
    slug: string,
    locale: Language,
  ): Observable<BlogPostPageData> {
    return this.getPost(
      slug,
      locale,
    ).pipe(
      map((post) => ({
        locale,
        post,
      })),
    );
  }

  getPosts(
    locale: Language,
  ): Observable<BlogPostSummary[]> {
    return this.request.get<
      BlogPostSummary[]
    >(
      `/blog/posts?locale=${encodeURIComponent(locale)}`,
    );
  }

  getPost(
    slug: string,
    locale: Language,
  ): Observable<BlogPost> {
    return this.request.get<BlogPost>(
      `/blog/posts/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
    );
  }
}
