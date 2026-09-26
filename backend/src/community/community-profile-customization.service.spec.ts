import { BadRequestException } from '@nestjs/common';
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

import {
  CommunityProfileCustomizationService,
  MAX_PINNED_ACHIEVEMENTS,
} from './community-profile-customization.service';
import { CommunityProgressionService } from './community-progression.service';
import { CommunityAchievementEntry } from './entities/community-achievement.entry';
import { CommunityPinnedAchievementEntry } from './entities/community-pinned-achievement.entry';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { UserAchievementEntry } from './entities/user-achievement.entry';

describe(
  'CommunityProfileCustomizationService',
  () => {
    it(
      'rejects a profile color that was not unlocked',
      async () => {
        const profile = {
          userUuid:
            '00000000-0000-4000-8000-000000000001',
          selectedProfileColorAchievementUuid:
            null,
        } as CommunityProfileEntry;
        const profileRepository = {
          findOne: vi.fn(
            async () => profile,
          ),
          save: vi.fn(),
        };
        const userAchievementRepository = {
          findOneBy: vi.fn(
            async () => null,
          ),
        };
        const achievementRepository = {
          findOneBy: vi.fn(
            async () =>
              ({
                uuid:
                  '00000000-0000-4000-8000-000000000101',
                unlockedProfileColor:
                  '#fcaac1',
              }) as CommunityAchievementEntry,
          ),
        };
        const manager = {
          getRepository: vi.fn(
            (entity: unknown) => {
              switch (entity) {
                case CommunityProfileEntry:
                  return profileRepository;
                case UserAchievementEntry:
                  return userAchievementRepository;
                case CommunityAchievementEntry:
                  return achievementRepository;
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
        const progression =
          {} as CommunityProgressionService;
        const service =
          new CommunityProfileCustomizationService(
            dataSource,
            progression,
          );

        await expect(
          service.selectProfileColor(
            profile.userUuid,
            '00000000-0000-4000-8000-000000000101',
          ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(
          profileRepository.save,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'stores pinned achievements in the requested order',
      async () => {
        const userUuid =
          '00000000-0000-4000-8000-000000000001';
        const achievementUuids = [
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000102',
          '00000000-0000-4000-8000-000000000103',
        ];
        const profileRepository = {
          findOne: vi.fn(
            async () =>
              ({
                userUuid,
              }) as CommunityProfileEntry,
          ),
        };
        const userAchievementRepository = {
          findBy: vi.fn(
            async () =>
              achievementUuids.map(
                (achievementUuid) => ({
                  userUuid,
                  achievementUuid,
                }),
              ),
          ),
        };
        const pinnedRepository = {
          delete: vi.fn(
            async () => ({
              affected: 0,
              raw: [],
            }),
          ),
          create: vi.fn(
            (entry: object) => entry,
          ),
          save: vi.fn(
            async (entries: object[]) =>
              entries,
          ),
        };
        const manager = {
          getRepository: vi.fn(
            (entity: unknown) => {
              switch (entity) {
                case CommunityProfileEntry:
                  return profileRepository;
                case UserAchievementEntry:
                  return userAchievementRepository;
                case CommunityPinnedAchievementEntry:
                  return pinnedRepository;
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
        const service =
          new CommunityProfileCustomizationService(
            dataSource,
            {} as CommunityProgressionService,
          );

        await service
          .setPinnedAchievements(
            userUuid,
            achievementUuids,
          );

        expect(
          pinnedRepository.save,
        ).toHaveBeenCalledWith([
          {
            userUuid,
            achievementUuid:
              achievementUuids[0],
            position: 0,
          },
          {
            userUuid,
            achievementUuid:
              achievementUuids[1],
            position: 1,
          },
          {
            userUuid,
            achievementUuid:
              achievementUuids[2],
            position: 2,
          },
        ]);
      },
    );

    it(
      'rejects more than the supported number of pinned achievements',
      async () => {
        const transaction =
          vi.fn();
        const service =
          new CommunityProfileCustomizationService(
            {
              transaction,
            } as unknown as DataSource,
            {} as CommunityProgressionService,
          );

        await expect(
          service
            .setPinnedAchievements(
              '00000000-0000-4000-8000-000000000001',
              Array.from(
                {
                  length:
                    MAX_PINNED_ACHIEVEMENTS +
                    1,
                },
                (_, index) =>
                  `achievement-${index}`,
              ),
            ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(
          transaction,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
