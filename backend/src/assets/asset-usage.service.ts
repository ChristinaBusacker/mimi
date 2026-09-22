import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  Repository,
} from 'typeorm';

import {
  AssetUsageEntry,
  type AssetUsageOwnerType,
} from './entities/asset-usage.entry';

const MARKDOWN_ASSET_PATTERN =
  /asset:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

export interface AssetUsageInput {
  assetUuid: string;
  scope: string;
}

@Injectable()
export class AssetUsageService {
  constructor(
    @InjectRepository(AssetUsageEntry)
    private readonly repository:
      Repository<AssetUsageEntry>,
  ) {}

  extractMarkdownAssetIds(
    markdown: string,
  ): string[] {
    if (!markdown) {
      return [];
    }

    return [
      ...new Set(
        Array.from(
          markdown.matchAll(
            MARKDOWN_ASSET_PATTERN,
          ),
          (match) =>
            match[1].toLowerCase(),
        ),
      ),
    ];
  }

  async assertUnused(
    assetUuid: string,
  ): Promise<void> {
    const usage =
      await this.repository.findOne({
        where: {
          assetUuid,
        },
      });

    if (usage) {
      throw new ConflictException(
        'The asset is still used by content.',
      );
    }
  }

  async syncOwner(
    manager: EntityManager,
    ownerType: AssetUsageOwnerType,
    ownerUuid: string,
    usages: readonly AssetUsageInput[],
  ): Promise<void> {
    const repository =
      manager.getRepository(AssetUsageEntry);

    await repository.delete({
      ownerType,
      ownerUuid,
    });

    const uniqueUsages = [
      ...new Map(
        usages.map((usage) => [
          `${usage.assetUuid}:${usage.scope}`,
          usage,
        ]),
      ).values(),
    ];

    if (uniqueUsages.length === 0) {
      return;
    }

    await repository.save(
      uniqueUsages.map((usage) =>
        repository.create({
          assetUuid: usage.assetUuid,
          ownerType,
          ownerUuid,
          scope: usage.scope,
        }),
      ),
    );
  }

  async clearOwner(
    manager: EntityManager,
    ownerType: AssetUsageOwnerType,
    ownerUuid: string,
  ): Promise<void> {
    await manager
      .getRepository(AssetUsageEntry)
      .delete({
        ownerType,
        ownerUuid,
      });
  }
}
