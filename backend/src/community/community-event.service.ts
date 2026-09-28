import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  In,
} from 'typeorm';

import type {
  CommunityRewardStatus,
  RecordCommunityEventInput,
  RecordCommunityEventResult,
} from './community-event';
import { CommunityProgressionService } from './community-progression.service';
import { CommunityRewardSyncService } from './community-reward-sync.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import {
  createCommunityDateFormatter,
  DEFAULT_COMMUNITY_TIME_ZONE,
  formatCommunityDate,
} from './community-time';
import { CommunityAchievementEntry } from './entities/community-achievement.entry';
import { CommunityEventEntry } from './entities/community-event.entry';
import { CommunityEventRuleEntry } from './entities/community-event-rule.entry';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { XpTransactionEntry } from './entities/xp-transaction.entry';

@Injectable()
export class CommunityEventService {
  private readonly logger =
    new Logger(
      CommunityEventService.name,
    );
  private readonly rewardDateFormatter:
    Intl.DateTimeFormat;

  constructor(
    @InjectDataSource()
    private readonly dataSource:
      DataSource,
    private readonly progression:
      CommunityProgressionService,
    private readonly rewardSync:
      CommunityRewardSyncService,
    private readonly notificationEvents:
      NotificationEventsService,
    config: ConfigService,
  ) {
    const timeZone =
      config.get<string>(
        'COMMUNITY_TIME_ZONE',
      ) ??
      DEFAULT_COMMUNITY_TIME_ZONE;

    this.rewardDateFormatter =
      createCommunityDateFormatter(
        timeZone,
      );
  }

  async recordEvent(
    input: RecordCommunityEventInput,
  ): Promise<RecordCommunityEventResult> {
    this.validateInput(input);

    let unlockedAchievementIds: string[] = [];

    const result =
      await this.dataSource.transaction<
        RecordCommunityEventResult
      >(async (manager) => {
        const profile =
          await manager
            .getRepository(
              CommunityProfileEntry,
            )
            .findOne({
              where: {
                userUuid:
                  input.userUuid,
              },
              lock: {
                mode:
                  'pessimistic_write',
              },
            });

        if (!profile) {
          throw new NotFoundException(
            `Community profile for user "${input.userUuid}" not found.`,
          );
        }

        const eventRepository =
          manager.getRepository(
            CommunityEventEntry,
          );
        const sourceEventId =
          input.sourceEventId?.trim() ||
          null;

        if (sourceEventId) {
          const duplicate =
            await eventRepository.findOneBy({
              source: input.source,
              sourceEventId,
            });

          if (duplicate) {
            const transaction =
              await manager
                .getRepository(
                  XpTransactionEntry,
                )
                .findOneBy({
                  eventUuid:
                    duplicate.uuid,
                });

            return {
              status: 'duplicate',
              rewardStatus:
                transaction
                  ? 'granted'
                  : 'not-applicable',
              event: duplicate,
              xpTransaction:
                transaction,
            };
          }
        }

        const rule =
          await manager
            .getRepository(
              CommunityEventRuleEntry,
            )
            .findOneBy({
              eventType: input.type,
            });

        if (
          rule?.minimumContentLength !==
            null &&
          rule?.minimumContentLength !==
            undefined &&
          (
            input.contentLength ===
              undefined ||
            input.contentLength <
              rule.minimumContentLength
          )
        ) {
          return {
            status: 'rejected',
            rewardStatus:
              'not-applicable',
            event: null,
            xpTransaction: null,
          };
        }

        const event =
          await eventRepository.save(
            eventRepository.create({
              userUuid:
                input.userUuid,
              type: input.type,
              source: input.source,
              sourceEventId,
              contextId:
                input.contextId
                  ?.trim() || null,
              occurredAt:
                input.occurredAt ??
                new Date(),
              metadata:
                input.metadata ?? null,
            }),
          );
        const reward =
          await this.applyReward(
            manager,
            event,
            rule,
          );

        unlockedAchievementIds =
          await this.progression
            .evaluateUserInTransaction(
              manager,
              event.userUuid,
              event.uuid,
            );

        return {
          status: 'recorded',
          rewardStatus:
            reward.status,
          event,
          xpTransaction:
            reward.transaction,
        };
      },
    );

    if (unlockedAchievementIds.length > 0) {
      this.rewardSync.request(
        input.userUuid,
      );

      if (
        result.event &&
        input.type !==
          'blog.comment.featured'
      ) {
        await this.publishProgressNotification(
          input.userUuid,
          result.event.uuid,
          unlockedAchievementIds,
        );
      }
    }

    return result;
  }

