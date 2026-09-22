import type {
  AuthenticatedUser,
  UserRole,
} from '@shared/auth/authenticated-user';
import type {
  BlogAdminAuthor,
  BlogAdminAuthorCandidate,
  BlogAdminPost,
  BlogAdminTranslation,
  BlogAdminTranslations,
} from '@shared/blog/blog-admin';
import type { AssetType } from '@shared/assets/asset';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InjectDataSource,
  InjectRepository,
} from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  Not,
  Repository,
} from 'typeorm';

import {
  AssetUsageService,
  type AssetUsageInput,
} from '../assets/asset-usage.service';
import { AssetsService } from '../assets/assets.service';
import { UserEntry } from '../users/entities/user.entry';
import { UsersService } from '../users/users.service';
import type { BlogLocale } from './blog-locale';
import {
  BlogAdminTranslationsInputDto,
  SaveBlogAdminAuthorDto,
  SaveBlogAdminPostDto,
} from './dto/save-blog.dto';
import { BlogAuthorProfileEntry } from './entities/blog-author-profile.entry';
import { BlogPostTranslationEntry } from './entities/blog-post-translation.entry';
import { BlogPostEntry } from './entities/blog-post.entry';

@Injectable()
export class BlogAdminService {
  constructor(
    private readonly assetsService:
      AssetsService,
    private readonly assetUsageService:
      AssetUsageService,
    private readonly usersService:
      UsersService,
    @InjectDataSource()
    private readonly dataSource:
      DataSource,
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
    actor: AuthenticatedUser,
  ): Promise<BlogAdminPost[]> {
    const posts =
      await this.postRepository.find({
        ...(actor.role === 'author'
          ? {
              where: {
                authorUuid:
                  actor.uuid,
              },
            }
          : {}),
        order: {
          updatedAt: 'DESC',
        },
      });

    const translations =
      await this.getTranslations(
        posts.map(
          (post) => post.uuid,
        ),
      );

    return posts.map((post) =>
      this.mapPost(
        post,
        translations.filter(
          (translation) =>
            translation.postUuid ===
            post.uuid,
        ),
      ),
    );
  }

  async getPost(
    uuid: string,
    actor: AuthenticatedUser,
  ): Promise<BlogAdminPost> {
    const post =
      await this.findPost(uuid);

    this.assertCanAccessPost(
      post,
      actor,
    );

    const translations =
      await this.translationRepository.findBy({
        postUuid: uuid,
      });

    return this.mapPost(
      post,
      translations,
    );
  }

  async createPost(
    dto: SaveBlogAdminPostDto,
    actor: AuthenticatedUser,
  ): Promise<BlogAdminPost> {
    await this.validateAuthorAssignment(
      dto.authorId,
      actor,
    );
    await this.validatePostAssets(
      dto,
    );
    await this.assertPostSlugAvailable(
      dto.slug,
    );
    this.assertCanSetStatus(
      dto.status,
      actor,
    );

    const uuid =
      await this.dataSource.transaction(
        async (manager) => {
          const repository =
            manager.getRepository(
              BlogPostEntry,
            );
          const post =
            await repository.save(
              repository.create({
                slug: dto.slug,
                authorUuid:
                  dto.authorId,
                coverAssetId:
                  dto.coverAssetId,
                status: dto.status,
                publishedAt:
                  dto.status ===
                  'published'
                    ? new Date()
                    : null,
              }),
            );

          await this.replaceTranslations(
            manager,
            post.uuid,
            dto.translations,
          );
          await this.assetUsageService.syncOwner(
            manager,
            'blogPost',
            post.uuid,
            this.postAssetUsages(
              dto,
            ),
          );

          return post.uuid;
        },
      );

    return this.getPost(
      uuid,
      actor,
    );
  }

