import type {
  BlogComment,
} from '@shared/blog/blog-comment';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InjectRepository,
} from '@nestjs/typeorm';
import {
  Repository,
} from 'typeorm';

import { CommunityEventService } from '../community/community-event.service';
import { CommunityProfileCustomizationService } from '../community/community-profile-customization.service';
import { CommunityService } from '../community/community.service';
import { BlogCommentEntry } from './entities/blog-comment.entry';
import { BlogPostEntry } from './entities/blog-post.entry';

@Injectable()
export class BlogCommentService {
  private readonly logger =
    new Logger(BlogCommentService.name);

  constructor(
    @InjectRepository(
      BlogCommentEntry,
    )
    private readonly comments:
      Repository<BlogCommentEntry>,
    @InjectRepository(
      BlogPostEntry,
    )
    private readonly posts:
      Repository<BlogPostEntry>,
    private readonly community:
      CommunityService,
    private readonly customization:
      CommunityProfileCustomizationService,
    private readonly communityEvents:
      CommunityEventService,
  ) {}

  async getComments(
    slug: string,
  ): Promise<BlogComment[]> {
    const post =
      await this.getPublishedPost(slug);
    const comments =
      await this.comments.find({
        where: {
          postUuid: post.uuid,
        },
        relations: {
          user: true,
        },
        order: {
          createdAt: 'ASC',
        },
      });
    const colors =
      await this.loadProfileColors(
        comments.map(
          (comment) => comment.userUuid,
        ),
      );

    return comments.map((comment) =>
      this.mapComment(
        comment,
        colors.get(comment.userUuid) ?? null,
      ),
    );
  }

  async createComment(
    slug: string,
    userUuid: string,
    content: string,
  ): Promise<BlogComment> {
    const normalizedContent =
      content.trim();
    if (normalizedContent.length === 0) {
      throw new BadRequestException(
        'Comment content must not be empty.',
      );
    }

    const [post, profile] =
      await Promise.all([
        this.getPublishedPost(slug),
        this.community.getProfile(
          userUuid,
        ),
      ]);

    if (!profile?.isDiscordMember) {
      throw new ForbiddenException(
        'Only current Discord community members can comment.',
      );
    }

    const comment =
      await this.comments.save(
        this.comments.create({
          postUuid: post.uuid,
          userUuid,
          content: normalizedContent,
        }),
      );
    const saved =
      await this.comments.findOne({
        where: {
          uuid: comment.uuid,
        },
        relations: {
          user: true,
        },
      });

    if (!saved) {
      throw new Error(
        `Blog comment "${comment.uuid}" could not be reloaded.`,
      );
    }

    try {
      await this.communityEvents.recordEvent({
        userUuid,
        type: 'blog.comment.created',
        source: 'website',
        sourceEventId: comment.uuid,
        contextId: post.uuid,
        occurredAt: comment.createdAt,
        contentLength:
          normalizedContent.length,
        metadata: {
          postSlug: post.slug,
        },
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Could not record community event for blog comment ${comment.uuid}: ${this.errorMessage(error)}`,
      );
    }

    const customization =
      await this.customization
        .getCustomization(userUuid);

    return this.mapComment(
      saved,
      customization.selectedProfileColor,
    );
  }

  private async getPublishedPost(
    slug: string,
  ): Promise<BlogPostEntry> {
    const post =
      await this.posts.findOneBy({
        slug,
        status: 'published',
      });

    if (!post) {
      throw new NotFoundException(
        'The blog post does not exist or is not published.',
      );
    }

    return post;
  }

  private async loadProfileColors(
    userUuids: readonly string[],
  ): Promise<Map<string, string | null>> {
    const uniqueUserUuids = [
      ...new Set(userUuids),
    ];
    const entries = await Promise.all(
      uniqueUserUuids.map(
        async (userUuid) => {
          try {
            const customization =
              await this.customization
                .getCustomization(userUuid);

            return [
              userUuid,
              customization.selectedProfileColor,
            ] as const;
          } catch {
            return [
              userUuid,
              null,
            ] as const;
          }
        },
      ),
    );

    return new Map(entries);
  }

  private mapComment(
    comment: BlogCommentEntry,
    profileColor: string | null,
  ): BlogComment {
    return {
      id: comment.uuid,
      postId: comment.postUuid,
      content: comment.content,
      author: {
        displayName: comment.user.name,
        profileColor,
      },
      createdAt:
        comment.createdAt.toISOString(),
      updatedAt:
        comment.updatedAt.toISOString(),
    };
  }

  private errorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
