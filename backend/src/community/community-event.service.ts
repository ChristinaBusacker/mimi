import type {
  CommunityEventType,
} from '@shared/community/community-event';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
} from 'typeorm';

import type {
  CommunityRewardStatus,
  RecordCommunityEventInput,
  RecordCommunityEventResult,
} from './community-event';
import { CommunityEventEntry } from './entities/community-event.entry';
import { CommunityEventRuleEntry } from './entities/community-event-rule.entry';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { XpTransactionEntry } from './entities/xp-transaction.entry';

const DEFAULT_REWARD_TIME_ZONE =
  'Europe/Berlin';

@Injectable()
export class CommunityEventService {
  private readonly rewardDateFormatter:
    Intl.DateTimeFormat;

  constructor(
    @InjectDataSource()
    private readonly dataSource:
      DataSource,
    config: ConfigService,
  ) {
    const timeZone =
      config.get<string>(
        'COMMUNITY_TIME_ZONE',
      ) ??
      DEFAULT_REWARD_TIME_ZONE;

    try {
      this.rewardDateFormatter =
        new Intl.DateTimeFormat(
          'en-CA',
          {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          },
        );
    } catch {
      throw new Error(
        `COMMUNITY_TIME_ZONE "${timeZone}" is not a valid IANA time zone.`,
      );
    }
  }

  async recordEvent(
    input: RecordCommunityEventInput,
  ): Promise<RecordCommunityEventResult> {
    this.validateInput(input);

    return this.dataSource.transaction(
      async (manager) => {
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
  }

  async getTotalXp(
    userUuid: string,
  ): Promise<number> {
    const result =
      await this.dataSource
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
      this.getRewardDate(
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

  private getRewardDate(
    date: Date,
  ): string {
    const parts =
      this.rewardDateFormatter
        .formatToParts(date);
    const part = (
      type: Intl.DateTimeFormatPartTypes,
    ): string =>
      parts.find(
        (candidate) =>
          candidate.type === type,
      )?.value ?? '';

    return [
      part('year'),
      part('month'),
      part('day'),
    ].join('-');
  }
}
