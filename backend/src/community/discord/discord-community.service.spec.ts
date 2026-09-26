import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { UsersService } from '../../users/users.service';
import { CommunityEventService } from '../community-event.service';
import { CommunityService } from '../community.service';
import {
  DiscordCommunityService,
  type DiscordCommunityMessage,
} from './discord-community.service';

function createService() {
  const users = {
    findAll: vi.fn(),
    findByDiscordId: vi.fn(),
  } as unknown as UsersService;
  const community = {
    getProfile: vi.fn(),
    upsertDiscordIdentity: vi.fn(),
    markDiscordJoined: vi.fn(),
    markDiscordLeft: vi.fn(),
  } as unknown as CommunityService;
  const events = {
    recordEvent: vi.fn(),
  } as unknown as CommunityEventService;

  return {
    service:
      new DiscordCommunityService(
        users,
        community,
        events,
      ),
    users,
    community,
    events,
  };
}

const userUuid =
  '00000000-0000-4000-8000-000000000001';

function createMessage(
  overrides:
    Partial<DiscordCommunityMessage> = {},
): DiscordCommunityMessage {
  return {
    messageId: '123456789012345678',
    authorDiscordId:
      '223456789012345678',
    authorDisplayName: 'Mimi Fan',
    authorAvatarHash: 'avatar',
    authorIsBot: false,
    isSystemMessage: false,
    webhookId: null,
    content: 'Hallo Community 👋',
    memberJoinedAt:
      new Date(
        '2026-09-01T12:00:00Z',
      ),
    occurredAt:
      new Date(
        '2026-09-26T20:00:00Z',
      ),
    ...overrides,
  };
}

describe(
  'DiscordCommunityService',
  () => {
    it(
      'reconciles only registered Discord users and closes missing memberships',
      async () => {
        const {
          service,
          users,
          community,
        } = createService();
        const usersMock =
          vi.mocked(users);
        const communityMock =
          vi.mocked(community);

        usersMock.findAll
          .mockResolvedValue([
            {
              uuid: userUuid,
              name: 'Connected',
              email: null,
              password: null,
              discordId:
                '223456789012345678',
              role: 'user',
            },
            {
              uuid:
                '00000000-0000-4000-8000-000000000002',
              name: 'Left server',
              email: null,
              password: null,
              discordId:
                '323456789012345678',
              role: 'user',
            },
          ]);
        communityMock
          .upsertDiscordIdentity
          .mockResolvedValue({
            userUuid,
            isDiscordMember: true,
            currentDiscordJoinAt:
              new Date(
                '2026-09-01T12:00:00Z',
              ),
          } as never);
        communityMock.getProfile
          .mockResolvedValue({
            userUuid:
              '00000000-0000-4000-8000-000000000002',
            isDiscordMember: true,
          } as never);

        const observedAt =
          new Date(
            '2026-09-26T21:00:00Z',
          );

        await service.reconcileMembers(
          [
            {
              discordId:
                '223456789012345678',
              displayName: 'Connected',
              avatarHash: null,
              joinedAt:
                new Date(
                  '2026-09-01T12:00:00Z',
                ),
            },
            {
              discordId:
                '999999999999999999',
              displayName:
                'No website account',
              avatarHash: null,
              joinedAt:
                new Date(
                  '2026-09-20T12:00:00Z',
                ),
            },
          ],
          observedAt,
        );

        expect(
          communityMock
            .markDiscordJoined,
        ).toHaveBeenCalledWith(
          userUuid,
          new Date(
            '2026-09-01T12:00:00Z',
          ),
        );
        expect(
          communityMock
            .markDiscordLeft,
        ).toHaveBeenCalledWith(
          '00000000-0000-4000-8000-000000000002',
          observedAt,
        );
        expect(
          communityMock
            .upsertDiscordIdentity,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it(
      'records qualified message metadata without persisting message content',
      async () => {
        const {
          service,
          users,
          community,
          events,
        } = createService();
        const usersMock =
          vi.mocked(users);
        const communityMock =
          vi.mocked(community);
        const eventsMock =
          vi.mocked(events);

        usersMock.findByDiscordId
          .mockResolvedValue({
            uuid: userUuid,
          } as never);
        communityMock.getProfile
          .mockResolvedValue({
            userUuid,
            isDiscordMember: true,
          } as never);

        const message =
          createMessage();

        await service.recordMessage(
          message,
        );

        expect(
          eventsMock.recordEvent,
        ).toHaveBeenCalledWith({
          userUuid,
          type:
            'discord.message.activity',
          source: 'discord',
          sourceEventId:
            message.messageId,
          occurredAt:
            message.occurredAt,
          contentLength: 17,
        });
        expect(
          JSON.stringify(
            eventsMock.recordEvent.mock
              .calls[0]?.[0],
          ),
        ).not.toContain(
          message.content,
        );
      },
    );

    it(
      'ignores bots, system messages and webhooks',
      async () => {
        const {
          service,
          users,
          events,
        } = createService();
        const usersMock =
          vi.mocked(users);
        const eventsMock =
          vi.mocked(events);

        for (const message of [
          createMessage({
            authorIsBot: true,
          }),
          createMessage({
            isSystemMessage: true,
          }),
          createMessage({
            webhookId:
              '423456789012345678',
          }),
        ]) {
          expect(
            await service.recordMessage(
              message,
            ),
          ).toBe(false);
        }

        expect(
          usersMock.findByDiscordId,
        ).not.toHaveBeenCalled();
        expect(
          eventsMock.recordEvent,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'repairs membership before recording activity when the profile is stale',
      async () => {
        const {
          service,
          users,
          community,
          events,
        } = createService();
        const usersMock =
          vi.mocked(users);
        const communityMock =
          vi.mocked(community);
        const eventsMock =
          vi.mocked(events);

        usersMock.findByDiscordId
          .mockResolvedValue({
            uuid: userUuid,
          } as never);
        communityMock.getProfile
          .mockResolvedValue({
            userUuid,
            isDiscordMember: false,
          } as never);

        const message =
          createMessage();

        await service.recordMessage(
          message,
        );

        expect(
          communityMock
            .markDiscordJoined,
        ).toHaveBeenCalledWith(
          userUuid,
          message.memberJoinedAt,
        );
        expect(
          eventsMock.recordEvent,
        ).toHaveBeenCalledOnce();
      },
    );
  },
);
