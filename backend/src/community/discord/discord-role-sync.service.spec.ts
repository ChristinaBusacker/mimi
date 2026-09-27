import type {
  GuildMember,
  Role,
} from 'discord.js';
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

import { UsersService } from '../../users/users.service';
import { CommunityAchievementEntry } from '../entities/community-achievement.entry';
import { CommunityDiscordAssignedRoleEntry } from '../entities/community-discord-assigned-role.entry';
import { UserAchievementEntry } from '../entities/user-achievement.entry';
import { DiscordRoleSyncService } from './discord-role-sync.service';

function repository<T extends ObjectLiteral>(): Repository<T> {
  return {
    find: vi.fn(),
    findBy: vi.fn(),
    create: vi.fn(
      (value: object) => value,
    ),
    save: vi.fn(
      async (value: object) => value,
    ),
    delete: vi.fn(
      async () => ({
        raw: [],
        affected: 1,
      }),
    ),
  } as unknown as Repository<T>;
}

describe(
  'DiscordRoleSyncService',
  () => {
    it(
      'adds earned roles and only removes roles previously managed by the community bot',
      async () => {
        const achievements =
          repository<CommunityAchievementEntry>();
        const userAchievements =
          repository<UserAchievementEntry>();
        const assignedRoles =
          repository<CommunityDiscordAssignedRoleEntry>();
        const users = {
          findByDiscordId: vi.fn(
            async () => ({
              uuid: 'user-1',
            }),
          ),
        } as unknown as UsersService;

        vi.mocked(
          userAchievements.findBy,
        ).mockResolvedValue([
          {
            achievementUuid:
              'achievement-1',
          } as UserAchievementEntry,
        ]);
        vi.mocked(
          achievements.find,
        ).mockResolvedValue([
          {
            uuid: 'achievement-1',
            discordRoleId:
              'role-earned',
          } as CommunityAchievementEntry,
        ]);
        vi.mocked(
          assignedRoles.findBy,
        ).mockResolvedValue([
          {
            userUuid: 'user-1',
            roleId: 'role-old',
          } as CommunityDiscordAssignedRoleEntry,
        ]);

        const earnedRole = {
          id: 'role-earned',
          editable: true,
        } as Role;
        const oldRole = {
          id: 'role-old',
          editable: true,
        } as Role;
        const manualRole = {
          id: 'role-manual',
          editable: true,
        } as Role;
        const cache = new Map([
          [oldRole.id, oldRole],
          [manualRole.id, manualRole],
        ]);
        const add = vi.fn();
        const remove = vi.fn();
        const member = {
          id: 'discord-user-1',
          roles: {
            cache,
            add,
            remove,
          },
          guild: {
            roles: {
              cache: new Map([
                [earnedRole.id, earnedRole],
                [oldRole.id, oldRole],
                [manualRole.id, manualRole],
              ]),
              fetch: vi.fn(),
            },
          },
        } as unknown as GuildMember;
        const service =
          new DiscordRoleSyncService(
            users,
            achievements,
            userAchievements,
            assignedRoles,
          );

        const result =
          await service.syncMember(member);

        expect(result).toEqual({
          handled: true,
          added: 1,
          removed: 1,
        });
        expect(remove).toHaveBeenCalledWith(
          oldRole,
          'Community achievement reward changed',
        );
        expect(remove).not.toHaveBeenCalledWith(
          manualRole,
          expect.anything(),
        );
        expect(add).toHaveBeenCalledWith(
          earnedRole,
          'Community achievement reward',
        );
      },
    );

    it(
      'does not claim a role that was already assigned outside the community bot',
      async () => {
        const achievements =
          repository<CommunityAchievementEntry>();
        const userAchievements =
          repository<UserAchievementEntry>();
        const assignedRoles =
          repository<CommunityDiscordAssignedRoleEntry>();
        const users = {
          findByDiscordId: vi.fn(
            async () => ({
              uuid: 'user-1',
            }),
          ),
        } as unknown as UsersService;

        vi.mocked(
          userAchievements.findBy,
        ).mockResolvedValue([
          {
            achievementUuid:
              'achievement-1',
          } as UserAchievementEntry,
        ]);
        vi.mocked(
          achievements.find,
        ).mockResolvedValue([
          {
            uuid: 'achievement-1',
            discordRoleId:
              'role-existing',
          } as CommunityAchievementEntry,
        ]);
        vi.mocked(
          assignedRoles.findBy,
        ).mockResolvedValue([]);

        const existingRole = {
          id: 'role-existing',
          editable: true,
        } as Role;
        const member = {
          id: 'discord-user-1',
          roles: {
            cache: new Map([
              [existingRole.id, existingRole],
            ]),
            add: vi.fn(),
            remove: vi.fn(),
          },
          guild: {
            roles: {
              cache: new Map([
                [existingRole.id, existingRole],
              ]),
              fetch: vi.fn(),
            },
          },
        } as unknown as GuildMember;
        const service =
          new DiscordRoleSyncService(
            users,
            achievements,
            userAchievements,
            assignedRoles,
          );

        await service.syncMember(member);

        expect(
          assignedRoles.save,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
