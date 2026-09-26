import type {
  CommunityBalancingDefaults,
  CommunityEventRuleDefault,
} from '@shared/community/community-balancing';
import type {
  SaveCommunityAchievementDefinition,
  SaveCommunityTitleDefinition,
} from '@shared/community/community-progression';

import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { CommunityEventRuleService } from './community-event-rule.service';
import { CommunityProgressionDefinitionService } from './community-progression-definition.service';

interface CommunityTitleDefault
  extends SaveCommunityTitleDefinition {
  key: string;
}

interface CommunityAchievementDefault
  extends Omit<
    SaveCommunityAchievementDefinition,
    'unlockedTitleId'
  > {
  key: string;
  unlockedTitleKey: string | null;
}

interface CommunityBalancingDefaultsFile
  extends CommunityBalancingDefaults {
  titles: CommunityTitleDefault[];
  achievements: CommunityAchievementDefault[];
}

@Injectable()
export class CommunityBalancingDefaultsService
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(
    CommunityBalancingDefaultsService.name,
  );
  private defaults:
    CommunityBalancingDefaultsFile | null = null;

  constructor(
    private readonly eventRules:
      CommunityEventRuleService,
    private readonly definitions:
      CommunityProgressionDefinitionService,
  ) {}

  async onApplicationBootstrap():
    Promise<void> {
    await this.seedMissingDefaults();
  }

  getAdminDefaults():
    CommunityBalancingDefaults {
    const defaults = this.getDefaults();

    return {
      eventRules:
        defaults.eventRules.map(
          (rule) => ({ ...rule }),
        ),
      levels: [...defaults.levels],
    };
  }

  async restoreEventRule(
    eventType: string,
    updatedByUserId: string,
  ) {
    const defaultRule =
      this.getDefaults().eventRules.find(
        (rule) =>
          rule.eventType === eventType,
      );

    if (!defaultRule) {
      throw new NotFoundException(
        `No default configuration exists for community event type "${eventType}".`,
      );
    }

    return this.eventRules.saveRule(
      eventType,
      this.ruleInput(defaultRule),
      updatedByUserId,
    );
  }

  restoreLevels(
    updatedByUserId: string,
  ) {
    return this.definitions.replaceLevels(
      [...this.getDefaults().levels],
      updatedByUserId,
    );
  }

  private async seedMissingDefaults():
    Promise<void> {
    const defaults = this.getDefaults();
    const existingRules = new Set(
      (
        await this.eventRules.getRules()
      ).map((rule) => rule.eventType),
    );

    for (const rule of defaults.eventRules) {
      if (existingRules.has(rule.eventType)) {
        continue;
      }

      await this.eventRules.saveRule(
        rule.eventType,
        this.ruleInput(rule),
        null,
      );
    }

    if (
      (
        await this.definitions.getLevels()
      ).length === 0
    ) {
      await this.definitions.replaceLevels(
        [...defaults.levels],
        null,
      );
    }

    const existingTitleKeys = new Set(
      (
        await this.definitions.getTitles()
      ).map((title) => title.key),
    );

    for (const title of defaults.titles) {
      if (existingTitleKeys.has(title.key)) {
        continue;
      }

      await this.definitions.saveTitle(
        title.key,
        {
          enabled: title.enabled,
          name: { ...title.name },
          description: {
            ...title.description,
          },
        },
        null,
      );
    }

    const titles =
      await this.definitions.getTitles();
    const titleIdByKey = new Map(
      titles.map((title) => [
        title.key,
        title.id,
      ]),
    );
    const existingAchievementKeys =
      new Set(
        (
          await this.definitions
            .getAchievements()
        ).map(
          (achievement) =>
            achievement.key,
        ),
      );

    for (
      const achievement
      of defaults.achievements
    ) {
      if (
        existingAchievementKeys.has(
          achievement.key,
        )
      ) {
        continue;
      }

      const unlockedTitleId =
        achievement.unlockedTitleKey
          ? titleIdByKey.get(
              achievement.unlockedTitleKey,
            ) ?? null
          : null;

      if (
        achievement.unlockedTitleKey &&
        !unlockedTitleId
      ) {
        throw new Error(
          `Default achievement "${achievement.key}" references unknown title "${achievement.unlockedTitleKey}".`,
        );
      }

      await this.definitions.saveAchievement(
        achievement.key,
        {
          enabled: achievement.enabled,
          name: { ...achievement.name },
          description: {
            ...achievement.description,
          },
          badgeAssetId:
            achievement.badgeAssetId,
          conditionMode:
            achievement.conditionMode,
          conditions:
            achievement.conditions.map(
              (condition) => ({
                ...condition,
              }),
            ),
          xpReward:
            achievement.xpReward,
          unlockedTitleId,
          unlockedProfileColor:
            achievement.unlockedProfileColor,
          discordRoleId:
            achievement.discordRoleId,
          sortOrder:
            achievement.sortOrder,
        },
        null,
      );
    }

    this.logger.log(
      'Community balancing defaults are available.',
    );
  }

  private ruleInput(
    rule: CommunityEventRuleDefault,
  ): Omit<
    CommunityEventRuleDefault,
    'eventType'
  > {
    return {
      enabled: rule.enabled,
      xpAmount: rule.xpAmount,
      dailyRewardLimit:
        rule.dailyRewardLimit,
      contextRewardLimit:
        rule.contextRewardLimit,
      cooldownSeconds:
        rule.cooldownSeconds,
      minimumContentLength:
        rule.minimumContentLength,
    };
  }

  private getDefaults():
    CommunityBalancingDefaultsFile {
    if (this.defaults) {
      return this.defaults;
    }

    const path = this.resolveDefaultsPath();
    const parsed = JSON.parse(
      readFileSync(path, 'utf8'),
    ) as CommunityBalancingDefaultsFile;

    if (
      !Array.isArray(parsed.eventRules) ||
      !Array.isArray(parsed.levels) ||
      !Array.isArray(parsed.titles) ||
      !Array.isArray(parsed.achievements)
    ) {
      throw new Error(
        'community-balancing.defaults.json has an invalid structure.',
      );
    }

    this.defaults = parsed;

    return parsed;
  }

  private resolveDefaultsPath(): string {
    const productionPath = join(
      __dirname,
      'config',
      'community-balancing.defaults.json',
    );

    if (existsSync(productionPath)) {
      return productionPath;
    }

    return join(
      process.cwd(),
      'backend',
      'src',
      'community',
      'config',
      'community-balancing.defaults.json',
    );
  }
}
