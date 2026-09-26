import type {
  CommunityEventRule,
  CommunityEventType,
  SaveCommunityEventRule,
} from '@shared/community/community-event';
import type {
  CommunityAchievementConditionMode,
  CommunityAchievementDefinition,
  CommunityAchievementMetric,
  CommunityLevelDefinition,
  CommunityTitleDefinition,
  SaveCommunityAchievementDefinition,
  SaveCommunityLevelDefinition,
  SaveCommunityTitleDefinition,
} from '@shared/community/community-progression';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  firstValueFrom,
  forkJoin,
} from 'rxjs';

import { Button } from '../../../components/button/button';
import {
  AdminCommunityService,
  type CommunityAchievementMetricInfo,
  type CommunityEventTypeInfo,
} from '../../../core/community/admin-community.service';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';

type CommunityAdminSection =
  | 'activity'
  | 'levels'
  | 'titles'
  | 'achievements';

interface EventRuleDraft
  extends SaveCommunityEventRule {
  eventType: CommunityEventType;
  supportsContentLength: boolean;
}

interface LevelDraft {
  level: number;
  persisted: boolean;
  enabled: boolean;
  requiredXp: number;
  nameDe: string;
  nameEn: string;
  displayColor: string;
  discordRoleId: string;
  badgeAssetId: string;
}

interface TitleDraft {
  id: string | null;
  key: string;
  persisted: boolean;
  enabled: boolean;
  nameDe: string;
  nameEn: string;
  descriptionDe: string;
  descriptionEn: string;
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
  conditionMode:
    CommunityAchievementConditionMode;
  conditions: AchievementConditionDraft[];
  xpReward: number;
  unlockedTitleId: string | null;
  discordRoleId: string;
  sortOrder: number;
}

