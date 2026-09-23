import type {
  BlogAdminCategory,
  BlogAdminCategoryTranslations,
  SaveBlogAdminCategory,
} from '@shared/blog/blog-admin';
import type { BlogCategory } from '@shared/blog/blog';

import {
  ConflictException,
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
  Not,
  Repository,
} from 'typeorm';

import {
  DEFAULT_BLOG_LOCALE,
  type BlogLocale,
} from './blog-locale';
import { BlogCategoryEntry } from './entities/blog-category.entry';
import { BlogCategoryTranslationEntry } from './entities/blog-category-translation.entry';

@Injectable()
export class BlogCategoryService {
  constructor(
    @InjectDataSource()
    private readonly dataSource:
      DataSource,
    @InjectRepository(BlogCategoryEntry)
    private readonly categoryRepository:
      Repository<BlogCategoryEntry>,
  ) {}

  async getAdminCategories():
    Promise<BlogAdminCategory[]> {
    const categories =
      await this.categoryRepository.find({
        relations: {
          translations: true,
        },
        order: {
          slug: 'ASC',
        },
      });

    return categories.map(
      (category) =>
        this.mapAdminCategory(
          category,
        ),
    );
  }

  async create(
    input: SaveBlogAdminCategory,
  ): Promise<BlogAdminCategory> {
    await this.assertSlugAvailable(
      input.slug,
    );

    const uuid =
      await this.dataSource.transaction(
        async (manager) => {
          const repository =
            manager.getRepository(
              BlogCategoryEntry,
            );
          const category =
            await repository.save(
              repository.create({
                slug: input.slug,
              }),
            );

          await this.replaceTranslations(
            manager,
            category.uuid,
            input.translations,
          );

          return category.uuid;
        },
      );

    return this.getAdminCategory(
      uuid,
    );
  }

  async update(
    uuid: string,
    input: SaveBlogAdminCategory,
  ): Promise<BlogAdminCategory> {
    const category =
      await this.requireCategory(
        uuid,
      );

    await this.assertSlugAvailable(
      input.slug,
      uuid,
    );

    await this.dataSource.transaction(
      async (manager) => {
        await manager
          .getRepository(
            BlogCategoryEntry,
          )
          .save({
            ...category,
            slug: input.slug,
          });

        await this.replaceTranslations(
          manager,
          uuid,
          input.translations,
        );
      },
    );

    return this.getAdminCategory(
      uuid,
    );
  }

  async delete(
    uuid: string,
  ): Promise<void> {
    await this.requireCategory(
      uuid,
    );

    await this.categoryRepository.delete({
      uuid,
    });
  }

  async getPublicCategories(
    locale: BlogLocale,
  ): Promise<BlogCategory[]> {
    const categories =
      await this.categoryRepository.find({
        relations: {
          translations: true,
        },
        order: {
          slug: 'ASC',
        },
      });

    return categories
      .map((category) =>
        this.mapPublicCategory(
          category,
          locale,
        ),
      )
      .filter(
        (
          category,
        ): category is BlogCategory =>
          category !== null,
      );
  }

  mapPublicCategory(
    category: BlogCategoryEntry,
    locale: BlogLocale,
  ): BlogCategory | null {
    const translation =
      this.pickTranslation(
        category.translations ?? [],
        locale,
      );

    return translation
      ? {
          slug: category.slug,
          name: translation.name,
        }
      : null;
  }

  private async getAdminCategory(
    uuid: string,
  ): Promise<BlogAdminCategory> {
    const category =
      await this.categoryRepository.findOne({
        where: {
          uuid,
        },
        relations: {
          translations: true,
        },
      });

    if (!category) {
      throw new NotFoundException();
    }

    return this.mapAdminCategory(
      category,
    );
  }

  private async requireCategory(
    uuid: string,
  ): Promise<BlogCategoryEntry> {
    const category =
      await this.categoryRepository.findOneBy({
        uuid,
      });

    if (!category) {
      throw new NotFoundException(
        `Blog category "${uuid}" not found.`,
      );
    }

    return category;
  }

  private async assertSlugAvailable(
    slug: string,
    currentUuid?: string,
  ): Promise<void> {
    const existing =
      await this.categoryRepository.findOne({
        where: {
          slug,
          ...(currentUuid
            ? {
                uuid:
                  Not(currentUuid),
              }
            : {}),
        },
      });

    if (existing) {
      throw new ConflictException(
        `Blog category slug "${slug}" already exists.`,
      );
    }
  }

  private async replaceTranslations(
    manager: EntityManager,
    categoryUuid: string,
    translations:
      BlogAdminCategoryTranslations,
  ): Promise<void> {
    const repository =
      manager.getRepository(
        BlogCategoryTranslationEntry,
      );

    await this.saveTranslation(
      repository,
      categoryUuid,
      'de',
      translations.de.name,
    );

    if (translations.en) {
      await this.saveTranslation(
        repository,
        categoryUuid,
        'en',
        translations.en.name,
      );
    } else {
      await repository.delete({
        categoryUuid,
        locale: 'en',
      });
    }
  }

  private async saveTranslation(
    repository:
      Repository<BlogCategoryTranslationEntry>,
    categoryUuid: string,
    locale: BlogLocale,
    name: string,
  ): Promise<void> {
    const existing =
      await repository.findOneBy({
        categoryUuid,
        locale,
      });

    await repository.save(
      existing
        ? {
            ...existing,
            name,
          }
        : repository.create({
            categoryUuid,
            locale,
            name,
          }),
    );
  }

  private mapAdminCategory(
    category:
      BlogCategoryEntry,
  ): BlogAdminCategory {
    const german =
      category.translations.find(
        (translation) =>
          translation.locale ===
          'de',
      );
    const english =
      category.translations.find(
        (translation) =>
          translation.locale ===
          'en',
      );

    return {
      id: category.uuid,
      slug: category.slug,
      translations: {
        de: {
          name:
            german?.name ?? '',
        },
        en: english
          ? {
              name:
                english.name,
            }
          : null,
      },
    };
  }

  private pickTranslation(
    translations:
      BlogCategoryTranslationEntry[],
    locale: BlogLocale,
  ):
    BlogCategoryTranslationEntry | null {
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
