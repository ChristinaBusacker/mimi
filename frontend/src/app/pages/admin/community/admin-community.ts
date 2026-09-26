import type { CommunityBalancingDefaults } from '@shared/community/community-balancing';
import type {
  CommunityEventRule,
  CommunityEventType,
  SaveCommunityEventRule,
} from '@shared/community/community-event';
import type {
  CommunityAchievementConditionMode,
  CommunityAchievementDefinition,
  CommunityAchievementMetric,
  CommunityTitleDefinition,
  SaveCommunityAchievementDefinition,
} from '@shared/community/community-progression';

import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';

import { Button } from '../../../components/button/button';
import {
  AdminCommunityService,
  type CommunityAchievementMetricInfo,
  type CommunityEventTypeInfo,
} from '../../../core/community/admin-community.service';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';

type CommunityAdminSection = 'activity' | 'levels' | 'achievements';

interface EventRuleDraft extends SaveCommunityEventRule {
  eventType: CommunityEventType;
  supportsContentLength: boolean;
}

interface AchievementConditionDraft {
  metric: CommunityAchievementMetric;
  threshold: number;
  eventType: CommunityEventType | null;
}

interface AchievementDraft {
  id: string | null;
  key: string;
  persisted: boolean;
  enabled: boolean;
  nameDe: string;
  nameEn: string;
  descriptionDe: string;
  descriptionEn: string;
  badgeAssetId: string;
  conditionMode: CommunityAchievementConditionMode;
  conditions: AchievementConditionDraft[];
  xpReward: number;
  unlockedTitleId: string | null;
  unlockTitle: boolean;
  titleNameDe: string;
  titleNameEn: string;
  unlockProfileColor: boolean;
  unlockedProfileColor: string;
  discordRoleId: string;
  sortOrder: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, Button, FormsModule, I18nPipe],
  selector: 'app-admin-community',
  styleUrl: './admin-community.scss',
  templateUrl: './admin-community.html',
})
export class AdminCommunity implements OnInit {
  private readonly service = inject(AdminCommunityService);

  protected readonly section = signal<CommunityAdminSection>('activity');
  protected readonly loading = signal(true);
  protected readonly savingKey = signal<string | null>(null);
  protected readonly statusKey = signal<string | null>(null);
  protected readonly defaults = signal<CommunityBalancingDefaults | null>(null);
  protected readonly eventTypes = signal<CommunityEventTypeInfo[]>([]);
  protected readonly metricInfos = signal<CommunityAchievementMetricInfo[]>([]);
  protected readonly eventRules = signal<EventRuleDraft[]>([]);
  protected readonly levelXp = signal<number[]>([]);
  protected readonly titles = signal<CommunityTitleDefinition[]>([]);
  protected readonly achievements = signal<AchievementDraft[]>([]);
  protected readonly selectedAchievement = signal<AchievementDraft | null>(null);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected setSection(section: CommunityAdminSection): void {
    this.section.set(section);
    this.statusKey.set(null);
  }

  protected eventTypeLabelKey(eventType: CommunityEventType): string {
    return `admin.community.eventType.${eventType}`;
  }

  protected metricLabelKey(metric: CommunityAchievementMetric): string {
    return `admin.community.metric.${metric}`;
  }

  protected isRuleCustomized(rule: EventRuleDraft): boolean {
    const defaultRule = this.defaults()?.eventRules.find(
      (candidate) => candidate.eventType === rule.eventType,
    );

    if (!defaultRule) {
      return false;
    }

    return (
      defaultRule.enabled !== rule.enabled ||
      defaultRule.xpAmount !== rule.xpAmount ||
      defaultRule.dailyRewardLimit !== rule.dailyRewardLimit ||
      defaultRule.contextRewardLimit !== rule.contextRewardLimit ||
      defaultRule.cooldownSeconds !== rule.cooldownSeconds ||
      defaultRule.minimumContentLength !== rule.minimumContentLength
    );
  }

  protected async saveRule(draft: EventRuleDraft): Promise<void> {
    const key = `rule:${draft.eventType}`;

    this.beginSave(key);

    try {
      const saved = await firstValueFrom(
        this.service.saveEventRule(draft.eventType, this.eventRuleInput(draft)),
      );

      this.replaceRule(saved);
      this.statusKey.set('admin.community.saved');
    } catch {
      this.statusKey.set('admin.community.saveFailed');
    } finally {
      this.savingKey.set(null);
    }
  }

