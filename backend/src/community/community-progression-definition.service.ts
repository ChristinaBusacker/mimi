import type {
  CommunityAchievementDefinition,
  CommunityLevelDefinition,
  CommunityTitleDefinition,
  SaveCommunityAchievementDefinition,
  SaveCommunityLevelDefinition,
  SaveCommunityTitleDefinition,
} from '@shared/community/community-progression';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InjectDataSource,
  InjectRepository,
} from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
} from 'typeorm';

import {
  achievementMetricRequiresEventType,
  isCommunityAchievementMetric,
} from './community-achievement-metric';
import { isRewardRuleEventType } from './community-event-type';
import { CommunityAchievementConditionEntry } from './entities/community-achievement-condition.entry';
import { CommunityAchievementEntry } from './entities/community-achievement.entry';
import { CommunityLevelEntry } from './entities/community-level.entry';
import { CommunityTitleEntry } from './entities/community-title.entry';

const DEFINITION_KEY_PATTERN =
  /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const HEX_COLOR_PATTERN =
  /^#[0-9a-f]{6}$/i;
const DISCORD_ROLE_ID_PATTERN =
  /^\d{1,32}$/;

@Injectable()
export class CommunityProgressionDefinitionService {
  constructor(
    @InjectDataSource()
    private readonly dataSource:
      DataSource,
    @InjectRepository(
      CommunityLevelEntry,
    )
    private readonly levels:
      Repository<CommunityLevelEntry>,
    @InjectRepository(
      CommunityTitleEntry,
    )
    private readonly titles:
      Repository<CommunityTitleEntry>,
    @InjectRepository(
      CommunityAchievementEntry,
    )
    private readonly achievements:
      Repository<CommunityAchievementEntry>,
    @InjectRepository(
      CommunityAchievementConditionEntry,
    )
    private readonly conditions:
      Repository<CommunityAchievementConditionEntry>,
  ) {}

  async getLevels():
    Promise<CommunityLevelDefinition[]> {
    const levels =
      await this.levels.find({
        order: {
          level: 'ASC',
        },
      });

    return levels.map((level) =>
      this.mapLevel(level),
    );
  }

  async saveLevel(
    level: number,
    input: SaveCommunityLevelDefinition,
    updatedByUserId: string | null,
  ): Promise<CommunityLevelDefinition> {
    this.assertPositiveInteger(
      level,
      'level',
    );
    this.assertNonNegativeInteger(
      input.requiredXp,
      'requiredXp',
    );

    const existing =
      await this.levels.findOneBy({
        level,
      });
    const saved =
      await this.levels.save(
        existing
          ? {
              ...existing,
              enabled: true,
              requiredXp:
                input.requiredXp,
              updatedByUserId,
            }
          : this.levels.create({
              level,
              enabled: true,
              requiredXp:
                input.requiredXp,
              nameDe: `Level ${level}`,
              nameEn: null,
              displayColor: null,
              discordRoleId: null,
              badgeAssetId: null,
              updatedByUserId,
            }),
      );

    return this.mapLevel(saved);
  }

  async replaceLevels(
    requiredXp: number[],
    updatedByUserId: string | null,
  ): Promise<CommunityLevelDefinition[]> {
    this.validateLevelThresholds(requiredXp);

    await this.dataSource.transaction(
      async (manager) => {
        await manager.query(
          'DELETE FROM "community_levels"',
        );

        const repository =
          manager.getRepository(
            CommunityLevelEntry,
          );

        await repository.save(
          requiredXp.map(
            (threshold, index) =>
              repository.create({
                level: index + 1,
                enabled: true,
                requiredXp: threshold,
                nameDe:
                  `Level ${index + 1}`,
                nameEn: null,
                displayColor: null,
                discordRoleId: null,
                badgeAssetId: null,
                updatedByUserId,
              }),
          ),
        );
      },
    );

    return this.getLevels();
  }

  private validateLevelThresholds(
    requiredXp: number[],
  ): void {
    if (requiredXp.length === 0) {
      throw new BadRequestException(
        'At least one community level is required.',
      );
    }

    if (requiredXp[0] !== 0) {
      throw new BadRequestException(
        'Level 1 must start at 0 XP.',
      );
    }

    for (
      let index = 0;
      index < requiredXp.length;
      index += 1
    ) {
      const threshold = requiredXp[index];

      this.assertNonNegativeInteger(
        threshold,
        `requiredXp[${index}]`,
      );

      if (
        index > 0 &&
        threshold <= requiredXp[index - 1]
      ) {
        throw new BadRequestException(
          'Level XP thresholds must increase strictly.',
        );
      }
    }
  }

