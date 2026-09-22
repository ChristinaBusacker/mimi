import type {
  BlogAuthor,
  BlogPost,
  BlogPostSummary,
} from '@shared/blog/blog';

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  LessThanOrEqual,
  Repository,
} from 'typeorm';

import { MarkdownRendererService } from '../content/markdown-renderer.service';
import {
  DEFAULT_BLOG_LOCALE,
  type BlogLocale,
} from './blog-locale';
import { BlogAuthorProfileEntry } from './entities/blog-author-profile.entry';
import { BlogPostTranslationEntry } from './entities/blog-post-translation.entry';
import { BlogPostEntry } from './entities/blog-post.entry';

@Injectable()
export class BlogService {
  constructor(
    private readonly markdownRenderer:
      MarkdownRendererService,
    @InjectRepository(BlogAuthorProfileEntry)
    private readonly authorRepository:
      Repository<BlogAuthorProfileEntry>,
    @InjectRepository(BlogPostEntry)
    private readonly postRepository:
      Repository<BlogPostEntry>,
    @InjectRepository(BlogPostTranslationEntry)
    private readonly translationRepository:
      Repository<BlogPostTranslationEntry>,
  ) {}

  async getPosts(
    locale: BlogLocale,
  ): Promise<BlogPostSummary[]> {
    const posts =
      await this.postRepository.find({
        where: {
          status: 'published',
          publishedAt:
            LessThanOrEqual(
              new Date(),
            ),
        },
        order: {
          publishedAt: 'DESC',
          createdAt: 'DESC',
        },
      });

    if (posts.length === 0) {
      return [];
    }

    const translations =
      await this.getTranslations(
        posts.map(
          (post) => post.uuid,
        ),
        locale,
      );
    const authors =
      await this.getAuthors(
        posts.map(
          (post) => post.authorUuid,
        ),
      );

    return posts
      .map((post) => {
        const translation =
          this.pickTranslation(
            translations.filter(
              (candidate) =>
                candidate.postUuid ===
                post.uuid,
            ),
            locale,
          );
        const author =
          authors.find(
            (candidate) =>
              candidate.userUuid ===
              post.authorUuid,
          );

        if (
          !translation ||
          !author ||
          !post.publishedAt
        ) {
          return null;
        }

        return this.mapSummary(
          post,
          translation,
          author,
        );
      })
      .filter(
        (
          post,
        ): post is BlogPostSummary =>
          post !== null,
      );
  }

  async getPostBySlug(
    slug: string,
    locale: BlogLocale,
  ): Promise<BlogPost> {
    const post =
      await this.postRepository.findOne({
        where: {
          slug,
          status: 'published',
          publishedAt:
            LessThanOrEqual(
              new Date(),
            ),
        },
      });

    if (
      !post ||
      !post.publishedAt
    ) {
      throw new NotFoundException(
        `Blog post "${slug}" not found.`,
      );
    }

    const translation =
      await this.getTranslation(
        post.uuid,
        locale,
      );
    const author =
      await this.authorRepository.findOneBy({
        userUuid: post.authorUuid,
      });

    if (
      !translation ||
      !author
    ) {
      throw new NotFoundException(
        `Blog post "${slug}" not found.`,
      );
    }

    return {
      ...this.mapSummary(
        post,
        translation,
        author,
      ),
      contentHtml:
        this.markdownRenderer.render(
          translation.contentMarkdown,
        ),
    };
  }

  private async getTranslation(
    postUuid: string,
    locale: BlogLocale,
  ): Promise<BlogPostTranslationEntry | null> {
    const translations =
      await this.translationRepository.find({
        where: {
          postUuid,
          locale: In(
            this.localesWithFallback(
              locale,
            ),
          ),
        },
      });

    return this.pickTranslation(
      translations,
      locale,
    );
  }

  private async getTranslations(
    postUuids: string[],
    locale: BlogLocale,
  ): Promise<BlogPostTranslationEntry[]> {
    if (postUuids.length === 0) {
      return [];
    }

    return this.translationRepository.find({
      where: {
        postUuid: In(postUuids),
        locale: In(
          this.localesWithFallback(
            locale,
          ),
        ),
      },
    });
  }

  private async getAuthors(
    userUuids: string[],
  ): Promise<BlogAuthorProfileEntry[]> {
    const uniqueUserUuids = [
      ...new Set(userUuids),
    ];

    if (
      uniqueUserUuids.length === 0
    ) {
      return [];
    }

    return this.authorRepository.findBy({
      userUuid: In(
        uniqueUserUuids,
      ),
    });
  }

  private mapSummary(
    post: BlogPostEntry,
    translation:
      BlogPostTranslationEntry,
    author:
      BlogAuthorProfileEntry,
  ): BlogPostSummary {
    return {
      id: post.uuid,
      slug: post.slug,
      title: translation.title,
      excerpt: translation.excerpt,
      coverAssetId:
        post.coverAssetId,
      publishedAt:
        post.publishedAt!.toISOString(),
      author:
        this.mapAuthor(author),
    };
  }

  private mapAuthor(
    author: BlogAuthorProfileEntry,
  ): BlogAuthor {
    return {
      slug: author.slug,
      displayName:
        author.displayName,
      bio: author.bio,
      avatarAssetId:
        author.avatarAssetId,
    };
  }

  private localesWithFallback(
    locale: BlogLocale,
  ): BlogLocale[] {
    return locale ===
      DEFAULT_BLOG_LOCALE
      ? [locale]
      : [
          locale,
          DEFAULT_BLOG_LOCALE,
        ];
  }

  private pickTranslation<
    TTranslation extends {
      locale: BlogLocale;
    },
  >(
    translations: TTranslation[],
    locale: BlogLocale,
  ): TTranslation | null {
    return (
      translations.find(
        (translation) =>
          translation.locale ===
          locale,
      ) ??
      translations.find(
        (translation) =>
          translation.locale ===
          DEFAULT_BLOG_LOCALE,
      ) ??
      null
    );
  }
}