  async updatePost(
    uuid: string,
    dto: SaveBlogAdminPostDto,
    actor: AuthenticatedUser,
  ): Promise<BlogAdminPost> {
    const post =
      await this.findPost(uuid);

    this.assertCanModifyPost(
      post,
      actor,
    );
    await this.validateAuthorAssignment(
      dto.authorId,
      actor,
    );
    await this.validatePostAssets(
      dto,
    );
    await this.assertPostSlugAvailable(
      dto.slug,
      uuid,
    );
    this.assertCanSetStatus(
      dto.status,
      actor,
    );

    await this.dataSource.transaction(
      async (manager) => {
        await manager
          .getRepository(
            BlogPostEntry,
          )
          .save({
            ...post,
            slug: dto.slug,
            authorUuid:
              dto.authorId,
            coverAssetId:
              dto.coverAssetId,
            status: dto.status,
            publishedAt:
              dto.status ===
              'published'
                ? post.publishedAt ??
                  new Date()
                : null,
          });

        await this.replaceTranslations(
          manager,
          uuid,
          dto.translations,
        );
        await this.assetUsageService.syncOwner(
          manager,
          'blogPost',
          uuid,
          this.postAssetUsages(
            dto,
          ),
        );
      },
    );

    return this.getPost(
      uuid,
      actor,
    );
  }

  async deletePost(
    uuid: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const post =
      await this.findPost(uuid);

    this.assertCanModifyPost(
      post,
      actor,
    );

    await this.dataSource.transaction(
      async (manager) => {
        await this.assetUsageService.clearOwner(
          manager,
          'blogPost',
          uuid,
        );

        await manager
          .getRepository(
            BlogPostEntry,
          )
          .delete({
            uuid,
          });
      },
    );
  }

  async getAuthorCandidates():
    Promise<BlogAdminAuthorCandidate[]> {
    const [
      users,
      profiles,
    ] = await Promise.all([
      this.usersService.findAll(),
      this.authorRepository.find(),
    ]);

    return users.map((user) => {
      const profile =
        profiles.find(
          (candidate) =>
            candidate.userUuid ===
            user.uuid,
        );

      return {
        userId: user.uuid,
        name: user.name,
        email: user.email,
        role: user.role,
        profile: profile
          ? this.mapAuthor(
              profile,
              user.role,
            )
          : null,
      };
    });
  }

  async saveAuthor(
    userUuid: string,
    dto: SaveBlogAdminAuthorDto,
  ): Promise<BlogAdminAuthor> {
    const user =
      await this.usersService.findByUuid(
        userUuid,
      );

    if (!user) {
      throw new NotFoundException(
        `User "${userUuid}" not found.`,
      );
    }

    await this.assertAssetType(
      dto.avatarAssetId,
      'image',
    );
    await this.assertAuthorSlugAvailable(
      dto.slug,
      userUuid,
    );

    await this.dataSource.transaction(
      async (manager) => {
        const repository =
          manager.getRepository(
            BlogAuthorProfileEntry,
          );
        const existing =
          await repository.findOneBy({
            userUuid,
          });

        await repository.save(
          existing
            ? {
                ...existing,
                slug: dto.slug,
                displayName:
                  dto.displayName,
                bio: dto.bio,
                avatarAssetId:
                  dto.avatarAssetId,
              }
            : repository.create({
                userUuid,
                slug: dto.slug,
                displayName:
                  dto.displayName,
                bio: dto.bio,
                avatarAssetId:
                  dto.avatarAssetId,
              }),
        );

        if (user.role !== 'admin') {
          await manager
            .getRepository(
              UserEntry,
            )
            .save({
              ...user,
              role: dto.role,
            });
        }

        await this.assetUsageService.syncOwner(
          manager,
          'blogAuthor',
          userUuid,
          dto.avatarAssetId
            ? [
                {
                  assetUuid:
                    dto.avatarAssetId,
                  scope: 'avatar',
                },
              ]
            : [],
        );
      },
    );

    const [
      profile,
      updatedUser,
    ] = await Promise.all([
      this.authorRepository.findOneBy({
        userUuid,
      }),
      this.usersService.findByUuid(
        userUuid,
      ),
    ]);

    if (
      !profile ||
      !updatedUser
    ) {
      throw new NotFoundException(
        `Blog author "${userUuid}" not found.`,
      );
    }

    return this.mapAuthor(
      profile,
      updatedUser.role,
    );
  }

