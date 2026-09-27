import type {
  CommunityDiscordRoleDefinition,
} from '@shared/community/community-discord';
import type {
  Guild,
  Role,
} from 'discord.js';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { CommunityDiscordRoleDefinitionService } from '../community-discord-role-definition.service';
import { DiscordRoleProvisioningService } from './discord-role-provisioning.service';

function definition(
  overrides:
    Partial<CommunityDiscordRoleDefinition> = {},
): CommunityDiscordRoleDefinition {
  return {
    id: 'role-definition-1',
    key: 'showcase.stammgast',
    kind: 'showcase',
    name: 'Stammgast',
    color: '#fcaac1',
    enabled: true,
    discordRoleId: null,
    provisionedByCommunity: false,
    achievementId: 'achievement-1',
    minimumLevel: null,
    maximumLevel: null,
    sortOrder: 100,
    updatedByUserId: null,
    createdAt:
      '2026-09-27T12:00:00.000Z',
    updatedAt:
      '2026-09-27T12:00:00.000Z',
    ...overrides,
  };
}

function guildWithRoles(
  roles: Map<string, Role>,
  create: ReturnType<typeof vi.fn>,
): Guild {
  return {
    roles: {
      fetch: vi.fn(async () => roles),
      create,
    },
  } as unknown as Guild;
}

describe(
  'DiscordRoleProvisioningService',
  () => {
    let definitions:
      CommunityDiscordRoleDefinitionService;
    let service:
      DiscordRoleProvisioningService;

    beforeEach(() => {
      definitions = {
        getDefinitions: vi.fn(),
        setProvisionedDiscordRoleId:
          vi.fn(),
      } as unknown as
        CommunityDiscordRoleDefinitionService;
      service =
        new DiscordRoleProvisioningService(
          definitions,
        );
    });

    it(
      'creates an enabled role with the configured hex color and marks it as provisioned',
      async () => {
        vi.mocked(
          definitions.getDefinitions,
        ).mockResolvedValue([
          definition(),
        ]);
        const createdRole = {
          id: '123456789012345678',
          delete: vi.fn(),
        } as unknown as Role;
        const create = vi.fn(
          async () => createdRole,
        );
        const guild = guildWithRoles(
          new Map(),
          create,
        );

        const result =
          await service.reconcile(guild);

        expect(create)
          .toHaveBeenCalledWith({
            name: 'Stammgast',
            colors: {
              primaryColor: '#fcaac1',
            },
            reason:
              'Community role provisioning',
          });
        expect(
          definitions
            .setProvisionedDiscordRoleId,
        ).toHaveBeenCalledWith(
          'role-definition-1',
          '123456789012345678',
        );
        expect(result).toMatchObject({
          created: 1,
          failed: 0,
        });
      },
    );

    it(
      'does not adopt or edit a legacy Discord role id',
      async () => {
        const legacyRole = {
          id: '111111111111111111',
          name: 'Existing role',
          edit: vi.fn(),
        } as unknown as Role;
        vi.mocked(
          definitions.getDefinitions,
        ).mockResolvedValue([
          definition({
            discordRoleId:
              legacyRole.id,
            provisionedByCommunity: false,
          }),
        ]);
        const createdRole = {
          id: '222222222222222222',
          delete: vi.fn(),
        } as unknown as Role;
        const create = vi.fn(
          async () => createdRole,
        );
        const guild = guildWithRoles(
          new Map([
            [legacyRole.id, legacyRole],
          ]),
          create,
        );

        await service.reconcile(guild);

        expect(legacyRole.edit)
          .not.toHaveBeenCalled();
        expect(create)
          .toHaveBeenCalledTimes(1);
        expect(
          definitions
            .setProvisionedDiscordRoleId,
        ).toHaveBeenCalledWith(
          'role-definition-1',
          createdRole.id,
        );
      },
    );

    it(
      'updates only an owned role when its name or color changed',
      async () => {
        const edit = vi.fn(
          async () => undefined,
        );
        const ownedRole = {
          id: '123456789012345678',
          name: 'Old name',
          colors: {
            primaryColor: 0,
          },
          hexColor: '#000000',
          managed: false,
          editable: true,
          edit,
        } as unknown as Role;
        vi.mocked(
          definitions.getDefinitions,
        ).mockResolvedValue([
          definition({
            discordRoleId: ownedRole.id,
            provisionedByCommunity: true,
          }),
        ]);
        const create = vi.fn();
        const guild = guildWithRoles(
          new Map([
            [ownedRole.id, ownedRole],
          ]),
          create,
        );

        const result =
          await service.reconcile(guild);

        expect(create)
          .not.toHaveBeenCalled();
        expect(edit)
          .toHaveBeenCalledWith({
            name: 'Stammgast',
            colors: {
              primaryColor: '#fcaac1',
            },
            reason:
              'Community role provisioning',
          });
        expect(result.updated).toBe(1);
      },
    );

    it(
      'recreates a provisioned role that was deleted on Discord',
      async () => {
        vi.mocked(
          definitions.getDefinitions,
        ).mockResolvedValue([
          definition({
            discordRoleId:
              '123456789012345678',
            provisionedByCommunity: true,
          }),
        ]);
        const createdRole = {
          id: '222222222222222222',
          delete: vi.fn(),
        } as unknown as Role;
        const create = vi.fn(
          async () => createdRole,
        );
        const guild = guildWithRoles(
          new Map(),
          create,
        );

        const result =
          await service.reconcile(guild);

        expect(result.created).toBe(1);
        expect(
          definitions
            .setProvisionedDiscordRoleId,
        ).toHaveBeenCalledWith(
          'role-definition-1',
          createdRole.id,
        );
      },
    );

    it(
      'leaves disabled definitions and unrelated Discord roles untouched',
      async () => {
        const unrelated = {
          id: '999999999999999999',
          edit: vi.fn(),
        } as unknown as Role;
        vi.mocked(
          definitions.getDefinitions,
        ).mockResolvedValue([
          definition({
            enabled: false,
          }),
        ]);
        const create = vi.fn();
        const guild = guildWithRoles(
          new Map([
            [unrelated.id, unrelated],
          ]),
          create,
        );

        const result =
          await service.reconcile(guild);

        expect(create)
          .not.toHaveBeenCalled();
        expect(unrelated.edit)
          .not.toHaveBeenCalled();
        expect(result.skippedDisabled)
          .toBe(1);
      },
    );
  },
);