  protected async restoreRule(draft: EventRuleDraft): Promise<void> {
    const key = `rule:${draft.eventType}`;

    this.beginSave(key);

    try {
      const saved = await firstValueFrom(this.service.restoreEventRule(draft.eventType));

      this.replaceRule(saved);
      this.statusKey.set('admin.community.defaultRestored');
    } catch {
      this.statusKey.set('admin.community.saveFailed');
    } finally {
      this.savingKey.set(null);
    }
  }

  protected updateLevelXp(index: number, value: number): void {
    if (index === 0) {
      return;
    }

    this.levelXp.update((levels) =>
      levels.map((threshold, currentIndex) => (currentIndex === index ? value : threshold)),
    );
  }

  protected addLevel(): void {
    const levels = this.levelXp();
    const last = levels.at(-1) ?? 0;
    const previous = levels.at(-2) ?? last - 100;
    const step = Math.max(100, last - previous);

    this.levelXp.set([...levels, last + step]);
  }

  protected removeLastLevel(): void {
    if (this.levelXp().length <= 1) {
      return;
    }

    this.levelXp.update((levels) => levels.slice(0, -1));
  }

  protected isLevelConfigurationValid(): boolean {
    const levels = this.levelXp();

    return (
      levels.length > 0 &&
      levels[0] === 0 &&
      levels.every(
        (threshold, index) =>
          Number.isSafeInteger(threshold) &&
          threshold >= 0 &&
          (index === 0 || threshold > levels[index - 1]),
      )
    );
  }

  protected isLevelsCustomized(): boolean {
    const defaults = this.defaults();

    if (!defaults) {
      return false;
    }

    const levels = this.levelXp();

    return (
      levels.length !== defaults.levels.length ||
      levels.some((threshold, index) => threshold !== defaults.levels[index])
    );
  }

  protected async saveLevels(): Promise<void> {
    if (!this.isLevelConfigurationValid()) {
      this.statusKey.set('admin.community.levels.invalid');
      return;
    }

    this.beginSave('levels');

    try {
      const saved = await firstValueFrom(this.service.saveLevels(this.levelXp()));

      this.levelXp.set(
        saved.sort((left, right) => left.level - right.level).map((level) => level.requiredXp),
      );
      this.statusKey.set('admin.community.saved');
    } catch {
      this.statusKey.set('admin.community.saveFailed');
    } finally {
      this.savingKey.set(null);
    }
  }

  protected async restoreLevels(): Promise<void> {
    this.beginSave('levels');

    try {
      const saved = await firstValueFrom(this.service.restoreLevels());

      this.levelXp.set(
        saved.sort((left, right) => left.level - right.level).map((level) => level.requiredXp),
      );
      this.statusKey.set('admin.community.defaultRestored');
    } catch {
      this.statusKey.set('admin.community.saveFailed');
    } finally {
      this.savingKey.set(null);
    }
  }

  protected createAchievement(): void {
    const achievement = this.emptyAchievement();

    this.achievements.update((achievements) => [...achievements, achievement]);
    this.selectedAchievement.set(achievement);
  }

  protected editAchievement(achievement: AchievementDraft): void {
    this.selectedAchievement.set(achievement);
    this.statusKey.set(null);
  }

  protected addCondition(achievement: AchievementDraft): void {
    achievement.conditions.push({
      metric: 'total-xp',
      threshold: 1,
      eventType: null,
    });
  }

  protected removeCondition(achievement: AchievementDraft, index: number): void {
    if (achievement.conditions.length <= 1) {
      return;
    }

    achievement.conditions.splice(index, 1);
  }

  protected conditionMetricChanged(condition: AchievementConditionDraft): void {
    if (this.metricRequiresEventType(condition.metric)) {
      condition.eventType = condition.eventType ?? this.eventTypes()[0]?.eventType ?? null;
      return;
    }

    condition.eventType = null;
  }

  protected metricRequiresEventType(metric: CommunityAchievementMetric): boolean {
    return this.metricInfos().find((info) => info.metric === metric)?.requiresEventType ?? false;
  }

