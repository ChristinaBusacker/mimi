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
  In,
  Repository,
} from 'typeorm';

import { UsersService } from '../../users/users.service';
import { CommunityAchievementEntry } from '../entities/community-achievement.entry';
import { CommunityDiscordAssignedRoleEntry } from '../entities/community-discord-assigned-role.entry';
import { UserAchievementEntry } from '../entities/user-achievement.entry';

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
    @InjectRepository(
      CommunityAchievementEntry,
    )
    private readonly achievements:
      Repository<CommunityAchievementEntry>,
    @InjectRepository(
      UserAchievementEntry,
    )
    private readonly userAchievements:
      Repository<UserAchievementEntry>,
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

    const unlocked =
      await this.userAchievements.findBy({
        userUuid: user.uuid,
      });
    const unlockedIds = unlocked.map(
      (entry) => entry.achievementUuid,
    );
    const definitions =
      unlockedIds.length === 0
        ? []
        : await this.achievements.find({
            where: {
              uuid: In(unlockedIds),
            },
          });
    const desiredRoleIds = new Set(
      definitions.flatMap(
        (achievement) =>
          achievement.discordRoleId
            ? [achievement.discordRoleId]
            : [],
      ),
    );
    const tracked =
      await this.assignedRoles.findBy({
        userUuid: user.uuid,
      });
    let added = 0;
    let removed = 0;

    for (const entry of tracked) {
      if (
        desiredRoleIds.has(entry.roleId)
      ) {
        continue;
      }

      if (
        !member.roles.cache.has(
          entry.roleId,
        )
      ) {
        await this.assignedRoles.delete({
          userUuid: user.uuid,
          roleId: entry.roleId,
        });
        continue;
      }

      const role =
        await this.resolveRole(
          member,
          entry.roleId,
        );

      if (!role?.editable) {
        this.logger.warn(
          `Cannot remove managed Discord role ${entry.roleId} from ${member.id}: role is missing or above the bot.`,
        );
        continue;
      }

      await member.roles.remove(
        role,
        'Community achievement reward changed',
      );
      await this.assignedRoles.delete({
        userUuid: user.uuid,
        roleId: entry.roleId,
      });
      removed += 1;
    }

    for (const roleId of desiredRoleIds) {
      if (
        member.roles.cache.has(roleId)
      ) {
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
        'Community achievement reward',
      );
      await this.assignedRoles.save(
        this.assignedRoles.create({
          userUuid: user.uuid,
          roleId,
        }),
      );
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
