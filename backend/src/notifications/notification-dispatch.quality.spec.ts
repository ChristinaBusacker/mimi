import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { PushService } from '../push/push.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import {
  NotificationDispatchService,
  type NotificationDispatchInput,
} from './notification-dispatch.service';
import { NotificationPreferencesService } from './notification-preferences.service';

function createService(): {
  service: NotificationDispatchService;
  sendToUser: ReturnType<typeof vi.fn>;
  ensureEvent: ReturnType<typeof vi.fn>;
  claim: ReturnType<typeof vi.fn>;
  complete: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  const sendToUser = vi.fn(
    async () => ({
      sent: 1,
      failed: 0,
      removed: 0,
    }),
  );
  const ensureEvent = vi.fn(
    async () => undefined,
  );
  const claim = vi.fn(
    async () => true,
  );
  const complete = vi.fn(
    async () => undefined,
  );
  const release = vi.fn(
    async () => undefined,
  );
  const preferences = {
    getRecipient: vi.fn(
      async () => ({
        userUuid: 'user-1',
        locale: 'de',
      }),
    ),
    listRecipients: vi.fn(
      async () => [],
    ),
  } as unknown as NotificationPreferencesService;
  const push = {
    sendToUser,
  } as unknown as PushService;
  const deliveries = {
    ensureEvent,
    claim,
    complete,
    release,
  } as unknown as NotificationDeliveryService;

  return {
    service: new NotificationDispatchService(
      preferences,
      push,
      deliveries,
    ),
    sendToUser,
    ensureEvent,
    claim,
    complete,
    release,
  };
}

const INPUT: NotificationDispatchInput = {
  type: 'stream.reminder',
  eventKey: 'stream.reminder:segment-1',
  content: {
    de: {
      title: 'Bald live',
      body: 'Deutsch',
    },
    en: {
      title: 'Live soon',
      body: 'English',
    },
  },
};

describe(
  'NotificationDispatchService quality gate',
  () => {
    it(
      'releases a claimed event when push delivery throws so it can be retried',
      async () => {
        const {
          service,
          sendToUser,
          complete,
          release,
        } = createService();

        sendToUser.mockRejectedValue(
          new Error('push failed'),
        );

        await expect(
          service.notifyUser(
            'user-1',
            INPUT,
            {
              retryIfNotSent: true,
            },
          ),
        ).rejects.toThrow('push failed');
        expect(release).toHaveBeenCalledWith(
          INPUT.eventKey,
          'user-1',
        );
        expect(complete).not.toHaveBeenCalled();
      },
    );

    it(
      'completes a non-retryable event even when no browser received it',
      async () => {
        const {
          service,
          sendToUser,
          complete,
          release,
        } = createService();

        sendToUser.mockResolvedValue({
          sent: 0,
          failed: 0,
          removed: 0,
        });

        await service.notifyUser(
          'user-1',
          INPUT,
        );

        expect(complete).toHaveBeenCalledWith(
          INPUT.eventKey,
          'user-1',
          false,
        );
        expect(release).not.toHaveBeenCalled();
      },
    );

    it(
      'does not create or claim an event for a user excluded from delivery',
      async () => {
        const {
          service,
          sendToUser,
          ensureEvent,
          claim,
        } = createService();

        const result =
          await service.notifyUser(
            'user-1',
            INPUT,
            {
              excludeUserUuids:
                new Set(['user-1']),
            },
          );

        expect(result.skipped).toBe(1);
        expect(ensureEvent)
          .not.toHaveBeenCalled();
        expect(claim).not.toHaveBeenCalled();
        expect(sendToUser)
          .not.toHaveBeenCalled();
      },
    );
  },
);