  async getTitles():
    Promise<CommunityTitleDefinition[]> {
    const titles =
      await this.titles.find({
        order: {
          key: 'ASC',
        },
      });

    return titles.map((title) =>
      this.mapTitle(title),
    );
  }

  async saveTitle(
    key: string,
    input: SaveCommunityTitleDefinition,
    updatedByUserId: string | null,
  ): Promise<CommunityTitleDefinition> {
    const normalizedKey =
      this.normalizeKey(key);

    this.assertLocalizedName(
      input.name.de,
      'name.de',
    );
    this.assertOptionalLength(
      input.name.en,
      'name.en',
      160,
    );

    const existing =
      await this.titles.findOneBy({
        key: normalizedKey,
      });
    const saved =
      await this.titles.save(
        existing
          ? {
              ...existing,
              enabled: input.enabled,
              nameDe:
                input.name.de.trim(),
              nameEn:
                this.normalizeOptional(
                  input.name.en,
                ),
              descriptionDe:
                input.description.de.trim(),
              descriptionEn:
                this.normalizeOptional(
                  input.description.en,
                ),
              updatedByUserId,
            }
          : this.titles.create({
              key: normalizedKey,
              enabled: input.enabled,
              nameDe:
                input.name.de.trim(),
              nameEn:
                this.normalizeOptional(
                  input.name.en,
                ),
              descriptionDe:
                input.description.de.trim(),
              descriptionEn:
                this.normalizeOptional(
                  input.description.en,
                ),
              updatedByUserId,
            }),
      );

    return this.mapTitle(saved);
  }

  async getAchievements():
    Promise<
      CommunityAchievementDefinition[]
    > {
    const [
      achievements,
      conditions,
    ] = await Promise.all([
      this.achievements.find({
        order: {
          sortOrder: 'ASC',
          key: 'ASC',
        },
      }),
      this.conditions.find({
        order: {
          sortOrder: 'ASC',
        },
      }),
    ]);

    return achievements.map(
      (achievement) =>
        this.mapAchievement(
          achievement,
          conditions.filter(
            (condition) =>
              condition.achievementUuid ===
              achievement.uuid,
          ),
        ),
    );
  }

