import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  GuildMember,
  Role,
} from 'discord.js';
import {
  Repository,
} from 'typeorm';

import { UsersService } from '../../users/users.service';
import { CommunityDiscordUserRoleResolverService } from '../community-discord-user-role-resolver.service';
import { CommunityDiscordAssignedRoleEntry } from '../entities/community-discord-assigned-role.entry';

export interface DiscordRoleSyncResult {
  handled: boolean;
  added: number;
  removed: number;
}

@Injectable()
export class DiscordRoleSyncService {
  private readonly logger =
    new Logger(
      DiscordRoleSyncService.name,
    );

  constructor(
    private readonly users: UsersService,
    private readonly resolver:
      CommunityDiscordUserRoleResolverService,
    @InjectRepository(
      CommunityDiscordAssignedRoleEntry,
    )
    private readonly assignedRoles:
      Repository<CommunityDiscordAssignedRoleEntry>,
  ) {}

  async syncMember(
    member: GuildMember,
  ): Promise<DiscordRoleSyncResult> {
    const user =
      await this.users.findByDiscordId(
        member.id,
      );

    if (!user) {
      return {
        handled: false,
        added: 0,
        removed: 0,
      };
    }

    const resolution =
      await this.resolver.resolve(
        user.uuid,
      );
    const desiredRoleIds =
      resolution.desiredRoleIds;
    const managedRoleIds =
      resolution.managedRoleIds;
    const tracked =
      await this.assignedRoles.findBy({
        userUuid: user.uuid,
      });
    const trackedRoleIds =
      new Set(
        tracked.map(
          (entry) => entry.roleId,
        ),
      );
    let added = 0;
    let removed = 0;

    for (const entry of tracked) {
      if (
        managedRoleIds.has(entry.roleId)
      ) {
        continue;
      }

      await this.assignedRoles.delete({
        userUuid: user.uuid,
        roleId: entry.roleId,
      });
      trackedRoleIds.delete(
        entry.roleId,
      );
    }

    for (const roleId of managedRoleIds) {
      if (desiredRoleIds.has(roleId)) {
        continue;
      }

      if (!member.roles.cache.has(roleId)) {
        if (trackedRoleIds.has(roleId)) {
          await this.assignedRoles.delete({
            userUuid: user.uuid,
            roleId,
          });
          trackedRoleIds.delete(roleId);
        }

        continue;
      }

      const role =
        await this.resolveRole(
          member,
          roleId,
        );

      if (!role?.editable) {
        this.logger.warn(
          `Cannot remove managed Discord role ${roleId} from ${member.id}: role is missing or above the bot.`,
        );
        continue;
      }

      await member.roles.remove(
        role,
        'Community role selection changed',
      );

      if (trackedRoleIds.has(roleId)) {
        await this.assignedRoles.delete({
          userUuid: user.uuid,
          roleId,
        });
        trackedRoleIds.delete(roleId);
      }

      removed += 1;
    }

    for (const roleId of desiredRoleIds) {
      if (member.roles.cache.has(roleId)) {
        if (!trackedRoleIds.has(roleId)) {
          await this.trackRole(
            user.uuid,
            roleId,
          );
          trackedRoleIds.add(roleId);
        }

        continue;
      }

      const role =
        await this.resolveRole(
          member,
          roleId,
        );

      if (!role?.editable) {
        this.logger.warn(
          `Cannot assign Discord role ${roleId} to ${member.id}: role is missing or above the bot.`,
        );
        continue;
      }

      await member.roles.add(
        role,
        'Community role selection',
      );
      await this.trackRole(
        user.uuid,
        roleId,
      );
      trackedRoleIds.add(roleId);
      added += 1;
    }

    return {
      handled: true,
      added,
      removed,
    };
  }

  async syncMembers(
    members: Iterable<GuildMember>,
  ): Promise<{
    handled: number;
    added: number;
    removed: number;
  }> {
    let handled = 0;
    let added = 0;
    let removed = 0;

    for (const member of members) {
      try {
        const result =
          await this.syncMember(member);

        if (!result.handled) {
          continue;
        }

        handled += 1;
        added += result.added;
        removed += result.removed;
      } catch (error: unknown) {
        this.logger.warn(
          `Could not synchronize Discord roles for ${member.id}: ${this.errorMessage(error)}`,
        );
      }
    }

    return {
      handled,
      added,
      removed,
    };
  }

  private trackRole(
    userUuid: string,
    roleId: string,
  ): Promise<CommunityDiscordAssignedRoleEntry> {
    return this.assignedRoles.save(
      this.assignedRoles.create({
        userUuid,
        roleId,
      }),
    );
  }

  private async resolveRole(
    member: GuildMember,
    roleId: string,
  ): Promise<Role | null> {
    const cached =
      member.guild.roles.cache.get(
        roleId,
      );

    if (cached) {
      return cached;
    }

    return member.guild.roles
      .fetch(roleId)
      .catch(() => null);
  }

  private errorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
