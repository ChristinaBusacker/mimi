import type {
  BlogAuthor,
  BlogAuthorPage,
  BlogCategory,
  BlogPost,
  BlogPostSummary,
} from '@shared/blog/blog';

import {
  Injectable,
  inject,
} from '@angular/core';
import {
  Observable,
  forkJoin,
  map,
} from 'rxjs';

import type { Language } from '../i18n/i18n.types';
import { RequestService } from '../http/request.service';

export interface BlogLandingData {
  locale: Language;
  posts: BlogPostSummary[];
  authors: BlogAuthor[];
  categories: BlogCategory[];
}

export interface BlogPostPageData {
  locale: Language;
  post: BlogPost;
}

export interface BlogAuthorPageData {
  locale: Language;
  page: BlogAuthorPage;
}

@Injectable({
  providedIn: 'root',
})
export class BlogPublicService {
  private readonly request =
    inject(RequestService);

  getLanding(
    locale: Language,
    author?: string | null,
    category?: string | null,
  ): Observable<BlogLandingData> {
    return forkJoin({
      posts:
        this.getPosts(
          locale,
          author,
          category,
        ),
      authors:
        this.getAuthors(),
      categories:
        this.getCategories(
          locale,
        ),
    }).pipe(
      map((data) => ({
        locale,
        ...data,
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

  getAuthorPage(
    slug: string,
    locale: Language,
  ): Observable<BlogAuthorPageData> {
    return this.request.get<
      BlogAuthorPage
    >(
      `/blog/authors/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
    ).pipe(
      map((page) => ({
        locale,
        page,
      })),
    );
  }

  getPosts(
    locale: Language,
    author?: string | null,
    category?: string | null,
  ): Observable<BlogPostSummary[]> {
    const params =
      new URLSearchParams({
        locale,
      });

    if (author) {
      params.set(
        'author',
        author,
      );
    }

    if (category) {
      params.set(
        'category',
        category,
      );
    }

    return this.request.get<
      BlogPostSummary[]
    >(
      `/blog/posts?${params.toString()}`,
    );
  }

  getAuthors():
    Observable<BlogAuthor[]> {
    return this.request.get<
      BlogAuthor[]
    >('/blog/authors');
  }

  getCategories(
    locale: Language,
  ): Observable<BlogCategory[]> {
    return this.request.get<
      BlogCategory[]
    >(
      `/blog/categories?locale=${encodeURIComponent(locale)}`,
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
