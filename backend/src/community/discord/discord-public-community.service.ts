import type {
  CommunityPublicSummary,
} from '@shared/community/community-public';

import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
} from 'discord.js';

const PUBLIC_SUMMARY_CACHE_MS = 30 * 1000;

@Injectable()
export class DiscordPublicCommunityService {
  private readonly logger =
    new Logger(
      DiscordPublicCommunityService.name,
    );
  private readonly inviteChannelId:
    string | null;
  private inviteUrl: string | null | undefined;
  private summaryCache: {
    expiresAt: number;
    value: CommunityPublicSummary;
  } | null = null;

  constructor(config: ConfigService) {
    this.inviteChannelId =
      this.normalizeConfigValue(
        config.get<string>(
          'DISCORD_INVITE_CHANNEL_ID',
        ),
      );
  }

  async getSummary(
    guild: Guild,
  ): Promise<CommunityPublicSummary> {
    const now = Date.now();

    if (
      this.summaryCache &&
      this.summaryCache.expiresAt > now
    ) {
      return this.summaryCache.value;
    }

    const humanMembers =
      guild.members.cache.filter(
        (member) => !member.user.bot,
      );
    const onlineCount =
      humanMembers.filter(
        (member) =>
          member.presence?.status !==
            undefined &&
          member.presence.status !==
            'offline',
      ).size;
    const value: CommunityPublicSummary = {
      discord: {
        configured: true,
        connected: true,
        guildName: guild.name,
        memberCount: humanMembers.size,
        onlineCount,
        inviteUrl:
          await this.resolveInviteUrl(
            guild,
          ),
        updatedAt:
          new Date().toISOString(),
      },
    };

    this.summaryCache = {
      expiresAt:
        now + PUBLIC_SUMMARY_CACHE_MS,
      value,
    };

    return value;
  }

  disconnected(
    configured: boolean,
  ): CommunityPublicSummary {
    return {
      discord: {
        configured,
        connected: false,
        guildName: null,
        memberCount: null,
        onlineCount: null,
        inviteUrl: null,
        updatedAt:
          new Date().toISOString(),
      },
    };
  }

  invalidate(): void {
    this.summaryCache = null;
  }

  private async resolveInviteUrl(
    guild: Guild,
  ): Promise<string | null> {
    if (this.inviteUrl !== undefined) {
      return this.inviteUrl;
    }

    if (guild.vanityURLCode) {
      this.inviteUrl =
        `https://discord.gg/${guild.vanityURLCode}`;
      return this.inviteUrl;
    }

    const inviteChannelId =
      this.resolveInviteChannelId(guild);

    if (!inviteChannelId) {
      this.logger.warn(
        'No Discord channel is available for a public community invite.',
      );
      return null;
    }

    try {
      const invite =
        await guild.invites.create(
          inviteChannelId,
          {
            maxAge: 0,
            maxUses: 0,
            unique: false,
            reason:
              'Permanent invite for the public community page',
          },
        );

      this.inviteUrl = invite.url;
      return this.inviteUrl;
    } catch (error: unknown) {
      this.logger.warn(
        `Could not resolve Discord invite: ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  private resolveInviteChannelId(
    guild: Guild,
  ): string | null {
    if (this.inviteChannelId) {
      return this.inviteChannelId;
    }

    const botMember = guild.members.me;

    if (!botMember) {
      return null;
    }

    if (guild.systemChannel) {
      const permissions =
        guild.systemChannel.permissionsFor(
          botMember,
        );

      if (
        permissions?.has(
          PermissionFlagsBits.CreateInstantInvite,
        )
      ) {
        return guild.systemChannel.id;
      }
    }

    return (
      guild.channels.cache.find(
        (channel) =>
          channel.type ===
            ChannelType.GuildText &&
          channel
            .permissionsFor(botMember)
            ?.has(
              PermissionFlagsBits.CreateInstantInvite,
            ) === true,
      )?.id ?? null
    );
  }

  private normalizeConfigValue(
    value: string | undefined,
  ): string | null {
    return value?.trim() || null;
  }

  private errorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
