import type {
  CommunityLevelDefinition,
  CommunityProgressionSnapshot,
} from '@shared/community/community-progression';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
} from 'typeorm';

import {
  createCommunityDateFormatter,
  DEFAULT_COMMUNITY_TIME_ZONE,
  formatCommunityDate,
} from './community-time';
import { CommunityAchievementConditionEntry } from './entities/community-achievement-condition.entry';
import { CommunityAchievementEntry } from './entities/community-achievement.entry';
import { CommunityEventEntry } from './entities/community-event.entry';
import { CommunityLevelEntry } from './entities/community-level.entry';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { CommunityTitleEntry } from './entities/community-title.entry';
import { DiscordMembershipPeriodEntry } from './entities/discord-membership-period.entry';
import { UserAchievementEntry } from './entities/user-achievement.entry';
import { UserTitleEntry } from './entities/user-title.entry';
import { XpTransactionEntry } from './entities/xp-transaction.entry';

const DAY_MS =
  24 * 60 * 60 * 1000;

@Injectable()
export class CommunityProgressionService {
  private readonly timeZone: string;
  private readonly rewardDateFormatter:
    Intl.DateTimeFormat;

  constructor(
    @InjectDataSource()
    private readonly dataSource:
      DataSource,
    config: ConfigService,
  ) {
    this.timeZone =
      config.get<string>(
        'COMMUNITY_TIME_ZONE',
      ) ??
      DEFAULT_COMMUNITY_TIME_ZONE;
    this.rewardDateFormatter =
      createCommunityDateFormatter(
        this.timeZone,
      );
  }

  async evaluateUser(
    userUuid: string,
    triggerEventUuid: string | null =
      null,
  ): Promise<string[]> {
    return this.dataSource.transaction(
      (manager) =>
        this.evaluateUserInTransaction(
          manager,
          userUuid,
          triggerEventUuid,
        ),
    );
  }

  async evaluateUserInTransaction(
    manager: EntityManager,
    userUuid: string,
    triggerEventUuid: string | null,
  ): Promise<string[]> {
    const profile =
      await manager
        .getRepository(
          CommunityProfileEntry,
        )
        .findOne({
          where: {
            userUuid,
          },
          lock: {
            mode:
              'pessimistic_write',
          },
        });

    if (!profile) {
      throw new NotFoundException(
        `Community profile for user "${userUuid}" not found.`,
      );
    }

    const achievementRepository =
      manager.getRepository(
        CommunityAchievementEntry,
      );
    const conditionRepository =
      manager.getRepository(
        CommunityAchievementConditionEntry,
      );
    const userAchievementRepository =
      manager.getRepository(
        UserAchievementEntry,
      );

    const achievements =
      await achievementRepository.find({
        where: {
          enabled: true,
        },
        order: {
          sortOrder: 'ASC',
          key: 'ASC',
        },
      });

    if (achievements.length === 0) {
      return [];
    }

    const conditions =
      await conditionRepository.find({
        order: {
          sortOrder: 'ASC',
        },
      });
    const conditionsByAchievement =
      new Map<
        string,
        CommunityAchievementConditionEntry[]
      >();

    for (const condition of conditions) {
      const current =
        conditionsByAchievement.get(
          condition.achievementUuid,
        ) ?? [];

      current.push(condition);
      conditionsByAchievement.set(
        condition.achievementUuid,
        current,
      );
    }

    const alreadyUnlocked =
      new Set(
        (
          await userAchievementRepository
            .findBy({
              userUuid,
            })
        ).map(
          (entry) =>
            entry.achievementUuid,
        ),
      );
    const unlockedNow: string[] = [];

    for (
      let pass = 0;
      pass < achievements.length;
      pass += 1
    ) {
      const totalXp =
        await this.getTotalXpWithManager(
          manager,
          userUuid,
        );
      let changed = false;

      for (
        const achievement
        of achievements
      ) {
        if (
          alreadyUnlocked.has(
            achievement.uuid,
          )
        ) {
          continue;
        }

        const achievementConditions =
          conditionsByAchievement.get(
            achievement.uuid,
          ) ?? [];

        if (
          achievementConditions.length ===
          0
        ) {
          continue;
        }

        const results: boolean[] = [];

        for (
          const condition
          of achievementConditions
        ) {
          const value =
            await this.getMetricValue(
              manager,
              profile,
              condition,
              totalXp,
            );

          results.push(
            this.matchesCondition(
              condition,
              value,
            ),
          );
        }

        const satisfied =
          achievement.conditionMode ===
          'all'
            ? results.every(Boolean)
            : results.some(Boolean);

        if (!satisfied) {
          continue;
        }

        await this.unlockAchievement(
          manager,
          userUuid,
          achievement,
          triggerEventUuid,
        );

        alreadyUnlocked.add(
          achievement.uuid,
        );
        unlockedNow.push(
          achievement.uuid,
        );
        changed = true;
      }

      if (!changed) {
        break;
      }
    }

    return unlockedNow;
  }

  async getTotalXp(
    userUuid: string,
  ): Promise<number> {
    return this.getTotalXpWithManager(
      this.dataSource.manager,
      userUuid,
    );
  }

