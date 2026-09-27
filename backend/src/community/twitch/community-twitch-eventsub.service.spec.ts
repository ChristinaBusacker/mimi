import { ConfigService } from '@nestjs/config';
import {
  createHmac,
} from 'node:crypto';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { TwitchService } from '../../integrations/twitch/twitch.service';
import { CommunityEventService } from '../community-event.service';
import {
  CommunityTwitchEventSubService,
  type TwitchEventSubWebhookBody,
} from './community-twitch-eventsub.service';
import { CommunityTwitchIdentityService } from './community-twitch-identity.service';

const secret =
  '0123456789abcdef0123456789abcdef';
const userUuid =
  '00000000-0000-4000-8000-000000000001';

function createService() {
  const config = {
    get: vi.fn((key: string) => {
      const values: Record<
        string,
        string
      > = {
        TWITCH_CLIENT_ID: 'client-id',
        TWITCH_CLIENT_SECRET:
          'client-secret',
        TWITCH_CHANNEL_LOGIN:
          'mimi',
        TWITCH_EVENTSUB_SECRET:
          secret,
        PUBLIC_SITE_URL:
          'http://localhost:4200',
      };

      return values[key];
    }),
  } as unknown as ConfigService;
  const twitch = {} as TwitchService;
  const identities = {
    findUserUuidByTwitchUserId:
      vi.fn(),
  } as unknown as
    CommunityTwitchIdentityService;
  const events = {
    recordEvent: vi.fn(),
  } as unknown as CommunityEventService;

  return {
    service:
      new CommunityTwitchEventSubService(
        config,
        twitch,
        identities,
        events,
      ),
    identities,
    events,
  };
}

function signedInput(
  body: TwitchEventSubWebhookBody,
) {
  const messageId = 'message-id';
  const messageTimestamp =
    new Date().toISOString();
  const rawBody = Buffer.from(
    JSON.stringify(body),
  );
  const messageSignature =
    `sha256=${createHmac(
      'sha256',
      secret,
    )
      .update(messageId)
      .update(messageTimestamp)
      .update(rawBody)
      .digest('hex')}`;

  return {
    messageId,
    messageTimestamp,
    messageSignature,
    messageType: 'notification',
    rawBody,
    body,
  };
}

describe(
  'CommunityTwitchEventSubService',
  () => {
    it(
      'records linked chat activity without persisting message content',
      async () => {
        const {
          service,
          identities,
          events,
        } = createService();
        const identitiesMock =
          vi.mocked(identities);
        const eventsMock =
          vi.mocked(events);

        identitiesMock
          .findUserUuidByTwitchUserId
          .mockResolvedValue(userUuid);

        const body = {
          subscription: {
            type:
              'channel.chat.message',
          },
          event: {
            chatter_user_id:
              '123456789',
            message: {
              text:
                'Hallo Twitch Community 👋',
            },
          },
        };

        await service.handleWebhook(
          signedInput(body),
        );

        expect(
          eventsMock.recordEvent,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            userUuid,
            type:
              'twitch.chat.activity',
            source: 'twitch',
            sourceEventId:
              'message-id',
            contentLength: 24,
          }),
        );
        expect(
          JSON.stringify(
            eventsMock.recordEvent.mock
              .calls[0]?.[0],
          ),
        ).not.toContain(
          'Hallo Twitch Community',
        );
      },
    );

    it(
      'records cumulative subscription months for resub achievements',
      async () => {
        const {
          service,
          identities,
          events,
        } = createService();
        const identitiesMock =
          vi.mocked(identities);
        const eventsMock =
          vi.mocked(events);

        identitiesMock
          .findUserUuidByTwitchUserId
          .mockResolvedValue(userUuid);

        await service.handleWebhook(
          signedInput({
            subscription: {
              type:
                'channel.subscription.message',
            },
            event: {
              user_id: '123456789',
              tier: '1000',
              cumulative_months: 14,
              streak_months: 6,
              duration_months: 1,
            },
          }),
        );

        expect(
          eventsMock.recordEvent,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            type:
              'twitch.subscription.resub',
            metadata: {
              tier: '1000',
              cumulativeMonths: 14,
              streakMonths: 6,
              durationMonths: 1,
            },
          }),
        );
      },
    );

    it(
      'ignores Twitch activity from accounts that are not linked',
      async () => {
        const {
          service,
          identities,
          events,
        } = createService();
        const identitiesMock =
          vi.mocked(identities);
        const eventsMock =
          vi.mocked(events);

        identitiesMock
          .findUserUuidByTwitchUserId
          .mockResolvedValue(null);

        await service.handleWebhook(
          signedInput({
            subscription: {
              type: 'channel.subscribe',
            },
            event: {
              user_id: '123456789',
              tier: '1000',
              is_gift: false,
            },
          }),
        );

        expect(
          eventsMock.recordEvent,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects webhook messages with an invalid signature',
      async () => {
        const { service } =
          createService();
        const input = signedInput({
          subscription: {
            type: 'channel.subscribe',
          },
          event: {
            user_id: '123456789',
          },
        });

        input.messageSignature =
          'sha256=invalid';

        await expect(
          service.handleWebhook(input),
        ).rejects.toThrow(
          'Twitch EventSub signature is invalid.',
        );
      },
    );
  },
);
