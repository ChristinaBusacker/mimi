import type {
  BlogAdminAuthor,
  BlogAdminAuthorCandidate,
  BlogAdminCategory,
  BlogAdminPost,
  SaveBlogAdminAuthor,
  SaveBlogAdminCategory,
  SaveBlogAdminPost,
} from '@shared/blog/blog-admin';

import {
  Injectable,
  inject,
} from '@angular/core';
import { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class AdminBlogService {
  private readonly request =
    inject(RequestService);

  getPosts():
    Observable<BlogAdminPost[]> {
    return this.request.get<
      BlogAdminPost[]
    >(
      '/admin/blog/posts',
      this.privateGetOptions(),
    );
  }

  getPost(
    id: string,
  ): Observable<BlogAdminPost> {
    return this.request.get<
      BlogAdminPost
    >(
      `/admin/blog/posts/${id}`,
      this.privateGetOptions(),
    );
  }

  createPost(
    input: SaveBlogAdminPost,
  ): Observable<BlogAdminPost> {
    return this.request.post<
      BlogAdminPost,
      SaveBlogAdminPost
    >(
      '/admin/blog/posts',
      input,
    );
  }

  updatePost(
    id: string,
    input: SaveBlogAdminPost,
  ): Observable<BlogAdminPost> {
    return this.request.patch<
      BlogAdminPost,
      SaveBlogAdminPost
    >(
      `/admin/blog/posts/${id}`,
      input,
    );
  }

  deletePost(
    id: string,
  ): Observable<void> {
    return this.request.delete<void>(
      `/admin/blog/posts/${id}`,
    );
  }

  getAuthors():
    Observable<BlogAdminAuthor[]> {
    return this.request.get<
      BlogAdminAuthor[]
    >(
      '/admin/blog/authors',
      this.privateGetOptions(),
    );
  }

  getAuthorCandidates():
    Observable<BlogAdminAuthorCandidate[]> {
    return this.request.get<
      BlogAdminAuthorCandidate[]
    >(
      '/admin/blog/authors/candidates',
      this.privateGetOptions(),
    );
  }

  saveAuthor(
    userId: string,
    input: SaveBlogAdminAuthor,
  ): Observable<BlogAdminAuthor> {
    return this.request.put<
      BlogAdminAuthor,
      SaveBlogAdminAuthor
    >(
      `/admin/blog/authors/${userId}`,
      input,
    );
  }

  getCategories():
    Observable<BlogAdminCategory[]> {
    return this.request.get<
      BlogAdminCategory[]
    >(
      '/admin/blog/categories',
      this.privateGetOptions(),
    );
  }

  createCategory(
    input:
      SaveBlogAdminCategory,
  ): Observable<BlogAdminCategory> {
    return this.request.post<
      BlogAdminCategory,
      SaveBlogAdminCategory
    >(
      '/admin/blog/categories',
      input,
    );
  }

  updateCategory(
    id: string,
    input:
      SaveBlogAdminCategory,
  ): Observable<BlogAdminCategory> {
    return this.request.patch<
      BlogAdminCategory,
      SaveBlogAdminCategory
    >(
      `/admin/blog/categories/${id}`,
      input,
    );
  }

  deleteCategory(
    id: string,
  ): Observable<void> {
    return this.request.delete<void>(
      `/admin/blog/categories/${id}`,
    );
  }

  private privateGetOptions(): {
    deduplicateAcrossTabs: false;
    transferCache: false;
  } {
    return {
      deduplicateAcrossTabs: false,
      transferCache: false,
    };
  }
}
