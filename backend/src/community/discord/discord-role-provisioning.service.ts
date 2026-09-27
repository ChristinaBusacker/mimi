import type { CommunityDiscordRoleDefinition } from '@shared/community/community-discord';

import { Injectable, Logger } from '@nestjs/common';
import type { Guild, Role } from 'discord.js';

import { CommunityDiscordRoleDefinitionService } from '../community-discord-role-definition.service';

const PROVISION_REASON = 'Community role provisioning';

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

    return result;
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

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
