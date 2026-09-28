import { ConfigService } from '@nestjs/config';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  TwitchService,
  type TwitchScheduleNotificationSegment,
} from '../integrations/twitch/twitch.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationDispatchService } from './notification-dispatch.service';
import { StreamNotificationService } from './stream-notification.service';

const NOW =
  new Date(
    '2026-09-28T18:00:00.000Z',
  );

function createService(options: {
  status?: ReturnType<TwitchService['getStatus']>;
  schedule?:
    TwitchScheduleNotificationSegment[];
  reminderEvents?: Array<{
    key: string;
    type: 'stream.reminder';
    context: Record<string, unknown>;
  }>;
  deliveredUsers?: string[];
} = {}): {
  service: StreamNotificationService;
  notifySubscribers: ReturnType<typeof vi.fn>;
  notifyUser: ReturnType<typeof vi.fn>;
  updateEventContext: ReturnType<typeof vi.fn>;
} {
  const notifySubscribers = vi.fn(
    async () => ({
      recipients: 1,
      skipped: 0,
      sent: 1,
      failed: 0,
      removed: 0,
    }),
  );
  const notifyUser = vi.fn(
    async () => ({
      recipients: 1,
      skipped: 0,
      sent: 1,
      failed: 0,
      removed: 0,
    }),
  );
  const updateEventContext =
    vi.fn(
      async () => undefined,
    );
  const twitch = {
    getStatus: vi.fn(
      () => options.status ?? ({
        state: 'none',
        channelUrl:
          'https://www.twitch.tv/mimi',
      }),
    ),
    getScheduleForNotifications:
      vi.fn(
        () => options.schedule ?? [],
      ),
  } as unknown as TwitchService;
  const notifications = {
    notifySubscribers,
    notifyUser,
  } as unknown as
    NotificationDispatchService;
  const deliveries = {
    listEventsByType: vi.fn(
      async () =>
        options.reminderEvents ?? [],
    ),
    listDeliveredUserUuids:
      vi.fn(
        async () =>
          options.deliveredUsers ?? [],
      ),
    updateEventContext,
  } as unknown as
    NotificationDeliveryService;
  const config = {
    get: vi.fn(
      () => 'Europe/Berlin',
    ),
  } as unknown as ConfigService;

  return {
    service:
      new StreamNotificationService(
        twitch,
        notifications,
        deliveries,
        config,
      ),
    notifySubscribers,
    notifyUser,
    updateEventContext,
  };
}

describe(
  'StreamNotificationService',
  () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it(
      'sends one retryable reminder inside the fifteen minute window',
      async () => {
        const schedule = [
          {
            id: 'segment-1',
            title: 'Musikabend',
            startsAt:
              '2026-09-28T18:10:00.000Z',
            endsAt:
              '2026-09-28T20:00:00.000Z',
            category: 'Music',
            cancelled: false,
          },
        ];
        const {
          service,
          notifySubscribers,
        } = createService({
          schedule,
        });

        await service.poll();

        expect(notifySubscribers)
          .toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'stream.reminder',
              eventKey:
                'stream.reminder:segment-1',
            }),
            {
              retryIfNotSent: true,
            },
          );
      },
    );

    it(
      'notifies only previously reminded users when the schedule changes materially',
      async () => {
        const {
          service,
          notifyUser,
          updateEventContext,
        } = createService({
          schedule: [
            {
              id: 'segment-1',
              title: 'Musikabend',
              startsAt:
                '2026-09-28T19:00:00.000Z',
              endsAt:
                '2026-09-28T21:00:00.000Z',
              category: 'Music',
              cancelled: false,
            },
          ],
          reminderEvents: [
            {
              key:
                'stream.reminder:segment-1',
              type: 'stream.reminder',
              context: {
                segmentId: 'segment-1',
                title: 'Musikabend',
                startsAt:
                  '2026-09-28T18:30:00.000Z',
              },
            },
          ],
          deliveredUsers: [
            'user-1',
          ],
        });

        await service.poll();

        expect(notifyUser)
          .toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
              type:
                'stream.schedule-changed',
            }),
          );
        expect(updateEventContext)
          .toHaveBeenCalledOnce();
      },
    );

    it(
      'does not send a live push to users who already received the scheduled reminder',
      async () => {
        const {
          service,
          notifySubscribers,
        } = createService({
          status: {
            state: 'live',
            title: 'Musikabend',
            category: 'Music',
            heroType: 'music',
            startedAt:
              '2026-09-28T18:00:00.000Z',
            channelUrl:
              'https://www.twitch.tv/mimi',
          },
          schedule: [
            {
              id: 'segment-1',
              title: 'Musikabend',
              startsAt:
                '2026-09-28T18:00:00.000Z',
              endsAt:
                '2026-09-28T20:00:00.000Z',
              category: 'Music',
              cancelled: false,
            },
          ],
          deliveredUsers: [
            'user-reminded',
          ],
        });

        await service.poll();

        expect(notifySubscribers)
          .toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'stream.live',
            }),
            expect.objectContaining({
              excludeUserUuids:
                new Set([
                  'user-reminded',
                ]),
            }),
          );
      },
    );
  },
);
