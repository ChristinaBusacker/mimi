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
import { CommunityDiscordUserRoleResolverService } from '../community-discord-user-role-resolver.service';
import { CommunityDiscordAssignedRoleEntry } from '../entities/community-discord-assigned-role.entry';
import { DiscordRoleSyncService } from './discord-role-sync.service';

function repository<T extends ObjectLiteral>(): Repository<T> {
  return {
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
      'keeps unrelated Discord roles and synchronizes only owned community roles',
      async () => {
        const assignedRoles =
          repository<CommunityDiscordAssignedRoleEntry>();
        const users = {
          findByDiscordId: vi.fn(
            async () => ({
              uuid: 'user-1',
            }),
          ),
        } as unknown as UsersService;
        const resolver = {
          resolve: vi.fn(
            async () => ({
              desiredRoleIds: new Set([
                'role-level-new',
                'role-showcase',
              ]),
              managedRoleIds: new Set([
                'role-level-old',
                'role-level-new',
                'role-showcase',
              ]),
            }),
          ),
        } as unknown as
          CommunityDiscordUserRoleResolverService;

        vi.mocked(
          assignedRoles.findBy,
        ).mockResolvedValue([
          {
            userUuid: 'user-1',
            roleId: 'role-level-old',
          } as CommunityDiscordAssignedRoleEntry,
          {
            userUuid: 'user-1',
            roleId: 'legacy-role',
          } as CommunityDiscordAssignedRoleEntry,
        ]);

        const oldLevelRole = {
          id: 'role-level-old',
          editable: true,
        } as Role;
        const newLevelRole = {
          id: 'role-level-new',
          editable: true,
        } as Role;
        const showcaseRole = {
          id: 'role-showcase',
          editable: true,
        } as Role;
        const manualRole = {
          id: 'manual-role',
          editable: true,
        } as Role;
        const add = vi.fn();
        const remove = vi.fn();
        const member = {
          id: 'discord-user-1',
          roles: {
            cache: new Map([
              [oldLevelRole.id, oldLevelRole],
              [manualRole.id, manualRole],
            ]),
            add,
            remove,
          },
          guild: {
            roles: {
              cache: new Map([
                [oldLevelRole.id, oldLevelRole],
                [newLevelRole.id, newLevelRole],
                [showcaseRole.id, showcaseRole],
                [manualRole.id, manualRole],
              ]),
              fetch: vi.fn(),
            },
          },
        } as unknown as GuildMember;
        const service =
          new DiscordRoleSyncService(
            users,
            resolver,
            assignedRoles,
          );

        const result =
          await service.syncMember(member);

        expect(result).toEqual({
          handled: true,
          added: 2,
          removed: 1,
        });
        expect(remove).toHaveBeenCalledWith(
          oldLevelRole,
          'Community role selection changed',
        );
        expect(remove).not.toHaveBeenCalledWith(
          manualRole,
          expect.anything(),
        );
        expect(add).toHaveBeenCalledWith(
          newLevelRole,
          'Community role selection',
        );
        expect(add).toHaveBeenCalledWith(
          showcaseRole,
          'Community role selection',
        );
        expect(remove).not.toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'legacy-role',
          }),
          expect.anything(),
        );
        expect(
          assignedRoles.delete,
        ).toHaveBeenCalledWith({
          userUuid: 'user-1',
          roleId: 'legacy-role',
        });
      },
    );

    it(
      'tracks an already present owned role without touching it on Discord',
      async () => {
        const assignedRoles =
          repository<CommunityDiscordAssignedRoleEntry>();
        const users = {
          findByDiscordId: vi.fn(
            async () => ({
              uuid: 'user-1',
            }),
          ),
        } as unknown as UsersService;
        const resolver = {
          resolve: vi.fn(
            async () => ({
              desiredRoleIds: new Set([
                'role-level',
              ]),
              managedRoleIds: new Set([
                'role-level',
              ]),
            }),
          ),
        } as unknown as
          CommunityDiscordUserRoleResolverService;

        vi.mocked(
          assignedRoles.findBy,
        ).mockResolvedValue([]);

        const levelRole = {
          id: 'role-level',
          editable: true,
        } as Role;
        const add = vi.fn();
        const member = {
          id: 'discord-user-1',
          roles: {
            cache: new Map([
              [levelRole.id, levelRole],
            ]),
            add,
            remove: vi.fn(),
          },
          guild: {
            roles: {
              cache: new Map([
                [levelRole.id, levelRole],
              ]),
              fetch: vi.fn(),
            },
          },
        } as unknown as GuildMember;
        const service =
          new DiscordRoleSyncService(
            users,
            resolver,
            assignedRoles,
          );

        await service.syncMember(member);

        expect(add).not.toHaveBeenCalled();
        expect(
          assignedRoles.save,
        ).toHaveBeenCalledOnce();
      },
    );
  },
);