  async saveAchievement(
    key: string,
    input:
      SaveCommunityAchievementDefinition,
    updatedByUserId: string | null,
  ): Promise<CommunityAchievementDefinition> {
    const normalizedKey =
      this.normalizeKey(key);

    this.validateAchievement(input);

    await this.dataSource.transaction(
      async (manager) => {
        const achievementRepository =
          manager.getRepository(
            CommunityAchievementEntry,
          );
        const conditionRepository =
          manager.getRepository(
            CommunityAchievementConditionEntry,
          );

        if (input.unlockedTitleId) {
          const title =
            await manager
              .getRepository(
                CommunityTitleEntry,
              )
              .findOneBy({
                uuid:
                  input.unlockedTitleId,
              });

          if (!title) {
            throw new NotFoundException(
              `Community title "${input.unlockedTitleId}" not found.`,
            );
          }
        }

        const existing =
          await achievementRepository
            .findOneBy({
              key: normalizedKey,
            });
        const achievement =
          await achievementRepository.save(
            existing
              ? {
                  ...existing,
                  enabled:
                    input.enabled,
                  nameDe:
                    input.name.de.trim(),
                  nameEn:
                    this.normalizeOptional(
                      input.name.en,
                    ),
                  descriptionDe:
                    input.description.de
                      .trim(),
                  descriptionEn:
                    this.normalizeOptional(
                      input.description.en,
                    ),
                  badgeAssetId:
                    input.badgeAssetId,
                  conditionMode:
                    input.conditionMode,
                  xpReward:
                    input.xpReward,
                  unlockedTitleUuid:
                    input.unlockedTitleId,
                  unlockedProfileColor:
                    this.normalizeColor(
                      input.unlockedProfileColor,
                    ),
                  discordRoleId:
                    this.normalizeOptional(
                      input.discordRoleId,
                    ),
                  sortOrder:
                    input.sortOrder,
                  updatedByUserId,
                }
              : achievementRepository
                  .create({
                    key: normalizedKey,
                    enabled:
                      input.enabled,
                    nameDe:
                      input.name.de.trim(),
                    nameEn:
                      this.normalizeOptional(
                        input.name.en,
                      ),
                    descriptionDe:
                      input.description.de
                        .trim(),
                    descriptionEn:
                      this.normalizeOptional(
                        input.description.en,
                      ),
                    badgeAssetId:
                      input.badgeAssetId,
                    conditionMode:
                      input.conditionMode,
                    xpReward:
                      input.xpReward,
                    unlockedTitleUuid:
                      input.unlockedTitleId,
                    unlockedProfileColor:
                      this.normalizeColor(
                        input.unlockedProfileColor,
                      ),
                    discordRoleId:
                      this.normalizeOptional(
                        input.discordRoleId,
                      ),
                    sortOrder:
                      input.sortOrder,
                    updatedByUserId,
                  }),
          );

        await conditionRepository.delete({
          achievementUuid:
            achievement.uuid,
        });

        await conditionRepository.save(
          input.conditions.map(
            (condition, index) =>
              conditionRepository.create({
                achievementUuid:
                  achievement.uuid,
                metric:
                  condition.metric,
                operator:
                  condition.operator,
                threshold:
                  condition.threshold,
                eventType:
                  condition.eventType,
                sortOrder: index,
              }),
          ),
        );
      },
    );

    const achievement =
      await this.achievements.findOneBy({
        key: normalizedKey,
      });

    if (!achievement) {
      throw new NotFoundException(
        `Community achievement "${normalizedKey}" not found after saving.`,
      );
    }

    const conditions =
      await this.conditions.find({
        where: {
          achievementUuid:
            achievement.uuid,
        },
        order: {
          sortOrder: 'ASC',
        },
      });

    return this.mapAchievement(
      achievement,
      conditions,
    );
  }

  private validateAchievement(
    input:
      SaveCommunityAchievementDefinition,
  ): void {
    this.assertLocalizedName(
      input.name.de,
      'name.de',
    );
    this.assertOptionalLength(
      input.name.en,
      'name.en',
      160,
    );
    this.assertNonNegativeInteger(
      input.xpReward,
      'xpReward',
    );

    if (
      !Number.isSafeInteger(
        input.sortOrder,
      )
    ) {
      throw new BadRequestException(
        'sortOrder must be an integer.',
      );
    }

    if (
      input.conditionMode !== 'all' &&
      input.conditionMode !== 'any'
    ) {
      throw new BadRequestException(
        'conditionMode must be "all" or "any".',
      );
    }

    if (
      input.conditions.length === 0
    ) {
      throw new BadRequestException(
        'An achievement needs at least one condition.',
      );
    }

    this.assertOptionalColor(
      input.unlockedProfileColor,
    );
    this.assertOptionalDiscordRoleId(
      input.discordRoleId,
    );

    for (
      const condition
      of input.conditions
    ) {
      if (
        !isCommunityAchievementMetric(
          condition.metric,
        )
      ) {
        throw new BadRequestException(
          `Unknown achievement metric "${condition.metric}".`,
        );
      }

      if (
        condition.operator !== 'gte'
      ) {
        throw new BadRequestException(
          `Unsupported achievement operator "${condition.operator}".`,
        );
      }

      this.assertPositiveInteger(
        condition.threshold,
        'condition.threshold',
      );

      const requiresEventType =
        achievementMetricRequiresEventType(
          condition.metric,
        );

      if (
        requiresEventType &&
        (
          !condition.eventType ||
          !isRewardRuleEventType(
            condition.eventType,
          )
        )
      ) {
        throw new BadRequestException(
          `Metric "${condition.metric}" requires a configurable community event type.`,
        );
      }

      if (
        !requiresEventType &&
        condition.eventType !== null
      ) {
        throw new BadRequestException(
          `Metric "${condition.metric}" does not accept an event type.`,
        );
      }
    }
  }

  private mapLevel(
    level: CommunityLevelEntry,
  ): CommunityLevelDefinition {
    return {
      level: level.level,
      requiredXp:
        level.requiredXp,
      updatedByUserId:
        level.updatedByUserId,
      createdAt:
        level.createdAt.toISOString(),
      updatedAt:
        level.updatedAt.toISOString(),
    };
  }

