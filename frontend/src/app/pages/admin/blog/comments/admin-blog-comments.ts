import type {
  BlogAdminComment,
} from '@shared/blog/blog-comment';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdminBlogService } from '../../../../core/blog/admin-blog.service';
import { I18nPipe } from '../../../../core/i18n/i18n.pipe';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    I18nPipe,
    RouterLink,
  ],
  selector:
    'app-admin-blog-comments',
  styleUrl:
    './admin-blog-comments.scss',
  templateUrl:
    './admin-blog-comments.html',
})
export class AdminBlogComments
  implements OnInit
{
  private readonly blog =
    inject(AdminBlogService);

  protected readonly comments =
    signal<BlogAdminComment[]>([]);
  protected readonly loading =
    signal(true);
  protected readonly error =
    signal(false);
  protected readonly busyId =
    signal<string | null>(null);
  protected readonly confirmingId =
    signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected formatDate(
    value: string,
  ): string {
    return new Intl.DateTimeFormat(
      'de-DE',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    ).format(new Date(value));
  }

  protected async setHidden(
    comment: BlogAdminComment,
  ): Promise<void> {
    await this.run(
      comment.id,
      () =>
        this.blog.setCommentHidden(
          comment.id,
          !comment.hidden,
        ),
    );
  }

  protected async setFeatured(
    comment: BlogAdminComment,
  ): Promise<void> {
    await this.run(
      comment.id,
      () =>
        this.blog.setCommentFeatured(
          comment.id,
          !comment.featured,
        ),
    );
  }

  protected async deleteComment(
    comment: BlogAdminComment,
  ): Promise<void> {
    this.busyId.set(comment.id);
    this.error.set(false);

    try {
      await firstValueFrom(
        this.blog.deleteComment(
          comment.id,
        ),
      );
      this.confirmingId.set(null);
      this.comments.update(
        (comments) =>
          comments.filter(
            (candidate) =>
              candidate.id !==
              comment.id,
          ),
      );
    } catch {
      this.error.set(true);
    } finally {
      this.busyId.set(null);
    }
  }

  private async run(
    id: string,
    action: () => ReturnType<
      AdminBlogService['setCommentHidden']
    >,
  ): Promise<void> {
    this.busyId.set(id);
    this.error.set(false);

    try {
      const updated =
        await firstValueFrom(action());
      this.comments.update(
        (comments) =>
          comments.map((comment) =>
            comment.id === updated.id
              ? updated
              : comment,
          ),
      );
    } catch {
      this.error.set(true);
    } finally {
      this.busyId.set(null);
    }
  }

  private async reload():
    Promise<void> {
    this.loading.set(true);
    this.error.set(false);

    try {
      this.comments.set(
        await firstValueFrom(
          this.blog.getComments(),
        ),
      );
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