  private async publishProgressNotification(
    userUuid: string,
    sourceEventUuid: string,
    achievementIds: readonly string[],
  ): Promise<void> {
    try {
      const achievements =
        await this.dataSource
          .getRepository(
            CommunityAchievementEntry,
          )
          .findBy({
            uuid: In([
              ...achievementIds,
            ]),
          });
      const items = achievementIds
        .flatMap((achievementId) => {
          const achievement =
            achievements.find(
              (candidate) =>
                candidate.uuid ===
                achievementId,
            );

          if (!achievement) {
            return [];
          }

          return [
            {
              uuid: achievement.uuid,
              nameDe: achievement.nameDe,
              nameEn:
                achievement.nameEn ??
                achievement.nameDe,
              hasAdditionalRewards:
                achievement.xpReward > 0 ||
                achievement.unlockedTitleUuid !==
                  null ||
                achievement.unlockedProfileColor !==
                  null ||
                achievement.discordRoleId !==
                  null,
            },
          ];
        });

      if (items.length === 0) {
        return;
      }

      this.notificationEvents.publish(
        'community.progress.unlocked',
        {
          userUuid,
          sourceEventUuid,
          achievements: items,
        },
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Could not prepare community progress notification for user ${userUuid}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getTotalXp(
    userUuid: string,
  ): Promise<number> {
    return this.progression.getTotalXp(
      userUuid,
    );
  }

  private async applyReward(
    manager: EntityManager,
    event: CommunityEventEntry,
    rule: CommunityEventRuleEntry | null,
  ): Promise<{
    status: CommunityRewardStatus;
    transaction: XpTransactionEntry | null;
  }> {
    if (!rule) {
      return {
        status: 'no-rule',
        transaction: null,
      };
    }

    if (!rule.enabled) {
      return {
        status: 'disabled',
        transaction: null,
      };
    }

    if (rule.xpAmount === 0) {
      return {
        status: 'zero-xp',
        transaction: null,
      };
    }

    const repository =
      manager.getRepository(
        XpTransactionEntry,
      );
    const rewardDate =
      formatCommunityDate(
        this.rewardDateFormatter,
        event.occurredAt,
      );

    if (
      rule.dailyRewardLimit !==
      null
    ) {
      const rewardedToday =
        await repository.countBy({
          userUuid:
            event.userUuid,
          eventType:
            event.type,
          rewardDate,
        });

      if (
        rewardedToday >=
        rule.dailyRewardLimit
      ) {
        return {
          status: 'daily-limit',
          transaction: null,
        };
      }
    }

    if (
      rule.contextRewardLimit !==
      null
    ) {
      if (!event.contextId) {
        return {
          status:
            'missing-context',
          transaction: null,
        };
      }

      const rewardedInContext =
        await repository.countBy({
          userUuid:
            event.userUuid,
          eventType:
            event.type,
          contextId:
            event.contextId,
        });

      if (
        rewardedInContext >=
        rule.contextRewardLimit
      ) {
        return {
          status: 'context-limit',
          transaction: null,
        };
      }
    }

    if (
      rule.cooldownSeconds !==
        null &&
      rule.cooldownSeconds > 0
    ) {
      const cooldownStart =
        new Date(
          event.occurredAt.getTime() -
            rule.cooldownSeconds *
              1000,
        );
      const recentReward =
        await repository.findOne({
          where: {
            userUuid:
              event.userUuid,
            eventType:
              event.type,
            occurredAt: Between(
              cooldownStart,
              event.occurredAt,
            ),
          },
          order: {
            occurredAt: 'DESC',
          },
        });

      if (recentReward) {
        return {
          status: 'cooldown',
          transaction: null,
        };
      }
    }

    const transaction =
      await repository.save(
        repository.create({
          userUuid:
            event.userUuid,
          eventUuid: event.uuid,
          eventType: event.type,
          amount: rule.xpAmount,
          rewardDate,
          contextId:
            event.contextId,
          occurredAt:
            event.occurredAt,
        }),
      );

    return {
      status: 'granted',
      transaction,
    };
  }

  private validateInput(
    input: RecordCommunityEventInput,
  ): void {
    if (
      input.contentLength !==
        undefined &&
      (
        !Number.isSafeInteger(
          input.contentLength,
        ) ||
        input.contentLength < 0
      )
    ) {
      throw new BadRequestException(
        'contentLength must be a non-negative integer.',
      );
    }

    if (
      input.occurredAt &&
      Number.isNaN(
        input.occurredAt.getTime(),
      )
    ) {
      throw new BadRequestException(
        'occurredAt must be a valid date.',
      );
    }
  }
}
