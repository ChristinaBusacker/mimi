import type {
  SaveCommunityDiscordRoleDefinition,
} from '@shared/community/community-discord';

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type {
  ObjectLiteral,
  Repository,
} from 'typeorm';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { CommunityAchievementEntry } from './entities/community-achievement.entry';
import { CommunityDiscordRoleEntry } from './entities/community-discord-role.entry';
import { CommunityDiscordRoleDefinitionService } from './community-discord-role-definition.service';

function repository<T extends ObjectLiteral>(): Repository<T> {
  return {
    find: vi.fn(async () => []),
    findOneBy: vi.fn(async () => null),
    create: vi.fn(
      (value: object) => value,
    ),
    save: vi.fn(
      async (value: object) => ({
        uuid: 'role-1',
        discordRoleId: null,
        createdAt: new Date(
          '2026-09-27T12:00:00Z',
        ),
        updatedAt: new Date(
          '2026-09-27T12:00:00Z',
        ),
        ...value,
      }),
    ),
  } as unknown as Repository<T>;
}

function input(
  overrides:
    Partial<SaveCommunityDiscordRoleDefinition> = {},
): SaveCommunityDiscordRoleDefinition {
  return {
    kind: 'special',
    name: 'Streamgast',
    color: null,
    enabled: true,
    achievementId: null,
    minimumLevel: null,
    maximumLevel: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe(
  'CommunityDiscordRoleDefinitionService',
  () => {
    let roles:
      Repository<CommunityDiscordRoleEntry>;
    let achievements:
      Repository<CommunityAchievementEntry>;
    let service:
      CommunityDiscordRoleDefinitionService;

    beforeEach(() => {
      roles =
        repository<CommunityDiscordRoleEntry>();
      achievements =
        repository<CommunityAchievementEntry>();
      service =
        new CommunityDiscordRoleDefinitionService(
          roles,
          achievements,
        );
    });

    it(
      'rejects overlapping enabled level ranges',
      async () => {
        vi.mocked(roles.find)
          .mockResolvedValue([
            {
              uuid: 'role-existing',
              key: 'community.ii',
              kind: 'level-range',
              name: 'Community II',
              color: null,
              enabled: true,
              discordRoleId: null,
              achievementUuid: null,
              minimumLevel: 5,
              maximumLevel: 9,
              sortOrder: 1,
            } as CommunityDiscordRoleEntry,
          ]);

        await expect(
          service.saveDefinition(
            'community.iii',
            input({
              kind: 'level-range',
              name: 'Community III',
              minimumLevel: 9,
              maximumLevel: 19,
            }),
            null,
          ),
        ).rejects.toBeInstanceOf(
          ConflictException,
        );
      },
    );

    it(
      'requires an existing achievement for showcase roles',
      async () => {
        await expect(
          service.saveDefinition(
            'showcase.veteran',
            input({
              kind: 'showcase',
              name: 'Veteran',
              achievementId:
                'achievement-1',
            }),
            null,
          ),
        ).rejects.toBeInstanceOf(
          NotFoundException,
        );
      },
    );

    it(
      'keeps special roles independent from achievements and levels',
      async () => {
        await expect(
          service.saveDefinition(
            'special.stream-guest',
            input({
              achievementId:
                'achievement-1',
            }),
            null,
          ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it(
      'prevents two managed definitions from claiming the same Discord role',
      async () => {
        vi.mocked(roles.findOneBy)
          .mockResolvedValueOnce({
            uuid: 'role-1',
            key: 'special.stream-guest',
            kind: 'special',
            name: 'Streamgast',
            color: null,
            enabled: true,
            discordRoleId: null,
            achievementUuid: null,
            minimumLevel: null,
            maximumLevel: null,
            sortOrder: 0,
            updatedByUserId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as CommunityDiscordRoleEntry)
          .mockResolvedValueOnce({
            uuid: 'role-2',
          } as CommunityDiscordRoleEntry);

        await expect(
          service.setDiscordRoleId(
            'role-1',
            '123456789012345678',
          ),
        ).rejects.toBeInstanceOf(
          ConflictException,
        );
      },
    );
  },
);
