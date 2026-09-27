import type {
  BlogAdminComment,
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
  IsNull,
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
          hiddenAt: IsNull(),
        },
        relations: {
          user: true,
        },
        order: {
          createdAt: 'ASC',
        },
      });
    const userUuids = comments.map(
      (comment) => comment.userUuid,
    );
    const [colors, displayNames] =
      await Promise.all([
        this.loadProfileColors(userUuids),
        this.loadDiscordDisplayNames(userUuids),
      ]);

    return comments
      .map((comment) =>
        this.mapComment(
          comment,
          colors.get(comment.userUuid) ?? null,
          displayNames.get(comment.userUuid) ??
            comment.user.name,
        ),
      )
      .sort((left, right) => {
        if (left.featured !== right.featured) {
          return left.featured ? -1 : 1;
        }

        return left.createdAt.localeCompare(
          right.createdAt,
        );
      });
  }


  async getAdminComments():
    Promise<BlogAdminComment[]> {
    const comments =
      await this.comments.find({
        relations: {
          user: true,
          post: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });
    const userUuids = comments.map(
      (comment) => comment.userUuid,
    );
    const [colors, displayNames] =
      await Promise.all([
        this.loadProfileColors(userUuids),
        this.loadDiscordDisplayNames(userUuids),
      ]);

    return comments.map((comment) => ({
      ...this.mapComment(
        comment,
        colors.get(comment.userUuid) ?? null,
        displayNames.get(comment.userUuid) ??
          comment.user.name,
      ),
      postSlug: comment.post.slug,
      hidden: comment.hiddenAt !== null,
    }));
  }

  async setHidden(
    commentUuid: string,
    hidden: boolean,
    moderatorUuid: string,
  ): Promise<BlogAdminComment> {
    const comment =
      await this.getAdminComment(
        commentUuid,
      );

    comment.hiddenAt = hidden
      ? new Date()
      : null;
    comment.hiddenByUserUuid = hidden
      ? moderatorUuid
      : null;

    if (hidden) {
      comment.featuredAt = null;
      comment.featuredByUserUuid = null;
    }

    await this.comments.save(comment);

    return this.mapAdminComment(comment);
  }

  async setFeatured(
    commentUuid: string,
    featured: boolean,
    moderatorUuid: string,
  ): Promise<BlogAdminComment> {
    const comment =
      await this.getAdminComment(
        commentUuid,
      );

    if (featured && comment.hiddenAt) {
      throw new BadRequestException(
        'Hidden comments cannot be featured.',
      );
    }

    const becameFeatured =
      featured && !comment.featuredAt;

    comment.featuredAt = featured
      ? new Date()
      : null;
    comment.featuredByUserUuid = featured
      ? moderatorUuid
      : null;

    await this.comments.save(comment);

    if (becameFeatured) {
      try {
        await this.communityEvents.recordEvent({
          userUuid: comment.userUuid,
          type: 'blog.comment.featured',
          source: 'website',
          sourceEventId:
            `featured:${comment.uuid}`,
          contextId: comment.postUuid,
          occurredAt: comment.featuredAt!,
          metadata: {
            postSlug: comment.post.slug,
            commentId: comment.uuid,
          },
        });
      } catch (error: unknown) {
        this.logger.warn(
          `Could not record featured community event for blog comment ${comment.uuid}: ${this.errorMessage(error)}`,
        );
      }
    }

    return this.mapAdminComment(comment);
  }

  async deleteComment(
    commentUuid: string,
  ): Promise<void> {
    const comment =
      await this.comments.findOneBy({
        uuid: commentUuid,
      });

    if (!comment) {
      throw new NotFoundException(
        `Blog comment "${commentUuid}" not found.`,
      );
    }

    await this.comments.remove(comment);
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
      profile.discordDisplayName ||
        saved.user.name,
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

  private async loadDiscordDisplayNames(
    userUuids: readonly string[],
  ): Promise<Map<string, string | null>> {
    const uniqueUserUuids = [
      ...new Set(userUuids),
    ];
    const entries = await Promise.all(
      uniqueUserUuids.map(
        async (userUuid) => [
          userUuid,
          (
            await this.community.getProfile(
              userUuid,
            )
          )?.discordDisplayName ?? null,
        ] as const,
      ),
    );

    return new Map(entries);
  }

  private mapComment(
    comment: BlogCommentEntry,
    profileColor: string | null,
    displayName: string,
  ): BlogComment {
    return {
      id: comment.uuid,
      postId: comment.postUuid,
      content: comment.content,
      author: {
        displayName,
        profileColor,
      },
      featured: comment.featuredAt !== null,
      createdAt:
        comment.createdAt.toISOString(),
      updatedAt:
        comment.updatedAt.toISOString(),
    };
  }


  private async getAdminComment(
    commentUuid: string,
  ): Promise<BlogCommentEntry> {
    const comment =
      await this.comments.findOne({
        where: {
          uuid: commentUuid,
        },
        relations: {
          user: true,
          post: true,
        },
      });

    if (!comment) {
      throw new NotFoundException(
        `Blog comment "${commentUuid}" not found.`,
      );
    }

    return comment;
  }

  private async mapAdminComment(
    comment: BlogCommentEntry,
  ): Promise<BlogAdminComment> {
    const [customization, profile] =
      await Promise.all([
        this.customization
          .getCustomization(
            comment.userUuid,
          )
          .catch(() => null),
        this.community.getProfile(
          comment.userUuid,
        ),
      ]);

    return {
      ...this.mapComment(
        comment,
        customization
          ?.selectedProfileColor ?? null,
        profile?.discordDisplayName ||
          comment.user.name,
      ),
      postSlug: comment.post.slug,
      hidden: comment.hiddenAt !== null,
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