  async getSnapshot(
    userUuid: string,
  ): Promise<CommunityProgressionSnapshot> {
    await this.evaluateUser(
      userUuid,
    );

    const [
      profile,
      totalXp,
      userAchievements,
      userTitles,
    ] = await Promise.all([
      this.dataSource
        .getRepository(
          CommunityProfileEntry,
        )
        .findOneBy({
          userUuid,
        }),
      this.getTotalXp(
        userUuid,
      ),
      this.dataSource
        .getRepository(
          UserAchievementEntry,
        )
        .findBy({
          userUuid,
        }),
      this.dataSource
        .getRepository(
          UserTitleEntry,
        )
        .findBy({
          userUuid,
        }),
    ]);

    if (!profile) {
      throw new NotFoundException(
        `Community profile for user "${userUuid}" not found.`,
      );
    }

    const level =
      await this.findCurrentLevel(
        this.dataSource.manager,
        totalXp,
      );

    return {
      totalXp,
      level:
        level
          ? this.mapLevel(level)
          : null,
      selectedTitleId:
        profile.selectedTitleUuid,
      unlockedTitleIds:
        userTitles.map(
          (title) =>
            title.titleUuid,
        ),
      unlockedAchievementIds:
        userAchievements.map(
          (achievement) =>
            achievement.achievementUuid,
        ),
    };
  }

  async selectTitle(
    userUuid: string,
    titleUuid: string | null,
  ): Promise<void> {
    await this.dataSource.transaction(
      async (manager) => {
        const profileRepository =
          manager.getRepository(
            CommunityProfileEntry,
          );
        const profile =
          await profileRepository
            .findOne({
              where: {
                userUuid,
              },
              lock: {
                mode:
                  'pessimistic_write',
              },
            });

        if (!profile) {
          throw new NotFoundException(
            `Community profile for user "${userUuid}" not found.`,
          );
        }

        if (titleUuid) {
          const [
            title,
            unlockedTitle,
          ] = await Promise.all([
            manager
              .getRepository(
                CommunityTitleEntry,
              )
              .findOneBy({
                uuid: titleUuid,
                enabled: true,
              }),
            manager
              .getRepository(
                UserTitleEntry,
              )
              .findOneBy({
                userUuid,
                titleUuid,
              }),
          ]);

          if (
            !title ||
            !unlockedTitle
          ) {
            throw new BadRequestException(
              'The selected community title is not unlocked and active.',
            );
          }
        }

        profile.selectedTitleUuid =
          titleUuid;

        await profileRepository.save(
          profile,
        );
      },
    );
  }

  private async unlockAchievement(
    manager: EntityManager,
    userUuid: string,
    achievement:
      CommunityAchievementEntry,
    triggerEventUuid: string | null,
  ): Promise<void> {
    const now = new Date();

    await manager
      .getRepository(
        UserAchievementEntry,
      )
      .save({
        userUuid,
        achievementUuid:
          achievement.uuid,
        triggerEventUuid,
        unlockedAt: now,
      });

    if (
      achievement.unlockedTitleUuid
    ) {
      const titleRepository =
        manager.getRepository(
          UserTitleEntry,
        );
      const existing =
        await titleRepository
          .findOneBy({
            userUuid,
            titleUuid:
              achievement.unlockedTitleUuid,
          });

      if (!existing) {
        await titleRepository.save(
          titleRepository.create({
            userUuid,
            titleUuid:
              achievement.unlockedTitleUuid,
            sourceAchievementUuid:
              achievement.uuid,
            unlockedAt: now,
          }),
        );
      }
    }

    const eventRepository =
      manager.getRepository(
        CommunityEventEntry,
      );
    const event =
      await eventRepository.save(
        eventRepository.create({
          userUuid,
          type:
            'achievement.unlocked',
          source: 'system',
          sourceEventId:
            `achievement:${userUuid}:${achievement.uuid}`,
          contextId:
            achievement.uuid,
          metadata: {
            achievementId:
              achievement.uuid,
            achievementKey:
              achievement.key,
          },
          occurredAt: now,
        }),
      );

    if (achievement.xpReward > 0) {
      await manager
        .getRepository(
          XpTransactionEntry,
        )
        .save({
          userUuid,
          eventUuid: event.uuid,
          eventType:
            'achievement.unlocked',
          amount:
            achievement.xpReward,
          rewardDate:
            formatCommunityDate(
              this.rewardDateFormatter,
              now,
            ),
          contextId:
            achievement.uuid,
          occurredAt: now,
        });
    }
  }

