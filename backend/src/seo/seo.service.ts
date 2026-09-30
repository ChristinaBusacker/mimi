import type {
  SeoPageOverride,
  SeoStaticPageKey,
} from '@shared/seo/seo';

import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  InjectDataSource,
  InjectRepository,
} from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
} from 'typeorm';

import { AssetsService } from '../assets/assets.service';
import type { SeoPageOverrideInputDto } from './dto/seo-page-override.dto';
import { SeoPageOverrideEntry } from './entities/seo-page-override.entry';

@Injectable()
export class SeoService {
  constructor(
    private readonly assetsService:
      AssetsService,
    @InjectDataSource()
    private readonly dataSource:
      DataSource,
    @InjectRepository(SeoPageOverrideEntry)
    private readonly repository:
      Repository<SeoPageOverrideEntry>,
  ) {}

  async getPages(): Promise<SeoPageOverride[]> {
    const entries = await this.repository.find({
      order: {
        pageKey: 'ASC',
        locale: 'ASC',
      },
    });

    return entries.map((entry) =>
      this.mapEntry(entry),
    );
  }

  async savePages(
    pages: readonly SeoPageOverrideInputDto[],
  ): Promise<SeoPageOverride[]> {
    this.assertUniqueEntries(pages);
    await this.validateSocialImages(pages);

    await this.dataSource.transaction(
      async (manager) => {
        const repository =
          manager.getRepository(
            SeoPageOverrideEntry,
          );

        for (const page of pages) {
          await repository.save(
            repository.create({
              pageKey: page.pageKey,
              locale: page.locale,
              title: this.normalize(page.title),
              description:
                this.normalize(page.description),
              socialTitle:
                this.normalize(page.socialTitle),
              socialDescription:
                this.normalize(
                  page.socialDescription,
                ),
              socialImageAssetId:
                page.socialImageAssetId ?? null,
              socialImageAlt:
                this.normalize(page.socialImageAlt),
            }),
          );
        }
      },
    );

    return this.getPages();
  }

  private async validateSocialImages(
    pages: readonly SeoPageOverrideInputDto[],
  ): Promise<void> {
    const assetIds = [
      ...new Set(
        pages
          .map((page) => page.socialImageAssetId)
          .filter(
            (assetId): assetId is string =>
              assetId !== null,
          ),
      ),
    ];

    await Promise.all(
      assetIds.map(async (assetId) => {
        const asset =
          await this.assetsService.getById(
            assetId,
          );

        if (asset.type !== 'image') {
          throw new BadRequestException(
            `Asset "${assetId}" must be an image.`,
          );
        }
      }),
    );
  }

  private assertUniqueEntries(
    pages: readonly SeoPageOverrideInputDto[],
  ): void {
    const seen = new Set<string>();

    for (const page of pages) {
      const key =
        `${page.pageKey}:${page.locale}`;

      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate SEO page override "${key}".`,
        );
      }

      seen.add(key);
    }
  }

  private normalize(
    value: string | null,
  ): string | null {
    const normalized = value?.trim() ?? '';

    return normalized || null;
  }

  private mapEntry(
    entry: SeoPageOverrideEntry,
  ): SeoPageOverride {
    return {
      pageKey: entry.pageKey,
      locale: entry.locale,
      title: entry.title,
      description: entry.description,
      socialTitle: entry.socialTitle,
      socialDescription:
        entry.socialDescription,
      socialImageAssetId:
        entry.socialImageAssetId,
      socialImageAlt:
        entry.socialImageAlt,
    };
  }
}
