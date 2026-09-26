import { ConfigService } from '@nestjs/config';
import type {
  DataSource,
  EntityManager,
} from 'typeorm';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { CommunityEventService } from './community-event.service';
import { CommunityProgressionService } from './community-progression.service';
import { CommunityEventEntry } from './entities/community-event.entry';
import { CommunityEventRuleEntry } from './entities/community-event-rule.entry';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { XpTransactionEntry } from './entities/xp-transaction.entry';

interface EventTestRepositories {
  profile: {
    findOne: ReturnType<
      typeof vi.fn
    >;
  };
  events: {
    findOneBy: ReturnType<
      typeof vi.fn
    >;
    create: ReturnType<
      typeof vi.fn
    >;
    save: ReturnType<
      typeof vi.fn
    >;
  };
  rules: {
    findOneBy: ReturnType<
      typeof vi.fn
    >;
  };
  xp: {
    findOneBy: ReturnType<
      typeof vi.fn
    >;
    countBy: ReturnType<
      typeof vi.fn
    >;
    findOne: ReturnType<
      typeof vi.fn
    >;
    create: ReturnType<
      typeof vi.fn
    >;
    save: ReturnType<
      typeof vi.fn
    >;
  };
}

function createEventService(
  repositories:
    EventTestRepositories,
): {
  service: CommunityEventService;
  progression:
    CommunityProgressionService;
} {
  const manager = {
    getRepository: vi.fn(
      (entity: unknown) => {
        switch (entity) {
          case CommunityProfileEntry:
            return repositories.profile;
          case CommunityEventEntry:
            return repositories.events;
          case CommunityEventRuleEntry:
            return repositories.rules;
          case XpTransactionEntry:
            return repositories.xp;
          default:
            throw new Error(
              'Unexpected repository.',
            );
        }
      },
    ),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: vi.fn(
      async (
        callback: (
          transactionManager:
            EntityManager,
        ) => Promise<unknown>,
      ) =>
        callback(manager),
    ),
  } as unknown as DataSource;
  const progression = {
    evaluateUserInTransaction:
      vi.fn(
        async () => [],
      ),
    getTotalXp:
      vi.fn(
        async () => 0,
      ),
  } as unknown as
    CommunityProgressionService;
  const config = {
    get: vi.fn(
      () => undefined,
    ),
  } as unknown as ConfigService;

  return {
    service:
      new CommunityEventService(
        dataSource,
        progression,
        config,
      ),
    progression,
  };
}

function createRepositories():
  EventTestRepositories {
  return {
    profile: {
      findOne: vi.fn(
        async () => ({
          userUuid:
            '00000000-0000-4000-8000-000000000001',
        }),
      ),
    },
    events: {
      findOneBy: vi.fn(
        async () => null,
      ),
      create: vi.fn(
        (entry: object) => entry,
      ),
      save: vi.fn(
        async (entry: object) => ({
          ...entry,
          uuid:
            '00000000-0000-4000-8000-000000000201',
        }),
      ),
    },
    rules: {
      findOneBy: vi.fn(
        async () => null,
      ),
    },
    xp: {
      findOneBy: vi.fn(
        async () => null,
      ),
      countBy: vi.fn(
        async () => 0,
      ),
      findOne: vi.fn(
        async () => null,
      ),
      create: vi.fn(
        (entry: object) => entry,
      ),
      save: vi.fn(
        async (entry: object) => ({
          ...entry,
          uuid:
            '00000000-0000-4000-8000-000000000301',
        }),
      ),
    },
  };
}