  private async findPost(
    uuid: string,
  ): Promise<BlogPostEntry> {
    const post =
      await this.postRepository.findOneBy({
        uuid,
      });

    if (!post) {
      throw new NotFoundException(
        `Blog post "${uuid}" not found.`,
      );
    }

    return post;
  }

  private async validateAuthorAssignment(
    authorUuid: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (
      actor.role === 'author' &&
      authorUuid !== actor.uuid
    ) {
      throw new ForbiddenException();
    }

    const profile =
      await this.authorRepository.findOneBy({
        userUuid: authorUuid,
      });

    if (!profile) {
      throw new BadRequestException(
        'The selected author does not have a blog author profile.',
      );
    }
  }

  private assertCanAccessPost(
    post: BlogPostEntry,
    actor: AuthenticatedUser,
  ): void {
    if (
      actor.role === 'author' &&
      post.authorUuid !== actor.uuid
    ) {
      throw new ForbiddenException();
    }
  }

  private assertCanModifyPost(
    post: BlogPostEntry,
    actor: AuthenticatedUser,
  ): void {
    this.assertCanAccessPost(
      post,
      actor,
    );

    if (
      actor.role === 'author' &&
      post.status !== 'draft'
    ) {
      throw new ForbiddenException();
    }
  }

  private assertCanSetStatus(
    status: 'draft' | 'published',
    actor: AuthenticatedUser,
  ): void {
    if (
      actor.role === 'author' &&
      status !== 'draft'
    ) {
      throw new ForbiddenException(
        'Authors cannot publish blog posts.',
      );
    }
  }

  private async validatePostAssets(
    dto: SaveBlogAdminPostDto,
  ): Promise<void> {
    await this.assertAssetType(
      dto.coverAssetId,
      'image',
    );

    const assetIds =
      new Set([
        ...this.assetUsageService.extractMarkdownAssetIds(
          dto.translations.de
            .contentMarkdown,
        ),
        ...this.assetUsageService.extractMarkdownAssetIds(
          dto.translations.en
            ?.contentMarkdown ??
            '',
        ),
      ]);

    await Promise.all(
      [...assetIds].map(
        (assetId) =>
          this.assertAssetType(
            assetId,
            'image',
          ),
      ),
    );
  }

  private postAssetUsages(
    dto: SaveBlogAdminPostDto,
  ): AssetUsageInput[] {
    return [
      ...(dto.coverAssetId
        ? [
            {
              assetUuid:
                dto.coverAssetId,
              scope: 'cover',
            },
          ]
        : []),
      ...this.translationAssetUsages(
        dto.translations,
      ),
    ];
  }

  private translationAssetUsages(
    translations:
      BlogAdminTranslationsInputDto,
  ): AssetUsageInput[] {
    const usages:
      AssetUsageInput[] = [];

    for (const [
      locale,
      translation,
    ] of [
      [
        'de',
        translations.de,
      ],
      [
        'en',
        translations.en,
      ],
    ] as const) {
      if (!translation) {
        continue;
      }

      for (
        const assetUuid
        of this.assetUsageService.extractMarkdownAssetIds(
          translation.contentMarkdown,
        )
      ) {
        usages.push({
          assetUuid,
          scope:
            `content:${locale}`,
        });
      }
    }

    return usages;
  }

  private async assertAssetType(
    uuid: string | null,
    expectedType: AssetType,
  ): Promise<void> {
    if (!uuid) {
      return;
    }

    const asset =
      await this.assetsService.getById(
        uuid,
      );

    if (
      asset.type !== expectedType
    ) {
      throw new BadRequestException(
        `Asset "${uuid}" must be of type "${expectedType}".`,
      );
    }
  }

  private async assertPostSlugAvailable(
    slug: string,
    currentUuid?: string,
  ): Promise<void> {
    const existing =
      await this.postRepository.findOne({
        where: {
          slug,
          ...(currentUuid
            ? {
                uuid: Not(
                  currentUuid,
                ),
              }
            : {}),
        },
      });

    if (existing) {
      throw new ConflictException(
        `Blog post slug "${slug}" already exists.`,
      );
    }
  }

