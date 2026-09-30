import type {
  SeoPageOverride,
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
      relations: {
        imageAsset: true,
      },
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
    await this.validateImages(pages);

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
              imageAssetId:
                page.imageAssetId ?? null,
            }),
          );
        }
      },
    );

    return this.getPages();
  }

  private async validateImages(
    pages: readonly SeoPageOverrideInputDto[],
  ): Promise<void> {
    const assetIds = [
      ...new Set(
        pages
          .map((page) => page.imageAssetId)
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

        if (
          !asset.descriptionDe?.trim() ||
          !asset.descriptionEn?.trim()
        ) {
          throw new BadRequestException(
            `Image asset "${assetId}" requires German and English descriptions.`,
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
      imageAssetId:
        entry.imageAssetId,
      imageDescription:
        entry.locale === 'de'
          ? entry.imageAsset?.descriptionDe ?? null
          : entry.imageAsset?.descriptionEn ?? null,
    };
  }
}
