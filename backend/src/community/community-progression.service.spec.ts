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

import { CommunityProgressionService } from './community-progression.service';
import { CommunityAchievementConditionEntry } from './entities/community-achievement-condition.entry';
import { CommunityAchievementEntry } from './entities/community-achievement.entry';
import { CommunityEventEntry } from './entities/community-event.entry';
import { CommunityLevelEntry } from './entities/community-level.entry';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { UserAchievementEntry } from './entities/user-achievement.entry';
import { XpTransactionEntry } from './entities/xp-transaction.entry';

describe(
  'CommunityProgressionService',
  () => {
    it(
      'unlocks a level achievement once and can chain its XP reward into another achievement',
      async () => {
        const userUuid =
          '00000000-0000-4000-8000-000000000001';
        const unlocked:
          Array<Partial<UserAchievementEntry>> =
          [];
        let totalXp = 100;
        let eventSequence = 0;

        const levelAchievement =
          {
            uuid:
              '00000000-0000-4000-8000-000000000101',
            key: 'level-2',
            enabled: true,
            conditionMode: 'all',
            xpReward: 25,
            unlockedTitleUuid: null,
            unlockedProfileColor: null,
            sortOrder: 0,
          } as CommunityAchievementEntry;
        const xpAchievement =
          {
            uuid:
              '00000000-0000-4000-8000-000000000102',
            key: 'xp-125',
            enabled: true,
            conditionMode: 'all',
            xpReward: 0,
            unlockedTitleUuid: null,
            unlockedProfileColor: null,
            sortOrder: 1,
          } as CommunityAchievementEntry;
        const conditions =
          [
            {
              achievementUuid:
                levelAchievement.uuid,
              metric:
                'level-reached',
              operator: 'gte',
              threshold: 2,
              eventType: null,
              sortOrder: 0,
            },
            {
              achievementUuid:
                xpAchievement.uuid,
              metric: 'total-xp',
              operator: 'gte',
              threshold: 125,
              eventType: null,
              sortOrder: 0,
            },
          ] as CommunityAchievementConditionEntry[];

        const profileRepository = {
          findOne: vi.fn(
            async () =>
              ({
                userUuid,
              }) as CommunityProfileEntry,
          ),
        };
        const achievementRepository = {
          find: vi.fn(
            async () => [
              levelAchievement,
              xpAchievement,
            ],
          ),
        };
        const conditionRepository = {
          find: vi.fn(
            async () => conditions,
          ),
        };
        const userAchievementRepository = {
          findBy: vi.fn(
            async () => unlocked,
          ),
          save: vi.fn(
            async (
              entry:
                Partial<UserAchievementEntry>,
            ) => {
              unlocked.push(entry);
              return entry;
            },
          ),
        };
        const levelRepository = {
          findOne: vi.fn(
            async () =>
              ({
                level:
                  totalXp >= 100
                    ? 2
                    : 1,
                requiredXp:
                  totalXp >= 100
                    ? 100
                    : 0,
              }) as CommunityLevelEntry,
          ),
        };
        const eventRepository = {
          create: vi.fn(
            (entry: object) => entry,
          ),
          save: vi.fn(
            async (entry: object) => ({
              ...entry,
              uuid:
                `event-${eventSequence += 1}`,
            }),
          ),
        };
        const xpRepository = {
          createQueryBuilder: vi.fn(
            () => {
              const query = {
                select: vi.fn(),
                where: vi.fn(),
                getRawOne: vi.fn(
                  async () => ({
                    total:
                      String(totalXp),
                  }),
                ),
              };

              query.select.mockReturnValue(
                query,
              );
              query.where.mockReturnValue(
                query,
              );

              return query;
            },
          ),
          save: vi.fn(
            async (
              entry: {
                amount: number;
              },
            ) => {
              totalXp += entry.amount;
              return entry;
            },
          ),
        };

        const manager = {
          getRepository: vi.fn(
            (entity: unknown) => {
              switch (entity) {
                case CommunityProfileEntry:
                  return profileRepository;
                case CommunityAchievementEntry:
                  return achievementRepository;
                case CommunityAchievementConditionEntry:
                  return conditionRepository;
                case UserAchievementEntry:
                  return userAchievementRepository;
                case CommunityLevelEntry:
                  return levelRepository;
                case CommunityEventEntry:
                  return eventRepository;
                case XpTransactionEntry:
                  return xpRepository;
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
        const config = {
          get: vi.fn(
            () => undefined,
          ),
        } as unknown as ConfigService;
        const service =
          new CommunityProgressionService(
            dataSource,
            config,
          );

        await expect(
          service
            .evaluateUserInTransaction(
              manager,
              userUuid,
              null,
            ),
        ).resolves.toEqual([
          levelAchievement.uuid,
          xpAchievement.uuid,
        ]);
        expect(totalXp).toBe(125);
        expect(
          userAchievementRepository.save,
        ).toHaveBeenCalledTimes(2);

        await expect(
          service
            .evaluateUserInTransaction(
              manager,
              userUuid,
              null,
            ),
        ).resolves.toEqual([]);
        expect(
          userAchievementRepository.save,
        ).toHaveBeenCalledTimes(2);
      },
    );
  },
);
