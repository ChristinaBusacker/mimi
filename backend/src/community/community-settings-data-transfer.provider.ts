import type {
  CommunityAchievementDefinition,
  SaveCommunityAchievementDefinition,
} from '@shared/community/community-progression';
import type {
  CommunityAchievementTransferEntry,
  CommunitySettingsTransferData,
} from '@shared/community/community-settings-transfer';
import type {
  DataTransferChangeSummary,
  DataTransferPreview,
} from '@shared/data-transfer/data-transfer';
import {
  BadRequestException,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';

import type {
  DataTransferImportContext,
  DataTransferProvider,
} from '../data-transfer/data-transfer-provider';
import { DataTransferService } from '../data-transfer/data-transfer.service';
import { CommunityDiscordRoleDefinitionService } from './community-discord-role-definition.service';
import { CommunityEventRuleService } from './community-event-rule.service';
import { CommunityProgressionDefinitionService } from './community-progression-definition.service';
import {
  communityDiscordRoleRangesOverlap,
  parseCommunitySettingsTransferData,
} from './community-settings-transfer.parser';

const COMMUNITY_SETTINGS_TRANSFER_TYPE = 'community-settings';
const COMMUNITY_SETTINGS_TRANSFER_SCHEMA_VERSION = 1;

@Injectable()
export class CommunitySettingsDataTransferProvider
  implements DataTransferProvider<CommunitySettingsTransferData>, OnModuleInit
{
  readonly type = COMMUNITY_SETTINGS_TRANSFER_TYPE;
  readonly schemaVersion = COMMUNITY_SETTINGS_TRANSFER_SCHEMA_VERSION;

  constructor(
    private readonly dataTransfer: DataTransferService,
    private readonly eventRules: CommunityEventRuleService,
    private readonly definitions: CommunityProgressionDefinitionService,
    private readonly discordRoles: CommunityDiscordRoleDefinitionService,
  ) {}

  onModuleInit(): void {
    this.dataTransfer.register(this);
  }

  async exportData(): Promise<CommunitySettingsTransferData> {
    const [eventRules, levels, titles, achievements, discordRoles] = await Promise.all([
      this.eventRules.getRules(),
      this.definitions.getLevels(),
      this.definitions.getTitles(),
      this.definitions.getAchievements(),
      this.discordRoles.getDefinitions(),
    ]);
    const titleKeyById = new Map(titles.map((title) => [title.id, title.key]));
    const achievementKeyById = new Map(
      achievements.map((achievement) => [achievement.id, achievement.key]),
    );

    return {
      eventRules: eventRules.map((rule) => ({
        eventType: rule.eventType,
        enabled: rule.enabled,
        xpAmount: rule.xpAmount,
        dailyRewardLimit: rule.dailyRewardLimit,
        contextRewardLimit: rule.contextRewardLimit,
        cooldownSeconds: rule.cooldownSeconds,
        minimumContentLength: rule.minimumContentLength,
      })),
      levels: levels.map((level) => level.requiredXp),
      titles: titles.map((title) => ({
        key: title.key,
        enabled: title.enabled,
        name: { ...title.name },
        description: { ...title.description },
      })),
      achievements: achievements.map((achievement) => ({
        key: achievement.key,
        enabled: achievement.enabled,
        name: { ...achievement.name },
        description: { ...achievement.description },
        conditionMode: achievement.conditionMode,
        conditions: achievement.conditions.map((condition) => ({
          metric: condition.metric,
          operator: condition.operator,
          threshold: condition.threshold,
          eventType: condition.eventType,
        })),
        xpReward: achievement.xpReward,
        unlockedTitleKey:
          achievement.unlockedTitleId === null
            ? null
            : this.requireReference(
                titleKeyById,
                achievement.unlockedTitleId,
                `Community achievement "${achievement.key}" references an unknown title.`,
              ),
        unlockedProfileColor: achievement.unlockedProfileColor,
        sortOrder: achievement.sortOrder,
      })),
      discordRoles: discordRoles.map((role) => ({
        key: role.key,
        kind: role.kind,
        name: role.name,
        color: role.color,
        enabled: role.enabled,
        achievementKey:
          role.achievementId === null
            ? null
            : this.requireReference(
                achievementKeyById,
                role.achievementId,
                `Community Discord role "${role.key}" references an unknown achievement.`,
              ),
        minimumLevel: role.minimumLevel,
        maximumLevel: role.maximumLevel,
        sortOrder: role.sortOrder,
      })),
    };
  }

  async validateImport(data: unknown): Promise<DataTransferPreview> {
    const imported = parseCommunitySettingsTransferData(data);
    const current = await this.exportData();

    this.validateAgainstRetainedRoles(imported, current);
    return this.createPreview(imported, current);
  }

  async importData(
    data: unknown,
    context: DataTransferImportContext,
  ): Promise<DataTransferPreview> {
    const imported = parseCommunitySettingsTransferData(data);
    const current = await this.exportData();

    this.validateAgainstRetainedRoles(imported, current);
    const preview = this.createPreview(imported, current);

    await this.applyImport(imported, current, context.userUuid);
    return preview;
  }

  private async applyImport(
    imported: CommunitySettingsTransferData,
    current: CommunitySettingsTransferData,
    updatedByUserId: string,
  ): Promise<void> {
    const currentRules = new Map(current.eventRules.map((rule) => [rule.eventType, rule]));
    for (const rule of imported.eventRules) {
      if (this.equal(rule, currentRules.get(rule.eventType))) continue;
      const { eventType, ...input } = rule;
      await this.eventRules.saveRule(eventType, input, updatedByUserId);
    }

    if (!this.equal(imported.levels, current.levels)) {
      await this.definitions.replaceLevels([...imported.levels], updatedByUserId);
    }

    const currentTitles = new Map(current.titles.map((title) => [title.key, title]));
    for (const title of imported.titles) {
      if (this.equal(title, currentTitles.get(title.key))) continue;
      await this.definitions.saveTitle(
        title.key,
        {
          enabled: title.enabled,
          name: { ...title.name },
          description: { ...title.description },
        },
        updatedByUserId,
      );
    }

    const titles = await this.definitions.getTitles();
    const titleIdByKey = new Map(titles.map((title) => [title.key, title.id]));
    const currentAchievements = new Map(
      current.achievements.map((achievement) => [achievement.key, achievement]),
    );
    const persistedAchievements = new Map(
      (await this.definitions.getAchievements()).map((achievement) => [
        achievement.key,
        achievement,
      ]),
    );

    for (const achievement of imported.achievements) {
      if (this.equal(achievement, currentAchievements.get(achievement.key))) continue;

      const persisted = persistedAchievements.get(achievement.key);
      const saved = await this.definitions.saveAchievement(
        achievement.key,
        this.achievementInput(achievement, persisted, titleIdByKey),
        updatedByUserId,
      );
      persistedAchievements.set(saved.key, saved);
    }

    const achievementIdByKey = new Map(
      Array.from(persistedAchievements.values(), (achievement) => [
        achievement.key,
        achievement.id,
      ]),
    );
    const currentRoles = new Map(current.discordRoles.map((role) => [role.key, role]));

    for (const role of imported.discordRoles) {
      if (this.equal(role, currentRoles.get(role.key))) continue;
      await this.discordRoles.saveDefinition(
        role.key,
        {
          kind: role.kind,
          name: role.name,
          color: role.color,
          enabled: role.enabled,
          achievementId:
            role.achievementKey === null
              ? null
              : this.requireReference(
                  achievementIdByKey,
                  role.achievementKey,
                  `Community achievement "${role.achievementKey}" was not found while importing Discord role "${role.key}".`,
                ),
          minimumLevel: role.minimumLevel,
          maximumLevel: role.maximumLevel,
          sortOrder: role.sortOrder,
        },
        updatedByUserId,
      );
    }
  }

  private achievementInput(
    achievement: CommunityAchievementTransferEntry,
    current: CommunityAchievementDefinition | undefined,
    titleIdByKey: ReadonlyMap<string, string>,
  ): SaveCommunityAchievementDefinition {
    return {
      enabled: achievement.enabled,
      name: { ...achievement.name },
      description: { ...achievement.description },
      badgeAssetId: current?.badgeAssetId ?? null,
      conditionMode: achievement.conditionMode,
      conditions: achievement.conditions.map((condition) => ({ ...condition })),
      xpReward: achievement.xpReward,
      unlockedTitleId:
        achievement.unlockedTitleKey === null
          ? null
          : this.requireReference(
              titleIdByKey,
              achievement.unlockedTitleKey,
              `Community title "${achievement.unlockedTitleKey}" was not found while importing achievement "${achievement.key}".`,
            ),
      unlockedProfileColor: achievement.unlockedProfileColor,
      discordRoleId: current?.discordRoleId ?? null,
      sortOrder: achievement.sortOrder,
    };
  }

  private validateAgainstRetainedRoles(
    imported: CommunitySettingsTransferData,
    current: CommunitySettingsTransferData,
  ): void {
    const importedKeys = new Set(imported.discordRoles.map((role) => role.key));
    const retained = current.discordRoles.filter((role) => !importedKeys.has(role.key));

    for (const role of imported.discordRoles) {
      if (role.kind === 'showcase') {
        const conflict = retained.find(
          (existing) =>
            existing.kind === 'showcase' && existing.achievementKey === role.achievementKey,
        );
        if (conflict) {
          throw new BadRequestException(
            `Community Discord role "${role.key}" conflicts with retained showcase role "${conflict.key}".`,
          );
        }
      }

      if (role.enabled && role.kind === 'level-range') {
        const conflict = retained.find(
          (existing) =>
            existing.enabled &&
            existing.kind === 'level-range' &&
            communityDiscordRoleRangesOverlap(role, existing),
        );
        if (conflict) {
          throw new BadRequestException(
            `Community Discord role "${role.key}" overlaps retained level role "${conflict.key}".`,
          );
        }
      }
    }
  }

  private createPreview(
    imported: CommunitySettingsTransferData,
    current: CommunitySettingsTransferData,
  ): DataTransferPreview {
    const summary: DataTransferChangeSummary = {
      created: 0,
      updated: 0,
      unchanged: 0,
      deleted: 0,
    };
    const warnings: string[] = [];

    this.compareKeyed(imported.eventRules, current.eventRules, (entry) => entry.eventType, summary);
    this.compareLevels(imported.levels, current.levels, summary);
    this.compareKeyed(imported.titles, current.titles, (entry) => entry.key, summary);
    this.compareKeyed(imported.achievements, current.achievements, (entry) => entry.key, summary);
    this.compareKeyed(imported.discordRoles, current.discordRoles, (entry) => entry.key, summary);

    this.addRetainedWarning(
      imported.eventRules,
      current.eventRules,
      (entry) => entry.eventType,
      'event rules',
      warnings,
    );
    this.addRetainedWarning(imported.titles, current.titles, (entry) => entry.key, 'titles', warnings);
    this.addRetainedWarning(
      imported.achievements,
      current.achievements,
      (entry) => entry.key,
      'achievements',
      warnings,
    );
    this.addRetainedWarning(
      imported.discordRoles,
      current.discordRoles,
      (entry) => entry.key,
      'Discord roles',
      warnings,
    );

    return { summary, warnings };
  }

  private compareKeyed<T>(
    imported: T[],
    current: T[],
    keyOf: (entry: T) => string,
    summary: DataTransferChangeSummary,
  ): void {
    const currentByKey = new Map(current.map((entry) => [keyOf(entry), entry]));
    for (const entry of imported) {
      const existing = currentByKey.get(keyOf(entry));
      if (!existing) summary.created += 1;
      else if (this.equal(entry, existing)) summary.unchanged += 1;
      else summary.updated += 1;
    }
  }

  private compareLevels(
    imported: number[],
    current: number[],
    summary: DataTransferChangeSummary,
  ): void {
    const sharedLength = Math.min(imported.length, current.length);
    for (let index = 0; index < sharedLength; index += 1) {
      if (imported[index] === current[index]) summary.unchanged += 1;
      else summary.updated += 1;
    }
    summary.created += Math.max(imported.length - current.length, 0);
    summary.deleted += Math.max(current.length - imported.length, 0);
  }

  private addRetainedWarning<T>(
    imported: T[],
    current: T[],
    keyOf: (entry: T) => string,
    label: string,
    warnings: string[],
  ): void {
    const importedKeys = new Set(imported.map(keyOf));
    const retained = current.filter((entry) => !importedKeys.has(keyOf(entry))).length;
    if (retained > 0) {
      warnings.push(
        `${retained} existing community ${label} are not part of the import and will be kept.`,
      );
    }
  }

  private requireReference<T>(
    references: ReadonlyMap<string, T>,
    key: string,
    message: string,
  ): T {
    const value = references.get(key);
    if (value === undefined) throw new BadRequestException(message);
    return value;
  }

  private equal(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}
