import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import type {
  CommunityDiscordRoleCatalog,
} from '@shared/community/community-discord';
import type {
  CommunityPublicSummary,
} from '@shared/community/community-public';

import {
  Client,
  Events,
  GatewayIntentBits,
  type GuildMember,
  type Message,
} from 'discord.js';
import type { Subscription } from 'rxjs';

import { UsersService } from '../../users/users.service';
import { CommunityRewardSyncService } from '../community-reward-sync.service';
import {
  DiscordCommunityService,
  type DiscordCommunityMember,
} from './discord-community.service';
import { DiscordPublicCommunityService } from './discord-public-community.service';
import { DiscordRoleSyncService } from './discord-role-sync.service';

const MEMBERSHIP_RECONCILIATION_INTERVAL_MS =
  15 * 60 * 1000;
const DISCORD_UNKNOWN_MEMBER_ERROR_CODE = 10007;

@Injectable()
export class DiscordBotService
  implements
    OnApplicationBootstrap,
    OnApplicationShutdown
{
  private readonly logger =
    new Logger(DiscordBotService.name);
  private readonly token: string | null;
  private readonly guildId: string | null;
  private readonly client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
  private handlersRegistered = false;
  private reconciliationRunning = false;
  private membersLoaded = false;
  private rewardSyncSubscription:
    Subscription | null = null;

  constructor(
    config: ConfigService,
    private readonly users:
      UsersService,
    private readonly rewardSync:
      CommunityRewardSyncService,
    private readonly community:
      DiscordCommunityService,
    private readonly publicCommunity:
      DiscordPublicCommunityService,
    private readonly roleSync:
      DiscordRoleSyncService,
  ) {
    this.token =
      this.normalizeConfigValue(
        config.get<string>(
          'DISCORD_BOT_TOKEN',
        ),
      );
    this.guildId =
      this.normalizeConfigValue(
        config.get<string>(
          'DISCORD_GUILD_ID',
        ),
      );
  }

  onApplicationBootstrap(): void {
    this.rewardSyncSubscription =
      this.rewardSync
        .requests()
        .subscribe((userUuid) => {
          void this.syncRewardRoles(
            userUuid,
          ).catch(
            (error: unknown) => {
              this.logger.warn(
                `Could not synchronize Discord rewards for community user ${userUuid}: ${this.errorMessage(error)}`,
              );
            },
          );
        });

    if (!this.token && !this.guildId) {
      this.logger.log(
        'Discord community bot is disabled.',
      );
      return;
    }

    if (!this.token || !this.guildId) {
      this.logger.warn(
        'Discord community bot needs both DISCORD_BOT_TOKEN and DISCORD_GUILD_ID.',
      );
      return;
    }

    this.registerHandlers();

    void this.client
      .login(this.token)
      .catch((error: unknown) => {
        this.logger.error(
          `Discord bot login failed: ${this.errorMessage(error)}`,
        );
      });
  }

  onApplicationShutdown(): void {
    this.rewardSyncSubscription
      ?.unsubscribe();
    this.rewardSyncSubscription = null;
    this.client.destroy();
  }

  async getRoleCatalog():
    Promise<CommunityDiscordRoleCatalog> {
    const configured =
      this.token !== null &&
      this.guildId !== null;

    if (
      !configured ||
      !this.guildId ||
      !this.client.isReady()
    ) {
      return {
        configured,
        connected: false,
        roles: [],
      };
    }

    try {
      const guild =
        await this.client.guilds.fetch(
          this.guildId,
        );
      const roles =
        await guild.roles.fetch();

      return {
        configured: true,
        connected: true,
        roles: Array.from(
          roles.values(),
        )
          .filter(
            (role) =>
              role.id !== guild.id &&
              !role.managed &&
              role.editable,
          )
          .sort(
            (left, right) =>
              right.position -
              left.position,
          )
          .map((role) => ({
            id: role.id,
            name: role.name,
            color:
              role.color === 0
                ? null
                : role.hexColor,
            position: role.position,
          })),
      };
    } catch (error: unknown) {
      this.logger.warn(
        `Could not load Discord roles: ${this.errorMessage(error)}`,
      );

      return {
        configured: true,
        connected: false,
        roles: [],
      };
    }
  }

  async getPublicSummary():
    Promise<CommunityPublicSummary> {
    const configured =
      this.token !== null &&
      this.guildId !== null;

    if (
      !configured ||
      !this.guildId ||
      !this.client.isReady()
    ) {
      return this.publicCommunity
        .disconnected(configured);
    }

    try {
      const guild =
        await this.client.guilds.fetch(
          this.guildId,
        );

      if (!this.membersLoaded) {
        await guild.members.fetch({
          withPresences: true,
        });
        this.membersLoaded = true;
      }

      return this.publicCommunity
        .getSummary(guild);
    } catch (error: unknown) {
      this.logger.warn(
        `Could not load Discord community summary: ${this.errorMessage(error)}`,
      );

      return this.publicCommunity
        .disconnected(true);
    }
  }

  async refreshMember(
    discordId: string,
  ): Promise<void> {
    if (
      !this.guildId ||
      !this.client.isReady()
    ) {
      return;
    }

    const guild =
      await this.client.guilds.fetch(
        this.guildId,
      );

    try {
      const member =
        await guild.members.fetch({
          user: discordId,
          force: true,
        });

      await this.community.syncMember(
        this.mapMember(member),
      );
      await this.roleSync.syncMember(
        member,
      );
      this.publicCommunity.invalidate();
    } catch (error: unknown) {
      if (
        this.discordErrorCode(error) ===
        DISCORD_UNKNOWN_MEMBER_ERROR_CODE
      ) {
        await this.community.removeMember(
          discordId,
        );
        this.publicCommunity.invalidate();
        return;
      }

      throw error;
    }
  }

  @Interval(
    'discord-membership-reconciliation',
    MEMBERSHIP_RECONCILIATION_INTERVAL_MS,
  )
  async reconcileMembership(): Promise<void> {
    if (
      !this.guildId ||
      !this.client.isReady() ||
      this.reconciliationRunning
    ) {
      return;
    }

    this.reconciliationRunning = true;

    try {
      const guild =
        await this.client.guilds.fetch(
          this.guildId,
        );
      const members =
        await guild.members.fetch({
          withPresences: true,
        });
      this.membersLoaded = true;
      this.publicCommunity.invalidate();

      await this.community.reconcileMembers(
        Array.from(
          members.values(),
          (member) =>
            this.mapMember(member),
        ),
      );
      const roleResult =
        await this.roleSync.syncMembers(
          members.values(),
        );

      this.logger.log(
        `Discord membership reconciled for ${members.size} server members; roles synchronized for ${roleResult.handled} community members (${roleResult.added} added, ${roleResult.removed} removed).`,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Discord membership reconciliation failed: ${this.errorMessage(error)}`,
      );
    } finally {
      this.reconciliationRunning = false;
    }
  }

  private registerHandlers(): void {
    if (this.handlersRegistered) {
      return;
    }

    this.handlersRegistered = true;

    this.client.once(
      Events.ClientReady,
      (client) => {
        this.logger.log(
          `Discord community bot connected as ${client.user.tag}.`,
        );
        this.membersLoaded = false;
        this.publicCommunity.invalidate();

        void this.reconcileMembership();
      },
    );

    this.client.on(
      Events.GuildMemberAdd,
      (member) => {
        if (!this.isConfiguredGuild(member.guild.id)) {
          return;
        }

        this.publicCommunity.invalidate();

        void this.community
          .syncMember(
            this.mapMember(member),
          )
          .then(() =>
            this.roleSync.syncMember(
              member,
            ),
          )
          .catch((error: unknown) => {
            this.logger.warn(
              `Could not process Discord member join: ${this.errorMessage(error)}`,
            );
          });
      },
    );

    this.client.on(
      Events.GuildMemberRemove,
      (member) => {
        if (!this.isConfiguredGuild(member.guild.id)) {
          return;
        }

        this.publicCommunity.invalidate();

        void this.community
          .removeMember(member.id)
          .catch((error: unknown) => {
            this.logger.warn(
              `Could not process Discord member leave: ${this.errorMessage(error)}`,
            );
          });
      },
    );

    this.client.on(
      Events.PresenceUpdate,
      (_previous, current) => {
        if (
          !this.isConfiguredGuild(
            current.guild?.id ?? null,
          )
        ) {
          return;
        }

        this.publicCommunity.invalidate();
      },
    );

    this.client.on(
      Events.MessageCreate,
      (message) => {
        if (!this.isConfiguredGuild(message.guildId)) {
          return;
        }

        void this.handleMessage(message)
          .catch((error: unknown) => {
            this.logger.warn(
              `Could not process Discord message activity: ${this.errorMessage(error)}`,
            );
          });
      },
    );

    this.client.on(
      Events.Error,
      (error) => {
        this.logger.error(
          `Discord client error: ${error.message}`,
        );
      },
    );

    this.client.on(
      Events.Warn,
      (message) => {
        this.logger.warn(
          `Discord client warning: ${message}`,
        );
      },
    );
  }

  private async handleMessage(
    message: Message,
  ): Promise<void> {
    await this.community.recordMessage({
      messageId: message.id,
      authorDiscordId:
        message.author.id,
      authorDisplayName:
        message.member?.displayName ??
        message.author.globalName ??
        message.author.username,
      authorAvatarHash:
        message.author.avatar,
      authorIsBot:
        message.author.bot,
      isSystemMessage:
        message.system,
      webhookId:
        message.webhookId,
      content:
        message.content,
      memberJoinedAt:
        message.member?.joinedAt ?? null,
      occurredAt:
        message.createdAt,
    });
  }

  private async syncRewardRoles(
    userUuid: string,
  ): Promise<void> {
    if (
      !this.guildId ||
      !this.client.isReady()
    ) {
      return;
    }

    const user =
      await this.users.findByUuid(
        userUuid,
      );

    if (!user?.discordId) {
      return;
    }

    await this.refreshMember(
      user.discordId,
    );
  }

  private mapMember(
    member: GuildMember,
  ): DiscordCommunityMember {
    return {
      discordId: member.id,
      displayName:
        member.displayName,
      avatarHash:
        member.user.avatar,
      joinedAt:
        member.joinedAt,
    };
  }

  private isConfiguredGuild(
    guildId: string | null,
  ): boolean {
    return (
      this.guildId !== null &&
      guildId === this.guildId
    );
  }

  private normalizeConfigValue(
    value: string | undefined,
  ): string | null {
    return value?.trim() || null;
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

    return (
      typeof code === 'number' ||
      typeof code === 'string'
    )
      ? code
      : null;
  }

  private errorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
