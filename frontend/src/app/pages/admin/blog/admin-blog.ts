import type {
  BlogAdminAuthor,
  BlogAdminPost,
} from '@shared/blog/blog-admin';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import {
  firstValueFrom,
  forkJoin,
} from 'rxjs';

import { AuthState } from '../../../core/auth/auth.state';
import { AdminBlogService } from '../../../core/blog/admin-blog.service';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    I18nPipe,
    RouterLink,
  ],
  selector: 'app-admin-blog',
  styleUrl: './admin-blog.scss',
  templateUrl: './admin-blog.html',
})
export class AdminBlog
  implements OnInit
{
  private readonly blog =
    inject(AdminBlogService);
  private readonly store =
    inject(Store);

  protected readonly posts =
    signal<BlogAdminPost[]>([]);
  protected readonly authors =
    signal<BlogAdminAuthor[]>([]);
  protected readonly loading =
    signal(true);
  protected readonly error =
    signal(false);
  protected readonly confirmingId =
    signal<string | null>(null);
  protected readonly user =
    this.store.selectSignal(
      AuthState.user,
    );

  protected readonly canCreate =
    computed(() => {
      const user = this.user();

      if (!user) {
        return false;
      }

      return (
        user.role !== 'author' ||
        this.authors().some(
          (author) =>
            author.userId ===
            user.uuid,
        )
      );
    });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected title(
    post: BlogAdminPost,
  ): string {
    return (
      post.translations.de.title ||
      post.slug
    );
  }

  protected authorName(
    authorId: string,
  ): string {
    return (
      this.authors().find(
        (author) =>
          author.userId ===
          authorId,
      )?.displayName ??
      authorId
    );
  }

  protected canModify(
    post: BlogAdminPost,
  ): boolean {
    const user = this.user();

    return (
      user?.role !== 'author' ||
      (
        post.authorId ===
          user.uuid &&
        post.status === 'draft'
      )
    );
  }

  protected async deletePost(
    id: string,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.blog.deletePost(id),
      );
      this.confirmingId.set(null);
      await this.reload();
    } catch {
      this.error.set(true);
    }
  }

  private async reload():
    Promise<void> {
    this.loading.set(true);
    this.error.set(false);

    try {
      const result =
        await firstValueFrom(
          forkJoin({
            posts:
              this.blog.getPosts(),
            authors:
              this.blog.getAuthors(),
          }),
        );

      this.posts.set(
        result.posts,
      );
      this.authors.set(
        result.authors,
      );
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