  protected async saveAchievement(draft: AchievementDraft): Promise<void> {
    if (!this.canSaveAchievement(draft)) {
      this.statusKey.set('admin.community.saveFailed');
      return;
    }

    const achievementKey = draft.persisted
      ? draft.key
      : this.uniqueDefinitionKey(
          draft.nameDe,
          this.achievements()
            .filter((achievement) => achievement !== draft)
            .map((achievement) => achievement.key),
        );
    const key = `achievement:${achievementKey}`;

    this.beginSave(key);

    try {
      const unlockedTitleId = await this.saveAchievementTitle(draft, achievementKey);
      const saved = await firstValueFrom(
        this.service.saveAchievement(achievementKey, this.achievementInput(draft, unlockedTitleId)),
      );
      const mapped = this.toAchievementDraft(saved);

      this.achievements.update((achievements) =>
        achievements
          .filter((achievement) => achievement === draft || achievement.id !== saved.id)
          .map((achievement) => (achievement === draft ? mapped : achievement))
          .sort(
            (left, right) =>
              left.sortOrder - right.sortOrder || left.nameDe.localeCompare(right.nameDe),
          ),
      );
      this.selectedAchievement.set(mapped);
      this.statusKey.set('admin.community.saved');
    } catch {
      this.statusKey.set('admin.community.saveFailed');
    } finally {
      this.savingKey.set(null);
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.statusKey.set(null);

    try {
      const result = await firstValueFrom(
        forkJoin({
          defaults: this.service.getDefaults(),
          eventTypes: this.service.getEventTypes(),
          eventRules: this.service.getEventRules(),
          metrics: this.service.getAchievementMetrics(),
          levels: this.service.getLevels(),
          titles: this.service.getTitles(),
          achievements: this.service.getAchievements(),
        }),
      );

      this.defaults.set(result.defaults);
      this.eventTypes.set(result.eventTypes);
      this.metricInfos.set(result.metrics);
      this.titles.set(result.titles);

      const rules = new Map(result.eventRules.map((rule) => [rule.eventType, rule]));
      const defaultRules = new Map(
        result.defaults.eventRules.map((rule) => [rule.eventType, rule]),
      );

      this.eventRules.set(
        result.eventTypes.map((info) =>
          this.toEventRuleDraft(
            info,
            rules.get(info.eventType) ?? defaultRules.get(info.eventType) ?? null,
          ),
        ),
      );
      this.levelXp.set(
        result.levels
          .sort((left, right) => left.level - right.level)
          .map((level) => level.requiredXp),
      );
      this.achievements.set(
        result.achievements.map((achievement) => this.toAchievementDraft(achievement)),
      );
    } catch {
      this.statusKey.set('admin.community.loadFailed');
    } finally {
      this.loading.set(false);
    }
  }

  private beginSave(key: string): void {
    this.savingKey.set(key);
    this.statusKey.set(null);
  }

  private eventRuleInput(draft: EventRuleDraft): SaveCommunityEventRule {
    return {
      enabled: draft.enabled,
      xpAmount: draft.xpAmount,
      dailyRewardLimit: draft.dailyRewardLimit,
      contextRewardLimit: draft.contextRewardLimit,
      cooldownSeconds: draft.cooldownSeconds,
      minimumContentLength: draft.supportsContentLength ? draft.minimumContentLength : null,
    };
  }

  private replaceRule(saved: CommunityEventRule): void {
    const info = this.eventTypes().find((candidate) => candidate.eventType === saved.eventType);

    if (!info) {
      return;
    }

    this.eventRules.update((rules) =>
      rules.map((rule) =>
        rule.eventType === saved.eventType ? this.toEventRuleDraft(info, saved) : rule,
      ),
    );
  }

  private toEventRuleDraft(
    info: CommunityEventTypeInfo,
    rule: CommunityEventRule | CommunityBalancingDefaults['eventRules'][number] | null,
  ): EventRuleDraft {
    return {
      eventType: info.eventType,
      supportsContentLength: info.supportsContentLength,
      enabled: rule?.enabled ?? false,
      xpAmount: rule?.xpAmount ?? 0,
      dailyRewardLimit: rule?.dailyRewardLimit ?? null,
      contextRewardLimit: rule?.contextRewardLimit ?? null,
      cooldownSeconds: rule?.cooldownSeconds ?? null,
      minimumContentLength: rule?.minimumContentLength ?? null,
    };
  }

  private toAchievementDraft(achievement: CommunityAchievementDefinition): AchievementDraft {
    const title = achievement.unlockedTitleId
      ? (this.titles().find((candidate) => candidate.id === achievement.unlockedTitleId) ?? null)
      : null;

    return {
      id: achievement.id,
      key: achievement.key,
      persisted: true,
      enabled: achievement.enabled,
      nameDe: achievement.name.de,
      nameEn: achievement.name.en ?? '',
      descriptionDe: achievement.description.de,
      descriptionEn: achievement.description.en ?? '',
      badgeAssetId: achievement.badgeAssetId ?? '',
      conditionMode: achievement.conditionMode,
      conditions: achievement.conditions.map((condition) => ({
        metric: condition.metric,
        threshold: condition.threshold,
        eventType: condition.eventType,
      })),
      xpReward: achievement.xpReward,
      unlockedTitleId: achievement.unlockedTitleId,
      unlockTitle: title !== null,
      titleNameDe: title?.name.de ?? '',
      titleNameEn: title?.name.en ?? '',
      unlockProfileColor: achievement.unlockedProfileColor !== null,
      unlockedProfileColor: achievement.unlockedProfileColor ?? '#fcaac1',
      discordRoleId: achievement.discordRoleId ?? '',
      sortOrder: achievement.sortOrder,
    };
  }

  private emptyAchievement(): AchievementDraft {
    return {
      id: null,
      key: '',
      persisted: false,
      enabled: true,
      nameDe: '',
      nameEn: '',
      descriptionDe: '',
      descriptionEn: '',
      badgeAssetId: '',
      conditionMode: 'all',
      conditions: [
        {
          metric: 'level-reached',
          threshold: 5,
          eventType: null,
        },
      ],
      xpReward: 0,
      unlockedTitleId: null,
      unlockTitle: false,
      titleNameDe: '',
      titleNameEn: '',
      unlockProfileColor: false,
      unlockedProfileColor: '#fcaac1',
      discordRoleId: '',
      sortOrder: this.achievements().length * 10,
    };
  }

  private async saveAchievementTitle(
    draft: AchievementDraft,
    achievementKey: string,
  ): Promise<string | null> {
    if (!draft.unlockTitle) {
      return null;
    }

    const existing = draft.unlockedTitleId
      ? (this.titles().find((title) => title.id === draft.unlockedTitleId) ?? null)
      : null;
    const titleKey =
      existing?.key ??
      this.uniqueDefinitionKey(
        `${achievementKey}-title`,
        this.titles().map((title) => title.key),
      );
    const saved = await firstValueFrom(
      this.service.saveTitle(titleKey, {
        enabled: true,
        name: {
          de: draft.titleNameDe.trim(),
          en: this.nullableText(draft.titleNameEn),
        },
        description: existing
          ? { ...existing.description }
          : {
              de: '',
              en: null,
            },
      }),
    );

    this.titles.update((titles) => [...titles.filter((title) => title.id !== saved.id), saved]);

    return saved.id;
  }

  private achievementInput(
    draft: AchievementDraft,
    unlockedTitleId: string | null,
  ): SaveCommunityAchievementDefinition {
    return {
      enabled: draft.enabled,
      name: {
        de: draft.nameDe.trim(),
        en: this.nullableText(draft.nameEn),
      },
      description: {
        de: draft.descriptionDe.trim(),
        en: this.nullableText(draft.descriptionEn),
      },
      badgeAssetId: this.nullableText(draft.badgeAssetId),
      conditionMode: draft.conditions.length === 1 ? 'all' : draft.conditionMode,
      conditions: draft.conditions.map((condition) => ({
        metric: condition.metric,
        operator: 'gte',
        threshold: condition.threshold,
        eventType: this.metricRequiresEventType(condition.metric) ? condition.eventType : null,
      })),
      xpReward: draft.xpReward,
      unlockedTitleId,
      unlockedProfileColor: draft.unlockProfileColor ? draft.unlockedProfileColor : null,
      discordRoleId: this.nullableText(draft.discordRoleId),
      sortOrder: draft.sortOrder,
    };
  }

  private canSaveAchievement(draft: AchievementDraft): boolean {
    return (
      draft.nameDe.trim().length > 0 &&
      (!draft.unlockTitle || draft.titleNameDe.trim().length > 0) &&
      (!draft.unlockProfileColor || /^#[0-9a-f]{6}$/i.test(draft.unlockedProfileColor)) &&
      draft.conditions.length > 0 &&
      draft.conditions.every(
        (condition) =>
          Number.isSafeInteger(condition.threshold) &&
          condition.threshold > 0 &&
          (!this.metricRequiresEventType(condition.metric) || condition.eventType !== null),
      )
    );
  }

  private uniqueDefinitionKey(value: string, usedKeys: string[]): string {
    const used = new Set(usedKeys);
    const base = this.definitionKey(value);

    if (!used.has(base)) {
      return base;
    }

    let suffix = 2;

    while (used.has(`${base}-${suffix}`)) {
      suffix += 1;
    }

    return `${base}-${suffix}`;
  }

  private definitionKey(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replaceAll('ä', 'ae')
      .replaceAll('ö', 'oe')
      .replaceAll('ü', 'ue')
      .replaceAll('ß', 'ss')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72)
      .replace(/-+$/g, '');

    return normalized || 'achievement';
  }

  private nullableText(value: string): string | null {
    const normalized = value.trim();

    return normalized || null;
  }
}
