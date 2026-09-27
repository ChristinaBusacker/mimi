import { ConfigService } from '@nestjs/config';
import {
  Collection,
  type Guild,
  type GuildMember,
} from 'discord.js';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { DiscordPublicCommunityService } from './discord-public-community.service';

function member(
  id: string,
  options: {
    bot?: boolean;
    status?: 'online' | 'idle' | 'dnd' | 'offline';
  } = {},
): GuildMember {
  return {
    id,
    user: {
      bot: options.bot ?? false,
    },
    presence: options.status
      ? {
          status: options.status,
        }
      : null,
  } as unknown as GuildMember;
}

function config(
  inviteChannelId?: string,
): ConfigService {
  return {
    get: vi.fn(
      (key: string) =>
        key === 'DISCORD_INVITE_CHANNEL_ID'
          ? inviteChannelId
          : undefined,
    ),
  } as unknown as ConfigService;
}

describe(
  'DiscordPublicCommunityService',
  () => {
    it(
      'returns live human member and presence counts and reuses the public invite',
      async () => {
        const members =
          new Collection<
            string,
            GuildMember
          >([
            [
              'online',
              member('online', {
                status: 'online',
              }),
            ],
            [
              'idle',
              member('idle', {
                status: 'idle',
              }),
            ],
            [
              'offline',
              member('offline', {
                status: 'offline',
              }),
            ],
            [
              'bot',
              member('bot', {
                bot: true,
                status: 'online',
              }),
            ],
          ]);
        const createInvite = vi.fn(
          async () => ({
            url: 'https://discord.gg/community',
          }),
        );
        const guild = {
          name: 'Mimis Community',
          vanityURLCode: null,
          members: {
            cache: members,
            me: member('bot', {
              bot: true,
              status: 'online',
            }),
          },
          systemChannel: null,
          channels: {
            cache: new Collection(),
          },
          invites: {
            create: createInvite,
          },
        } as unknown as Guild;
        const service =
          new DiscordPublicCommunityService(
            config('channel-id'),
          );

        const first =
          await service.getSummary(guild);
        const second =
          await service.getSummary(guild);

        expect(first.discord).toMatchObject({
          configured: true,
          connected: true,
          guildName: 'Mimis Community',
          memberCount: 3,
          onlineCount: 2,
          inviteUrl:
            'https://discord.gg/community',
        });
        expect(second.discord.inviteUrl)
          .toBe(first.discord.inviteUrl);
        expect(createInvite)
          .toHaveBeenCalledTimes(1);
        expect(createInvite)
          .toHaveBeenCalledWith(
            'channel-id',
            expect.objectContaining({
              maxAge: 0,
              maxUses: 0,
              unique: false,
            }),
          );
      },
    );

    it(
      'prefers the guild vanity invite without creating another invite',
      async () => {
        const createInvite = vi.fn();
        const guild = {
          name: 'Mimis Community',
          vanityURLCode: 'mimi',
          members: {
            cache: new Collection(),
            me: null,
          },
          systemChannel: null,
          channels: {
            cache: new Collection(),
          },
          invites: {
            create: createInvite,
          },
        } as unknown as Guild;
        const service =
          new DiscordPublicCommunityService(
            config(),
          );

        const summary =
          await service.getSummary(guild);

        expect(summary.discord.inviteUrl)
          .toBe('https://discord.gg/mimi');
        expect(createInvite)
          .not.toHaveBeenCalled();
      },
    );
  },
);
