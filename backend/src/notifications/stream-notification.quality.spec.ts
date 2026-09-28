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
  const updateEventContext = vi.fn(
    async () => undefined,
  );
  const twitch = {
    getStatus: vi.fn(
      () => ({
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
  } as unknown as NotificationDispatchService;
  const deliveries = {
    listEventsByType: vi.fn(
      async () =>
        options.reminderEvents ?? [],
    ),
    listDeliveredUserUuids: vi.fn(
      async () =>
        options.deliveredUsers ?? [],
    ),
    updateEventContext,
  } as unknown as NotificationDeliveryService;
  const config = {
    get: vi.fn(
      () => 'Europe/Berlin',
    ),
  } as unknown as ConfigService;

  return {
    service: new StreamNotificationService(
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
  'StreamNotificationService quality gate',
  () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it(
      'does not send an early reminder outside the fifteen minute window',
      async () => {
        const {
          service,
          notifySubscribers,
        } = createService({
          schedule: [
            {
              id: 'segment-1',
              title: 'Musikabend',
              startsAt:
                '2026-09-28T18:16:00.000Z',
              endsAt:
                '2026-09-28T20:00:00.000Z',
              category: 'Music',
              cancelled: false,
            },
          ],
        });

        await service.poll();

        expect(notifySubscribers)
          .not.toHaveBeenCalled();
      },
    );

    it(
      'updates reminder context without notifying for a schedule shift below five minutes',
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
                '2026-09-28T18:34:00.000Z',
              endsAt:
                '2026-09-28T20:00:00.000Z',
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
          .not.toHaveBeenCalled();
        expect(updateEventContext)
          .toHaveBeenCalledWith(
            'stream.reminder:segment-1',
            expect.objectContaining({
              startsAt:
                '2026-09-28T18:34:00.000Z',
            }),
          );
      },
    );

    it(
      'sends a cancellation only to users who previously received the reminder',
      async () => {
        const {
          service,
          notifyUser,
        } = createService({
          schedule: [
            {
              id: 'segment-1',
              title: 'Musikabend',
              startsAt:
                '2026-09-28T18:30:00.000Z',
              endsAt:
                '2026-09-28T20:00:00.000Z',
              category: 'Music',
              cancelled: true,
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
            'user-2',
          ],
        });

        await service.poll();

        expect(notifyUser)
          .toHaveBeenCalledTimes(2);
        expect(notifyUser)
          .toHaveBeenNthCalledWith(
            1,
            'user-1',
            expect.objectContaining({
              type: 'stream.cancelled',
              eventKey:
                'stream.cancelled:segment-1:2026-09-28T18:30:00.000Z',
            }),
          );
        expect(notifyUser)
          .toHaveBeenNthCalledWith(
            2,
            'user-2',
            expect.objectContaining({
              type: 'stream.cancelled',
            }),
          );
      },
    );

    it(
      'does not announce a cancellation after the remembered start time has passed',
      async () => {
        const {
          service,
          notifyUser,
        } = createService({
          schedule: [],
          reminderEvents: [
            {
              key:
                'stream.reminder:segment-1',
              type: 'stream.reminder',
              context: {
                segmentId: 'segment-1',
                title: 'Musikabend',
                startsAt:
                  '2026-09-28T17:30:00.000Z',
              },
            },
          ],
          deliveredUsers: [
            'user-1',
          ],
        });

        await service.poll();

        expect(notifyUser)
          .not.toHaveBeenCalled();
      },
    );
  },
);
