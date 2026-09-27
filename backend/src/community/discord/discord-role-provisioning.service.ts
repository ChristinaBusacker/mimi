import type {
  CommunityDiscordRoleDefinition,
  CommunityDiscordRoleKind,
} from '@shared/community/community-discord';

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Guild, Role } from 'discord.js';

import { CommunityDiscordRoleDefinitionService } from '../community-discord-role-definition.service';

const PROVISION_REASON = 'Community role provisioning';
const DELETE_REASON = 'Community role deleted';
const DISCORD_UNKNOWN_ROLE_ERROR_CODE = 10011;

export interface DiscordRoleProvisioningResult {
  total: number;
  enabled: number;
  created: number;
  updated: number;
  unchanged: number;
  skippedDisabled: number;
  failed: number;
}

type ProvisionOutcome = 'created' | 'updated' | 'unchanged';

@Injectable()
export class DiscordRoleProvisioningService {
  private readonly logger = new Logger(DiscordRoleProvisioningService.name);

  constructor(private readonly definitions: CommunityDiscordRoleDefinitionService) {}

  async reconcile(guild: Guild): Promise<DiscordRoleProvisioningResult> {
    const definitions = await this.definitions.getDefinitions();
    const guildRoles = await guild.roles.fetch();
    const result: DiscordRoleProvisioningResult = {
      total: definitions.length,
      enabled: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      skippedDisabled: 0,
      failed: 0,
    };

    for (const definition of definitions) {
      if (!definition.enabled) {
        result.skippedDisabled += 1;
        continue;
      }

      result.enabled += 1;

      try {
        const ownedRole =
          definition.provisionedByCommunity && definition.discordRoleId
            ? (guildRoles.get(definition.discordRoleId) ?? null)
            : null;
        const outcome = ownedRole
          ? await this.updateOwnedRole(ownedRole, definition)
          : await this.createOwnedRole(guild, definition);

        result[outcome] += 1;
      } catch (error: unknown) {
        result.failed += 1;
        this.logger.warn(
          `Could not provision community Discord role "${definition.key}": ${this.errorMessage(error)}`,
        );
      }
    }

    try {
      await this.synchronizeRolePositions(guild);
    } catch (error: unknown) {
      result.failed += 1;
      this.logger.warn(
        `Could not synchronize community Discord role hierarchy: ${this.errorMessage(error)}`,
      );
    }

    return result;
  }

  async deleteDefinition(
    guild: Guild | null,
    roleUuid: string,
  ): Promise<void> {
    const definition =
      await this.definitions.getDefinition(
        roleUuid,
      );

    if (
      definition.provisionedByCommunity &&
      definition.discordRoleId
    ) {
      if (!guild) {
        throw new ServiceUnavailableException(
          'Discord must be connected before a provisioned community role can be deleted.',
        );
      }

      const role =
        await this.resolveOwnedRole(
          guild,
          definition.discordRoleId,
        );

      if (role) {
        this.assertEditable(
          role,
          definition,
        );
        await role.delete(DELETE_REASON);
      }
    }

    await this.definitions.deleteDefinition(
      roleUuid,
    );

    if (guild) {
      await this.synchronizeRolePositions(
        guild,
      );
    }
  }

  private async createOwnedRole(
    guild: Guild,
    definition: CommunityDiscordRoleDefinition,
  ): Promise<ProvisionOutcome> {
    const created = await guild.roles.create({
      name: definition.name,
      ...(definition.color
        ? {
            colors: {
              primaryColor: this.toDiscordColor(definition.color),
            },
          }
        : {}),
      reason: PROVISION_REASON,
    });

    try {
      await this.definitions.setProvisionedDiscordRoleId(definition.id, created.id);
    } catch (error: unknown) {
      await created
        .delete('Rolling back failed community role provisioning')
        .catch((rollbackError: unknown) => {
          this.logger.warn(
            `Could not roll back Discord role ${created.id}: ${this.errorMessage(rollbackError)}`,
          );
        });

      throw error;
    }

    return 'created';
  }

  private async updateOwnedRole(
    role: Role,
    definition: CommunityDiscordRoleDefinition,
  ): Promise<ProvisionOutcome> {
    this.assertEditable(role, definition);

    const currentColor = role.colors.primaryColor === 0 ? null : role.hexColor.toLowerCase();
    const needsUpdate = role.name !== definition.name || currentColor !== definition.color;

    if (!needsUpdate) {
      return 'unchanged';
    }

    await role.edit({
      name: definition.name,
      colors: {
        primaryColor: this.toDiscordColor(definition.color),
      },
      reason: PROVISION_REASON,
    });

    return 'updated';
  }

  private async synchronizeRolePositions(
    guild: Guild,
  ): Promise<void> {
    const definitions =
      (await this.definitions.getDefinitions())
        .filter(
          (definition) =>
            definition.enabled &&
            definition.provisionedByCommunity &&
            definition.discordRoleId !== null,
        );

    if (definitions.length < 2) {
      return;
    }

    const guildRoles =
      await guild.roles.fetch();
    const managed = definitions.flatMap(
      (definition) => {
        const role = definition.discordRoleId
          ? guildRoles.get(
              definition.discordRoleId,
            )
          : null;

        return role &&
          !role.managed &&
          role.editable
          ? [{ definition, role }]
          : [];
      },
    );

    if (managed.length < 2) {
      return;
    }

    const positions = managed
      .map(({ role }) => role.position)
      .sort((left, right) => left - right);
    const ordered = managed.sort(
      (left, right) =>
        this.roleKindPriority(
          left.definition.kind,
        ) -
          this.roleKindPriority(
            right.definition.kind,
          ) ||
        right.definition.sortOrder -
          left.definition.sortOrder ||
        left.definition.key.localeCompare(
          right.definition.key,
        ),
    );
    const moves = ordered
      .map(({ role }, index) => ({
        role,
        position: positions[index],
      }))
      .filter(
        ({ role, position }) =>
          role.position !== position,
      );

    if (moves.length === 0) {
      return;
    }

    await guild.roles.setPositions(
      moves,
    );
  }

  private async resolveOwnedRole(
    guild: Guild,
    roleId: string,
  ): Promise<Role | null> {
    const cached =
      guild.roles.cache.get(roleId);

    if (cached) {
      return cached;
    }

    try {
      return await guild.roles.fetch(roleId);
    } catch (error: unknown) {
      if (
        this.discordErrorCode(error) ===
        DISCORD_UNKNOWN_ROLE_ERROR_CODE
      ) {
        return null;
      }

      throw error;
    }
  }

  private roleKindPriority(
    kind: CommunityDiscordRoleKind,
  ): number {
    switch (kind) {
      case 'level-range':
        return 0;
      case 'special':
        return 1;
      case 'showcase':
        return 2;
    }
  }

  private assertEditable(role: Role, definition: CommunityDiscordRoleDefinition): void {
    if (role.managed) {
      throw new Error(
        `Owned Discord role ${role.id} for "${definition.key}" is managed by Discord or another integration.`,
      );
    }

    if (!role.editable) {
      throw new Error(
        `Owned Discord role ${role.id} for "${definition.key}" is above the bot or otherwise not editable.`,
      );
    }
  }

  private toDiscordColor(color: string | null): number {
    if (!color) {
      return 0;
    }

    return Number.parseInt(color.slice(1), 16);
  }

  private discordErrorCode(
    error: unknown,
  ): number | string | null {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error)
    ) {
      return null;
    }

    const code = error.code;

    return typeof code === 'number' ||
      typeof code === 'string'
      ? code
      : null;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