  private async getMetricValue(
    manager: EntityManager,
    profile: CommunityProfileEntry,
    condition:
      CommunityAchievementConditionEntry,
    totalXp: number,
  ): Promise<number> {
    switch (condition.metric) {
      case 'total-xp':
        return totalXp;

      case 'level-reached': {
        const level =
          await this.findCurrentLevel(
            manager,
            totalXp,
          );

        return level?.level ?? 0;
      }

      case 'event-count':
        if (!condition.eventType) {
          return 0;
        }

        return manager
          .getRepository(
            CommunityEventEntry,
          )
          .countBy({
            userUuid:
              profile.userUuid,
            type:
              condition.eventType,
          });

      case 'distinct-event-days':
        if (!condition.eventType) {
          return 0;
        }

        return this.getDistinctEventDays(
          manager,
          profile.userUuid,
          condition.eventType,
        );

      case 'discord-membership-current-days':
        return this.getCurrentMembershipDays(
          profile,
        );

      case 'discord-membership-total-days':
        return this.getTotalMembershipDays(
          manager,
          profile.userUuid,
        );

      case 'twitch-subscription-months':
        return this.getMaximumMetadataValue(
          manager,
          profile.userUuid,
          [
            'twitch.subscription.started',
            'twitch.subscription.resub',
            'twitch.subscription.month',
          ],
          'cumulativeMonths',
        );

      case 'twitch-watch-streak':
        return this.getMaximumMetadataValue(
          manager,
          profile.userUuid,
          ['twitch.watch-streak'],
          'streakCount',
        );
    }
  }

  private matchesCondition(
    condition:
      CommunityAchievementConditionEntry,
    value: number,
  ): boolean {
    switch (condition.operator) {
      case 'gte':
        return value >=
          condition.threshold;
    }
  }

  private async getDistinctEventDays(
    manager: EntityManager,
    userUuid: string,
    eventType: string,
  ): Promise<number> {
    const rows =
      await manager.query(
        `
          SELECT COUNT(
            DISTINCT (
              "occurredAt" AT TIME ZONE $3
            )::date
          )::int AS "value"
          FROM "community_events"
          WHERE "userUuid" = $1
            AND "type" = $2
        `,
        [
          userUuid,
          eventType,
          this.timeZone,
        ],
      ) as Array<{
        value: number | string;
      }>;

    return Number(
      rows[0]?.value ?? 0,
    );
  }

  private getCurrentMembershipDays(
    profile: CommunityProfileEntry,
  ): number {
    if (
      !profile.isDiscordMember ||
      !profile.currentDiscordJoinAt
    ) {
      return 0;
    }

    return this.getCalendarDayDifference(
      profile.currentDiscordJoinAt,
      new Date(),
    );
  }

  private getCalendarDayDifference(
    start: Date,
    end: Date,
  ): number {
    const startDate =
      formatCommunityDate(
        this.rewardDateFormatter,
        start,
      );
    const endDate =
      formatCommunityDate(
        this.rewardDateFormatter,
        end,
      );

    return Math.max(
      0,
      Math.floor(
        (
          Date.parse(
            `${endDate}T00:00:00Z`,
          ) -
          Date.parse(
            `${startDate}T00:00:00Z`,
          )
        ) /
          DAY_MS,
      ),
    );
  }

  private async getTotalMembershipDays(
    manager: EntityManager,
    userUuid: string,
  ): Promise<number> {
    const periods =
      await manager
        .getRepository(
          DiscordMembershipPeriodEntry,
        )
        .findBy({
          userUuid,
        });
    const now = Date.now();
    const milliseconds =
      periods.reduce(
        (total, period) =>
          total +
          Math.max(
            0,
            (
              period.leftAt?.getTime() ??
              now
            ) -
              period.joinedAt.getTime(),
          ),
        0,
      );

    return Math.floor(
      milliseconds / DAY_MS,
    );
  }

  private async getMaximumMetadataValue(
    manager: EntityManager,
    userUuid: string,
    eventTypes: string[],
    metadataKey: string,
  ): Promise<number> {
    const rows =
      await manager.query(
        `
          SELECT COALESCE(
            MAX(
              CASE
                WHEN "metadata"->>$3 ~ '^[0-9]+$'
                THEN ("metadata"->>$3)::int
                ELSE 0
              END
            ),
            0
          )::int AS "value"
          FROM "community_events"
          WHERE "userUuid" = $1
            AND "type" = ANY($2::varchar[])
        `,
        [
          userUuid,
          eventTypes,
          metadataKey,
        ],
      ) as Array<{
        value: number | string;
      }>;

    return Number(
      rows[0]?.value ?? 0,
    );
  }

  private async getTotalXpWithManager(
    manager: EntityManager,
    userUuid: string,
  ): Promise<number> {
    const result =
      await manager
        .getRepository(
          XpTransactionEntry,
        )
        .createQueryBuilder(
          'transaction',
        )
        .select(
          'COALESCE(SUM(transaction.amount), 0)',
          'total',
        )
        .where(
          'transaction.userUuid = :userUuid',
          {
            userUuid,
          },
        )
        .getRawOne<{
          total: string;
        }>();

    return Number(
      result?.total ?? 0,
    );
  }

  private findCurrentLevel(
    manager: EntityManager,
    totalXp: number,
  ): Promise<CommunityLevelEntry | null> {
    return manager
      .getRepository(
        CommunityLevelEntry,
      )
      .findOne({
        where: {
          requiredXp:
            LessThanOrEqual(totalXp),
        },
        order: {
          requiredXp: 'DESC',
          level: 'DESC',
        },
      });
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
}
