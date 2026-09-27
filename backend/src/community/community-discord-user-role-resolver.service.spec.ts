import type {
  ObjectLiteral,
  Repository,
} from 'typeorm';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { CommunityDiscordRoleDefinitionService } from './community-discord-role-definition.service';
import { CommunityDiscordUserRoleResolverService } from './community-discord-user-role-resolver.service';
import { CommunityProgressionDefinitionService } from './community-progression-definition.service';
import { CommunityProgressionService } from './community-progression.service';
import { CommunityService } from './community.service';
import { UserAchievementEntry } from './entities/user-achievement.entry';

function repository<T extends ObjectLiteral>(): Repository<T> {
  return {
    findBy: vi.fn(),
  } as unknown as Repository<T>;
}

describe(
  'CommunityDiscordUserRoleResolverService',
  () => {
    it(
      'resolves exactly one level role plus the selected unlocked showcase role',
      async () => {
        const discordRoles = {
          getDefinitions: vi.fn(
            async () => [
              {
                id: 'level-1',
                kind: 'level-range',
                enabled: true,
                provisionedByCommunity: true,
                discordRoleId: 'discord-level-1',
                minimumLevel: 1,
                maximumLevel: 4,
                achievementId: null,
              },
              {
                id: 'level-2',
                kind: 'level-range',
                enabled: true,
                provisionedByCommunity: true,
                discordRoleId: 'discord-level-2',
                minimumLevel: 5,
                maximumLevel: 9,
                achievementId: null,
              },
              {
                id: 'showcase-1',
                kind: 'showcase',
                enabled: true,
                provisionedByCommunity: true,
                discordRoleId: 'discord-showcase-1',
                minimumLevel: null,
                maximumLevel: null,
                achievementId: 'achievement-1',
              },
              {
                id: 'special-1',
                kind: 'special',
                enabled: true,
                provisionedByCommunity: true,
                discordRoleId: 'discord-special-1',
                minimumLevel: null,
                maximumLevel: null,
                achievementId: null,
              },
            ],
          ),
        } as unknown as
          CommunityDiscordRoleDefinitionService;
        const progression = {
          getTotalXp: vi.fn(
            async () => 500,
          ),
        } as unknown as
          CommunityProgressionService;
        const progressionDefinitions = {
          getLevels: vi.fn(
            async () => [
              {
                level: 1,
                requiredXp: 0,
              },
              {
                level: 6,
                requiredXp: 400,
              },
              {
                level: 7,
                requiredXp: 600,
              },
            ],
          ),
        } as unknown as
          CommunityProgressionDefinitionService;
        const community = {
          getProfile: vi.fn(
            async () => ({
              selectedDiscordShowcaseRoleUuid:
                'showcase-1',
            }),
          ),
        } as unknown as CommunityService;
        const userAchievements =
          repository<UserAchievementEntry>();

        vi.mocked(
          userAchievements.findBy,
        ).mockResolvedValue([
          {
            achievementUuid:
              'achievement-1',
          } as UserAchievementEntry,
        ]);

        const service =
          new CommunityDiscordUserRoleResolverService(
            discordRoles,
            progression,
            progressionDefinitions,
            community,
            userAchievements,
          );

        const result =
          await service.resolve('user-1');

        expect(
          [...result.desiredRoleIds],
        ).toEqual([
          'discord-level-2',
          'discord-showcase-1',
        ]);
        expect(
          [...result.managedRoleIds],
        ).toEqual([
          'discord-level-1',
          'discord-level-2',
          'discord-showcase-1',
        ]);
      },
    );

    it(
      'does not assign a selected showcase role before its achievement is unlocked',
      async () => {
        const discordRoles = {
          getDefinitions: vi.fn(
            async () => [
              {
                id: 'showcase-1',
                kind: 'showcase',
                enabled: true,
                provisionedByCommunity: true,
                discordRoleId: 'discord-showcase-1',
                minimumLevel: null,
                maximumLevel: null,
                achievementId: 'achievement-1',
              },
            ],
          ),
        } as unknown as
          CommunityDiscordRoleDefinitionService;
        const progression = {
          getTotalXp: vi.fn(
            async () => 0,
          ),
        } as unknown as
          CommunityProgressionService;
        const progressionDefinitions = {
          getLevels: vi.fn(
            async () => [
              {
                level: 1,
                requiredXp: 0,
              },
            ],
          ),
        } as unknown as
          CommunityProgressionDefinitionService;
        const community = {
          getProfile: vi.fn(
            async () => ({
              selectedDiscordShowcaseRoleUuid:
                'showcase-1',
            }),
          ),
        } as unknown as CommunityService;
        const userAchievements =
          repository<UserAchievementEntry>();

        vi.mocked(
          userAchievements.findBy,
        ).mockResolvedValue([]);

        const service =
          new CommunityDiscordUserRoleResolverService(
            discordRoles,
            progression,
            progressionDefinitions,
            community,
            userAchievements,
          );

        const result =
          await service.resolve('user-1');

        expect(
          [...result.desiredRoleIds],
        ).toEqual([]);
      },
    );
  },
);