describe(
  'CommunityEventService',
  () => {
    it(
      'rejects content below the configured minimum without storing an event',
      async () => {
        const repositories =
          createRepositories();

        repositories.rules
          .findOneBy
          .mockResolvedValue({
            eventType:
              'discord.message.activity',
            enabled: true,
            xpAmount: 2,
            dailyRewardLimit: 10,
            contextRewardLimit: null,
            cooldownSeconds: 60,
            minimumContentLength: 20,
          });

        const {
          service,
          progression,
        } =
          createEventService(
            repositories,
          );
        const result =
          await service.recordEvent({
            userUuid:
              '00000000-0000-4000-8000-000000000001',
            type:
              'discord.message.activity',
            source: 'discord',
            sourceEventId:
              'message-1',
            contentLength: 12,
          });

        expect(
          result.status,
        ).toBe('rejected');
        expect(
          repositories.events.save,
        ).not.toHaveBeenCalled();
        expect(
          progression
            .evaluateUserInTransaction,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'stores qualified activity but does not grant XP after the daily limit',
      async () => {
        const repositories =
          createRepositories();

        repositories.rules
          .findOneBy
          .mockResolvedValue({
            eventType:
              'discord.message.activity',
            enabled: true,
            xpAmount: 2,
            dailyRewardLimit: 1,
            contextRewardLimit: null,
            cooldownSeconds: null,
            minimumContentLength: null,
          });
        repositories.xp
          .countBy
          .mockResolvedValue(1);

        const {
          service,
          progression,
        } =
          createEventService(
            repositories,
          );
        const result =
          await service.recordEvent({
            userUuid:
              '00000000-0000-4000-8000-000000000001',
            type:
              'discord.message.activity',
            source: 'discord',
            sourceEventId:
              'message-2',
            contentLength: 42,
          });

        expect(
          result.status,
        ).toBe('recorded');
        expect(
          result.rewardStatus,
        ).toBe('daily-limit');
        expect(
          repositories.events.save,
        ).toHaveBeenCalledOnce();
        expect(
          repositories.xp.save,
        ).not.toHaveBeenCalled();
        expect(
          progression
            .evaluateUserInTransaction,
        ).toHaveBeenCalledOnce();
      },
    );

    it(
      'keeps the event but blocks XP during the configured cooldown',
      async () => {
        const repositories =
          createRepositories();

        repositories.rules
          .findOneBy
          .mockResolvedValue({
            eventType:
              'discord.message.activity',
            enabled: true,
            xpAmount: 2,
            dailyRewardLimit: null,
            contextRewardLimit: null,
            cooldownSeconds: 60,
            minimumContentLength: null,
          });
        repositories.xp
          .findOne
          .mockResolvedValue({
            occurredAt:
              new Date(),
          });

        const {
          service,
          progression,
        } =
          createEventService(
            repositories,
          );
        const result =
          await service.recordEvent({
            userUuid:
              '00000000-0000-4000-8000-000000000001',
            type:
              'discord.message.activity',
            source: 'discord',
            sourceEventId:
              'message-cooldown',
            occurredAt:
              new Date(),
            contentLength: 42,
          });

        expect(
          result.status,
        ).toBe('recorded');
        expect(
          result.rewardStatus,
        ).toBe('cooldown');
        expect(
          repositories.xp.save,
        ).not.toHaveBeenCalled();
        expect(
          progression
            .evaluateUserInTransaction,
        ).toHaveBeenCalledOnce();
      },
    );

    it(
      'returns a duplicate without evaluating progression twice',
      async () => {
        const repositories =
          createRepositories();
        const duplicate = {
          uuid:
            '00000000-0000-4000-8000-000000000202',
          userUuid:
            '00000000-0000-4000-8000-000000000001',
          type:
            'discord.message.activity',
          source: 'discord',
          sourceEventId:
            'message-3',
        };

        repositories.events
          .findOneBy
          .mockResolvedValue(
            duplicate,
          );
        repositories.xp
          .findOneBy
          .mockResolvedValue({
            eventUuid:
              duplicate.uuid,
            amount: 2,
          });

        const {
          service,
          progression,
        } =
          createEventService(
            repositories,
          );
        const result =
          await service.recordEvent({
            userUuid:
              duplicate.userUuid,
            type:
              'discord.message.activity',
            source: 'discord',
            sourceEventId:
              'message-3',
            contentLength: 42,
          });

        expect(
          result.status,
        ).toBe('duplicate');
        expect(
          result.rewardStatus,
        ).toBe('granted');
        expect(
          repositories.rules
            .findOneBy,
        ).not.toHaveBeenCalled();
        expect(
          progression
            .evaluateUserInTransaction,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