  private mapTitle(
    title: CommunityTitleEntry,
  ): CommunityTitleDefinition {
    return {
      id: title.uuid,
      key: title.key,
      enabled: title.enabled,
      name: {
        de: title.nameDe,
        en: title.nameEn,
      },
      description: {
        de: title.descriptionDe,
        en: title.descriptionEn,
      },
      updatedByUserId:
        title.updatedByUserId,
      createdAt:
        title.createdAt.toISOString(),
      updatedAt:
        title.updatedAt.toISOString(),
    };
  }

  private mapAchievement(
    achievement:
      CommunityAchievementEntry,
    conditions:
      CommunityAchievementConditionEntry[],
  ): CommunityAchievementDefinition {
    return {
      id: achievement.uuid,
      key: achievement.key,
      enabled:
        achievement.enabled,
      name: {
        de: achievement.nameDe,
        en: achievement.nameEn,
      },
      description: {
        de: achievement.descriptionDe,
        en: achievement.descriptionEn,
      },
      badgeAssetId:
        achievement.badgeAssetId,
      conditionMode:
        achievement.conditionMode,
      conditions:
        conditions.map(
          (condition) => ({
            id: condition.uuid,
            metric:
              condition.metric,
            operator:
              condition.operator,
            threshold:
              condition.threshold,
            eventType:
              condition.eventType,
            sortOrder:
              condition.sortOrder,
          }),
        ),
      xpReward:
        achievement.xpReward,
      unlockedTitleId:
        achievement.unlockedTitleUuid,
      unlockedProfileColor:
        achievement.unlockedProfileColor,
      discordRoleId:
        achievement.discordRoleId,
      sortOrder:
        achievement.sortOrder,
      updatedByUserId:
        achievement.updatedByUserId,
      createdAt:
        achievement.createdAt
          .toISOString(),
      updatedAt:
        achievement.updatedAt
          .toISOString(),
    };
  }

  private normalizeKey(
    value: string,
  ): string {
    const key =
      value.trim().toLowerCase();

    if (
      key.length === 0 ||
      key.length > 80 ||
      !DEFINITION_KEY_PATTERN.test(key)
    ) {
      throw new BadRequestException(
        'Definition keys may contain lowercase letters, numbers, dots and hyphens.',
      );
    }

    return key;
  }

  private assertLocalizedName(
    value: string,
    field: string,
  ): void {
    const normalized = value.trim();

    if (
      normalized.length === 0 ||
      normalized.length > 160
    ) {
      throw new BadRequestException(
        `${field} must contain between 1 and 160 characters.`,
      );
    }
  }

  private assertOptionalLength(
    value: string | null,
    field: string,
    maximum: number,
  ): void {
    if (
      value !== null &&
      value.trim().length > maximum
    ) {
      throw new BadRequestException(
        `${field} may contain at most ${maximum} characters.`,
      );
    }
  }

  private assertOptionalColor(
    value: string | null,
  ): void {
    if (
      value !== null &&
      !HEX_COLOR_PATTERN.test(
        value.trim(),
      )
    ) {
      throw new BadRequestException(
        'displayColor must be a six-digit hex color.',
      );
    }
  }

  private assertOptionalDiscordRoleId(
    value: string | null,
  ): void {
    if (
      value !== null &&
      !DISCORD_ROLE_ID_PATTERN.test(
        value.trim(),
      )
    ) {
      throw new BadRequestException(
        'discordRoleId must be a Discord snowflake.',
      );
    }
  }

  private assertPositiveInteger(
    value: number,
    field: string,
  ): void {
    if (
      !Number.isSafeInteger(value) ||
      value < 1
    ) {
      throw new BadRequestException(
        `${field} must be a positive integer.`,
      );
    }
  }

  private assertNonNegativeInteger(
    value: number,
    field: string,
  ): void {
    if (
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      throw new BadRequestException(
        `${field} must be a non-negative integer.`,
      );
    }
  }

  private normalizeOptional(
    value: string | null,
  ): string | null {
    if (value === null) {
      return null;
    }

    return value.trim() || null;
  }

  private normalizeColor(
    value: string | null,
  ): string | null {
    return this.normalizeOptional(
      value,
    )?.toLowerCase() ?? null;
  }
}
