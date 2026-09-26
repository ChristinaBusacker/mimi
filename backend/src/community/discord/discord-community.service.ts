import { Injectable } from '@nestjs/common';

import { UsersService } from '../../users/users.service';
import { CommunityEventService } from '../community-event.service';
import { CommunityService } from '../community.service';

export interface DiscordCommunityMember {
  discordId: string;
  displayName: string;
  avatarHash: string | null;
  joinedAt: Date | null;
}

export interface DiscordCommunityMessage {
  messageId: string;
  authorDiscordId: string;
  authorDisplayName: string;
  authorAvatarHash: string | null;
  authorIsBot: boolean;
  isSystemMessage: boolean;
  webhookId: string | null;
  content: string;
  memberJoinedAt: Date | null;
  occurredAt: Date;
}

@Injectable()
export class DiscordCommunityService {
  constructor(
    private readonly users: UsersService,
    private readonly community: CommunityService,
    private readonly events: CommunityEventService,
  ) {}

  async reconcileMembers(
    members: readonly DiscordCommunityMember[],
    observedAt: Date = new Date(),
  ): Promise<void> {
    const connectedUsers = (
      await this.users.findAll()
    ).flatMap((user) =>
      user.discordId
        ? [
            {
              user,
              discordId: user.discordId,
            },
          ]
        : [],
    );
    const usersByDiscordId = new Map(
      connectedUsers.map(({ user, discordId }) => [
        discordId,
        user,
      ]),
    );
    const seenDiscordIds = new Set<string>();

    for (const member of members) {
      const user = usersByDiscordId.get(
        member.discordId,
      );

      if (!user) {
        continue;
      }

      seenDiscordIds.add(member.discordId);
      await this.syncKnownMember(
        user.uuid,
        member,
        observedAt,
      );
    }

    for (const { user, discordId } of connectedUsers) {
      if (seenDiscordIds.has(discordId)) {
        continue;
      }

      const profile =
        await this.community.getProfile(
          user.uuid,
        );

      if (profile?.isDiscordMember) {
        await this.community.markDiscordLeft(
          user.uuid,
          observedAt,
        );
      }
    }
  }

  async syncMember(
    member: DiscordCommunityMember,
    observedAt: Date = new Date(),
  ): Promise<boolean> {
    const user =
      await this.users.findByDiscordId(
        member.discordId,
      );

    if (!user) {
      return false;
    }

    await this.syncKnownMember(
      user.uuid,
      member,
      observedAt,
    );

    return true;
  }

  async removeMember(
    discordId: string,
    leftAt: Date = new Date(),
  ): Promise<boolean> {
    const user =
      await this.users.findByDiscordId(
        discordId,
      );

    if (!user) {
      return false;
    }

    await this.community.markDiscordLeft(
      user.uuid,
      leftAt,
    );

    return true;
  }

  async recordMessage(
    message: DiscordCommunityMessage,
  ): Promise<boolean> {
    if (
      message.authorIsBot ||
      message.isSystemMessage ||
      message.webhookId
    ) {
      return false;
    }

    const user =
      await this.users.findByDiscordId(
        message.authorDiscordId,
      );

    if (!user) {
      return false;
    }

    let profile =
      await this.community.getProfile(
        user.uuid,
      );

    if (!profile) {
      profile =
        await this.community
          .upsertDiscordIdentity(
            user.uuid,
            message.authorDisplayName,
            message.authorAvatarHash,
          );
    }

    if (!profile.isDiscordMember) {
      await this.community.markDiscordJoined(
        user.uuid,
        message.memberJoinedAt ??
          message.occurredAt,
      );
    }

    await this.events.recordEvent({
      userUuid: user.uuid,
      type: 'discord.message.activity',
      source: 'discord',
      sourceEventId:
        message.messageId,
      occurredAt:
        message.occurredAt,
      contentLength:
        Array.from(
          message.content.trim(),
        ).length,
    });

    return true;
  }

  private async syncKnownMember(
    userUuid: string,
    member: DiscordCommunityMember,
    observedAt: Date,
  ): Promise<void> {
    const profile =
      await this.community
        .upsertDiscordIdentity(
          userUuid,
          member.displayName,
          member.avatarHash,
        );
    const joinedAt =
      member.joinedAt ??
      profile.currentDiscordJoinAt ??
      observedAt;

    await this.community.markDiscordJoined(
      userUuid,
      joinedAt,
    );
  }
}