const DEFINITION_KEY_PATTERN =
  /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    FormsModule,
    I18nPipe,
  ],
  selector: 'app-admin-community',
  styleUrl: './admin-community.scss',
  templateUrl: './admin-community.html',
})
export class AdminCommunity
  implements OnInit
{
  private readonly service =
    inject(AdminCommunityService);

  protected readonly section =
    signal<CommunityAdminSection>(
      'activity',
    );
  protected readonly loading =
    signal(true);
  protected readonly savingKey =
    signal<string | null>(null);
  protected readonly statusKey =
    signal<string | null>(null);

  protected readonly eventTypes =
    signal<CommunityEventTypeInfo[]>(
      [],
    );
  protected readonly metricInfos =
    signal<
      CommunityAchievementMetricInfo[]
    >([]);
  protected readonly eventRules =
    signal<EventRuleDraft[]>([]);
  protected readonly levels =
    signal<LevelDraft[]>([]);
  protected readonly titles =
    signal<TitleDraft[]>([]);
  protected readonly achievements =
    signal<AchievementDraft[]>([]);
  protected readonly selectedAchievement =
    signal<AchievementDraft | null>(
      null,
    );

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected setSection(
    section: CommunityAdminSection,
  ): void {
    this.section.set(section);
    this.statusKey.set(null);
  }

  protected eventTypeLabelKey(
    eventType: CommunityEventType,
  ): string {
    return `admin.community.eventType.${eventType}`;
  }

  protected metricLabelKey(
    metric: CommunityAchievementMetric,
  ): string {
    return `admin.community.metric.${metric}`;
  }

  protected async saveRule(
    draft: EventRuleDraft,
  ): Promise<void> {
    const key =
      `rule:${draft.eventType}`;

    this.beginSave(key);

    try {
      const saved =
        await firstValueFrom(
          this.service.saveEventRule(
            draft.eventType,
            {
              enabled: draft.enabled,
              xpAmount: draft.xpAmount,
              dailyRewardLimit:
                draft.dailyRewardLimit,
              contextRewardLimit:
                draft.contextRewardLimit,
              cooldownSeconds:
                draft.cooldownSeconds,
              minimumContentLength:
                draft.supportsContentLength
                  ? draft.minimumContentLength
                  : null,
            },
          ),
        );

      const info =
        this.eventTypes().find(
          (candidate) =>
            candidate.eventType ===
            saved.eventType,
        );

      if (info) {
        this.eventRules.update(
          (rules) =>
            rules.map((rule) =>
              rule.eventType ===
              saved.eventType
                ? this.toEventRuleDraft(
                    info,
                    saved,
                  )
                : rule,
            ),
        );
      }
      this.statusKey.set(
        'admin.community.saved',
      );
    } catch {
      this.statusKey.set(
        'admin.community.saveFailed',
      );
    } finally {
      this.savingKey.set(null);
    }
  }

  protected addLevel(): void {
    const nextLevel =
      Math.max(
        0,
        ...this.levels().map(
          (level) => level.level,
        ),
      ) + 1;

    this.levels.update((levels) => [
      ...levels,
      {
        level: nextLevel,
        persisted: false,
        enabled: true,
        requiredXp: 0,
        nameDe: '',
        nameEn: '',
        displayColor: '',
        discordRoleId: '',
        badgeAssetId: '',
      },
    ]);
  }

  protected async saveLevel(
    draft: LevelDraft,
  ): Promise<void> {
    if (
      draft.level < 1 ||
      !draft.nameDe.trim()
    ) {
      this.statusKey.set(
        'admin.community.saveFailed',
      );
      return;
    }

    const key = `level:${draft.level}`;
    this.beginSave(key);

    try {
      const saved =
        await firstValueFrom(
          this.service.saveLevel(
            draft.level,
            this.levelInput(draft),
          ),
        );

      this.levels.update(
        (levels) =>
          levels
            .filter(
              (level) =>
                level === draft ||
                level.level !==
                  saved.level,
            )
            .map((level) =>
              level === draft
                ? this.toLevelDraft(
                    saved,
                  )
                : level,
            )
            .sort(
              (left, right) =>
                left.requiredXp -
                  right.requiredXp ||
                left.level - right.level,
            ),
      );
      this.statusKey.set(
        'admin.community.saved',
      );
    } catch {
      this.statusKey.set(
        'admin.community.saveFailed',
      );
    } finally {
      this.savingKey.set(null);
    }
  }

  protected addTitle(): void {
    this.titles.update((titles) => [
      ...titles,
      {
        id: null,
        key: '',
        persisted: false,
        enabled: true,
        nameDe: '',
        nameEn: '',
        descriptionDe: '',
        descriptionEn: '',
      },
    ]);
  }

  protected async saveTitle(
    draft: TitleDraft,
  ): Promise<void> {
    if (
      !this.validDefinitionKey(
        draft.key,
      ) ||
      !draft.nameDe.trim()
    ) {
      this.statusKey.set(
        'admin.community.saveFailed',
      );
      return;
    }

    const key = `title:${draft.key}`;
    this.beginSave(key);

    try {
      const saved =
        await firstValueFrom(
          this.service.saveTitle(
            draft.key,
            this.titleInput(draft),
          ),
        );
      const mapped =
        this.toTitleDraft(saved);

      this.titles.update(
        (titles) =>
          titles
            .filter(
              (title) =>
                title === draft ||
                title.id !== saved.id,
            )
            .map((title) =>
              title === draft
                ? mapped
                : title,
            )
            .sort((left, right) =>
              left.key.localeCompare(
                right.key,
              ),
            ),
      );
      this.statusKey.set(
        'admin.community.saved',
      );
    } catch {
      this.statusKey.set(
        'admin.community.saveFailed',
      );
    } finally {
      this.savingKey.set(null);
    }
  }

  protected createAchievement(): void {
    const achievement =
      this.emptyAchievement();

    this.achievements.update(
      (achievements) => [
        ...achievements,
        achievement,
      ],
    );
    this.selectedAchievement.set(
      achievement,
    );
  }

  protected editAchievement(
    achievement: AchievementDraft,
  ): void {
    this.selectedAchievement.set(
      achievement,
    );
    this.statusKey.set(null);
  }

  protected addCondition(
    achievement: AchievementDraft,
  ): void {
    achievement.conditions.push({
      metric: 'total-xp',
      threshold: 1,
      eventType: null,
    });
  }

  protected removeCondition(
    achievement: AchievementDraft,
    index: number,
  ): void {
    if (
      achievement.conditions.length <= 1
    ) {
      return;
    }

    achievement.conditions.splice(
      index,
      1,
    );
  }

  protected conditionMetricChanged(
    condition: AchievementConditionDraft,
  ): void {
    if (
      this.metricRequiresEventType(
        condition.metric,
      )
    ) {
      condition.eventType =
        condition.eventType ??
        this.eventTypes()[0]
          ?.eventType ?? null;
      return;
    }

    condition.eventType = null;
  }

  protected metricRequiresEventType(
    metric: CommunityAchievementMetric,
  ): boolean {
    return this.metricInfos().find(
      (info) =>
        info.metric === metric,
    )?.requiresEventType ?? false;
  }

  protected async saveAchievement(
    draft: AchievementDraft,
  ): Promise<void> {
    if (!this.canSaveAchievement(draft)) {
      this.statusKey.set(
        'admin.community.saveFailed',
      );
      return;
    }

    const key =
      `achievement:${draft.key}`;
    this.beginSave(key);

    try {
      const saved =
        await firstValueFrom(
          this.service.saveAchievement(
            draft.key,
            this.achievementInput(
              draft,
            ),
          ),
        );
      const mapped =
        this.toAchievementDraft(
          saved,
        );

      this.achievements.update(
        (achievements) =>
          achievements
            .filter(
              (achievement) =>
                achievement === draft ||
                achievement.id !==
                  saved.id,
            )
            .map((achievement) =>
              achievement === draft
                ? mapped
                : achievement,
            )
            .sort(
              (left, right) =>
                left.sortOrder -
                  right.sortOrder ||
                left.key.localeCompare(
                  right.key,
                ),
            ),
      );
      this.selectedAchievement.set(
        mapped,
      );
      this.statusKey.set(
        'admin.community.saved',
      );
    } catch {
      this.statusKey.set(
        'admin.community.saveFailed',
      );
    } finally {
      this.savingKey.set(null);
    }
  }

  protected validDefinitionKey(
    key: string,
  ): boolean {
    return DEFINITION_KEY_PATTERN.test(
      key.trim().toLowerCase(),
    );
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.statusKey.set(null);

    try {
      const result =
        await firstValueFrom(
          forkJoin({
            eventTypes:
              this.service.getEventTypes(),
            eventRules:
              this.service.getEventRules(),
            metrics:
              this.service.getAchievementMetrics(),
            levels:
              this.service.getLevels(),
            titles:
              this.service.getTitles(),
            achievements:
              this.service.getAchievements(),
          }),
        );

      this.eventTypes.set(
        result.eventTypes,
      );
      this.metricInfos.set(
        result.metrics,
      );

      const rules = new Map(
        result.eventRules.map(
          (rule) => [
            rule.eventType,
            rule,
          ],
        ),
      );
      this.eventRules.set(
        result.eventTypes.map(
          (info) =>
            this.toEventRuleDraft(
              info,
              rules.get(
                info.eventType,
              ) ?? null,
            ),
        ),
      );
      this.levels.set(
        result.levels.map((level) =>
          this.toLevelDraft(level),
        ),
      );
      this.titles.set(
        result.titles.map((title) =>
          this.toTitleDraft(title),
        ),
      );
      this.achievements.set(
        result.achievements.map(
          (achievement) =>
            this.toAchievementDraft(
              achievement,
            ),
        ),
      );
    } catch {
      this.statusKey.set(
        'admin.community.loadFailed',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private beginSave(key: string): void {
    this.savingKey.set(key);
    this.statusKey.set(null);
  }

  private toEventRuleDraft(
    info: CommunityEventTypeInfo,
    rule: CommunityEventRule | null,
  ): EventRuleDraft {
    return {
      eventType: info.eventType,
      supportsContentLength:
        info.supportsContentLength,
      enabled: rule?.enabled ?? false,
      xpAmount: rule?.xpAmount ?? 0,
      dailyRewardLimit:
        rule?.dailyRewardLimit ?? null,
      contextRewardLimit:
        rule?.contextRewardLimit ?? null,
      cooldownSeconds:
        rule?.cooldownSeconds ?? null,
      minimumContentLength:
        rule?.minimumContentLength ?? null,
    };
  }

  private toLevelDraft(
    level: CommunityLevelDefinition,
  ): LevelDraft {
    return {
      level: level.level,
      persisted: true,
      enabled: level.enabled,
      requiredXp: level.requiredXp,
      nameDe: level.name.de,
      nameEn: level.name.en ?? '',
      displayColor:
        level.displayColor ?? '',
      discordRoleId:
        level.discordRoleId ?? '',
      badgeAssetId:
        level.badgeAssetId ?? '',
    };
  }

  private levelInput(
    draft: LevelDraft,
  ): SaveCommunityLevelDefinition {
    return {
      enabled: draft.enabled,
      requiredXp: draft.requiredXp,
      name: {
        de: draft.nameDe.trim(),
        en: this.nullableText(
          draft.nameEn,
        ),
      },
      displayColor:
        this.nullableText(
          draft.displayColor,
        ),
      discordRoleId:
        this.nullableText(
          draft.discordRoleId,
        ),
      badgeAssetId:
        this.nullableText(
          draft.badgeAssetId,
        ),
    };
  }

  private toTitleDraft(
    title: CommunityTitleDefinition,
  ): TitleDraft {
    return {
      id: title.id,
      key: title.key,
      persisted: true,
      enabled: title.enabled,
      nameDe: title.name.de,
      nameEn: title.name.en ?? '',
      descriptionDe:
        title.description.de,
      descriptionEn:
        title.description.en ?? '',
    };
  }

  private titleInput(
    draft: TitleDraft,
  ): SaveCommunityTitleDefinition {
    return {
      enabled: draft.enabled,
      name: {
        de: draft.nameDe.trim(),
        en: this.nullableText(
          draft.nameEn,
        ),
      },
      description: {
        de: draft.descriptionDe.trim(),
        en: this.nullableText(
          draft.descriptionEn,
        ),
      },
    };
  }

  private toAchievementDraft(
    achievement:
      CommunityAchievementDefinition,
  ): AchievementDraft {
    return {
      id: achievement.id,
      key: achievement.key,
      persisted: true,
      enabled: achievement.enabled,
      nameDe: achievement.name.de,
      nameEn:
        achievement.name.en ?? '',
      descriptionDe:
        achievement.description.de,
      descriptionEn:
        achievement.description.en ?? '',
      badgeAssetId:
        achievement.badgeAssetId ?? '',
      conditionMode:
        achievement.conditionMode,
      conditions:
        achievement.conditions.map(
          (condition) => ({
            metric: condition.metric,
            threshold:
              condition.threshold,
            eventType:
              condition.eventType,
          }),
        ),
      xpReward:
        achievement.xpReward,
      unlockedTitleId:
        achievement.unlockedTitleId,
      discordRoleId:
        achievement.discordRoleId ?? '',
      sortOrder:
        achievement.sortOrder,
    };
  }

  private emptyAchievement():
    AchievementDraft {
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
          metric: 'total-xp',
          threshold: 1,
          eventType: null,
        },
      ],
      xpReward: 0,
      unlockedTitleId: null,
      discordRoleId: '',
      sortOrder:
        this.achievements().length,
    };
  }

  private achievementInput(
    draft: AchievementDraft,
  ): SaveCommunityAchievementDefinition {
    return {
      enabled: draft.enabled,
      name: {
        de: draft.nameDe.trim(),
        en: this.nullableText(
          draft.nameEn,
        ),
      },
      description: {
        de: draft.descriptionDe.trim(),
        en: this.nullableText(
          draft.descriptionEn,
        ),
      },
      badgeAssetId:
        this.nullableText(
          draft.badgeAssetId,
        ),
      conditionMode:
        draft.conditionMode,
      conditions:
        draft.conditions.map(
          (condition) => ({
            metric: condition.metric,
            operator: 'gte',
            threshold:
              condition.threshold,
            eventType:
              this.metricRequiresEventType(
                condition.metric,
              )
                ? condition.eventType
                : null,
          }),
        ),
      xpReward: draft.xpReward,
      unlockedTitleId:
        draft.unlockedTitleId,
      discordRoleId:
        this.nullableText(
          draft.discordRoleId,
        ),
      sortOrder: draft.sortOrder,
    };
  }

  private canSaveAchievement(
    draft: AchievementDraft,
  ): boolean {
    return (
      this.validDefinitionKey(
        draft.key,
      ) &&
      draft.nameDe.trim().length > 0 &&
      draft.conditions.length > 0 &&
      draft.conditions.every(
        (condition) =>
          Number.isSafeInteger(
            condition.threshold,
          ) &&
          condition.threshold > 0 &&
          (
            !this.metricRequiresEventType(
              condition.metric,
            ) ||
            condition.eventType !== null
          ),
      )
    );
  }

  private nullableText(
    value: string,
  ): string | null {
    const normalized = value.trim();

    return normalized || null;
  }
}