  private async assertAuthorSlugAvailable(
    slug: string,
    currentUserUuid: string,
  ): Promise<void> {
    const existing =
      await this.authorRepository.findOne({
        where: {
          slug,
          userUuid: Not(
            currentUserUuid,
          ),
        },
      });

    if (existing) {
      throw new ConflictException(
        `Blog author slug "${slug}" already exists.`,
      );
    }
  }

  private async replaceTranslations(
    manager: EntityManager,
    postUuid: string,
    translations:
      BlogAdminTranslationsInputDto,
  ): Promise<void> {
    const repository =
      manager.getRepository(
        BlogPostTranslationEntry,
      );

    await this.saveTranslation(
      repository,
      postUuid,
      'de',
      translations.de,
    );

    if (translations.en) {
      await this.saveTranslation(
        repository,
        postUuid,
        'en',
        translations.en,
      );
    } else {
      await repository.delete({
        postUuid,
        locale: 'en',
      });
    }
  }

  private async saveTranslation(
    repository:
      Repository<BlogPostTranslationEntry>,
    postUuid: string,
    locale: BlogLocale,
    translation:
      BlogAdminTranslation,
  ): Promise<void> {
    const existing =
      await repository.findOneBy({
        postUuid,
        locale,
      });

    await repository.save(
      existing
        ? {
            ...existing,
            title:
              translation.title,
            excerpt:
              translation.excerpt,
            contentMarkdown:
              translation.contentMarkdown,
          }
        : repository.create({
            postUuid,
            locale,
            title:
              translation.title,
            excerpt:
              translation.excerpt,
            contentMarkdown:
              translation.contentMarkdown,
          }),
    );
  }

  private async getTranslations(
    postUuids: string[],
  ): Promise<BlogPostTranslationEntry[]> {
    if (postUuids.length === 0) {
      return [];
    }

    return this.translationRepository.findBy({
      postUuid: In(
        postUuids,
      ),
    });
  }

  private mapPost(
    post: BlogPostEntry,
    translations:
      BlogPostTranslationEntry[],
  ): BlogAdminPost {
    return {
      id: post.uuid,
      slug: post.slug,
      authorId:
        post.authorUuid,
      coverAssetId:
        post.coverAssetId,
      status: post.status,
      publishedAt:
        post.publishedAt
          ?.toISOString() ??
        null,
      translations:
        this.mapTranslations(
          translations,
        ),
      createdAt:
        post.createdAt.toISOString(),
      updatedAt:
        post.updatedAt.toISOString(),
    };
  }

  private mapTranslations(
    translations:
      BlogPostTranslationEntry[],
  ): BlogAdminTranslations {
    const german =
      translations.find(
        (translation) =>
          translation.locale ===
          'de',
      );
    const english =
      translations.find(
        (translation) =>
          translation.locale ===
          'en',
      );

    return {
      de: german
        ? this.mapTranslation(
            german,
          )
        : {
            title: '',
            excerpt: '',
            contentMarkdown: '',
          },
      en: english
        ? this.mapTranslation(
            english,
          )
        : null,
    };
  }

  private mapTranslation(
    translation:
      BlogPostTranslationEntry,
  ): BlogAdminTranslation {
    return {
      title:
        translation.title,
      excerpt:
        translation.excerpt,
      contentMarkdown:
        translation.contentMarkdown,
    };
  }

  private mapAuthor(
    profile: BlogAuthorProfileEntry,
    role: UserRole,
  ): BlogAdminAuthor {
    return {
      userId: profile.userUuid,
      slug: profile.slug,
      displayName:
        profile.displayName,
      bio: profile.bio,
      avatarAssetId:
        profile.avatarAssetId,
      role,
      createdAt:
        profile.createdAt.toISOString(),
      updatedAt:
        profile.updatedAt.toISOString(),
    };
  }
}
