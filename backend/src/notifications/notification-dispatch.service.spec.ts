import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { PushService } from '../push/push.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationPreferencesService } from './notification-preferences.service';

function createService(): {
  service: NotificationDispatchService;
  getRecipient: ReturnType<typeof vi.fn>;
  listRecipients: ReturnType<typeof vi.fn>;
  sendToUser: ReturnType<typeof vi.fn>;
  claim: ReturnType<typeof vi.fn>;
  complete: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  const getRecipient = vi.fn();
  const listRecipients = vi.fn();
  const sendToUser = vi.fn(
    async () => ({
      sent: 1,
      failed: 0,
      removed: 0,
    }),
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
    getRecipient,
    listRecipients,
  } as unknown as NotificationPreferencesService;
  const push = {
    sendToUser,
  } as unknown as PushService;
  const deliveries = {
    ensureEvent: vi.fn(
      async () => undefined,
    ),
    claim,
    complete,
    release,
  } as unknown as NotificationDeliveryService;

  return {
    service:
      new NotificationDispatchService(
        preferences,
        push,
        deliveries,
      ),
    getRecipient,
    listRecipients,
    sendToUser,
    claim,
    complete,
    release,
  };
}

describe(
  'NotificationDispatchService',
  () => {
    it(
      'does not send when the user did not opt in to the mapped category',
      async () => {
        const {
          service,
          getRecipient,
          sendToUser,
        } = createService();

        getRecipient.mockResolvedValue(
          null,
        );

        const result =
          await service.notifyUser(
            'user-1',
            {
              type: 'stream.live',
              content: {
                de: {
                  title: 'Live',
                  body: 'Deutsch',
                },
                en: {
                  title: 'Live',
                  body: 'English',
                },
              },
            },
          );

        expect(sendToUser)
          .not.toHaveBeenCalled();
        expect(result).toEqual({
          recipients: 0,
          skipped: 1,
          sent: 0,
          failed: 0,
          removed: 0,
        });
      },
    );

    it(
      'uses the saved locale and a shared tag for community progress',
      async () => {
        const {
          service,
          getRecipient,
          sendToUser,
        } = createService();

        getRecipient.mockResolvedValue({
          userUuid: 'user-1',
          locale: 'en',
        });

        await service.notifyUser(
          'user-1',
          {
            type:
              'community.level-reached',
            content: {
              de: {
                title: 'Neues Level',
                body: 'Level 10',
              },
              en: {
                title: 'New level',
                body: 'Level 10',
              },
            },
            url: '/community/dashboard',
          },
        );

        expect(sendToUser)
          .toHaveBeenCalledWith(
            'user-1',
            {
              title: 'New level',
              body: 'Level 10',
              url: '/community/dashboard',
              tag: 'community-progress',
            },
          );
      },
    );

    it(
      'localizes broadcast notifications for every opted-in recipient',
      async () => {
        const {
          service,
          listRecipients,
          sendToUser,
        } = createService();

        listRecipients.mockResolvedValue([
          {
            userUuid: 'user-de',
            locale: 'de',
          },
          {
            userUuid: 'user-en',
            locale: 'en',
          },
        ]);

        const result =
          await service.notifySubscribers({
            type: 'blog.published',
            content: {
              de: {
                title: 'Neuer Artikel',
                body: 'Deutsch',
              },
              en: {
                title: 'New article',
                body: 'English',
              },
            },
            url: '/blog',
          });

        expect(sendToUser)
          .toHaveBeenNthCalledWith(
            1,
            'user-de',
            expect.objectContaining({
              title: 'Neuer Artikel',
              body: 'Deutsch',
            }),
          );
        expect(sendToUser)
          .toHaveBeenNthCalledWith(
            2,
            'user-en',
            expect.objectContaining({
              title: 'New article',
              body: 'English',
            }),
          );
        expect(result).toEqual({
          recipients: 2,
          skipped: 0,
          sent: 2,
          failed: 0,
          removed: 0,
        });
      },
    );

    it(
      'skips a notification event that was already claimed for the user',
      async () => {
        const {
          service,
          getRecipient,
          sendToUser,
          claim,
        } = createService();

        getRecipient.mockResolvedValue({
          userUuid: 'user-1',
          locale: 'de',
        });
        claim.mockResolvedValue(false);

        const result =
          await service.notifyUser(
            'user-1',
            {
              type: 'stream.live',
              eventKey:
                'stream.live:2026-09-28T20:00:00Z',
              content: {
                de: {
                  title: 'Live',
                  body: 'Deutsch',
                },
                en: {
                  title: 'Live',
                  body: 'English',
                },
              },
            },
          );

        expect(sendToUser)
          .not.toHaveBeenCalled();
        expect(result.skipped)
          .toBe(1);
      },
    );

    it(
      'releases a retryable event when no browser received the push',
      async () => {
        const {
          service,
          getRecipient,
          sendToUser,
          complete,
          release,
        } = createService();

        getRecipient.mockResolvedValue({
          userUuid: 'user-1',
          locale: 'de',
        });
        sendToUser.mockResolvedValue({
          sent: 0,
          failed: 0,
          removed: 0,
        });

        await service.notifyUser(
          'user-1',
          {
            type: 'stream.reminder',
            eventKey:
              'stream.reminder:segment-1',
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
          },
          {
            retryIfNotSent: true,
          },
        );

        expect(release)
          .toHaveBeenCalledWith(
            'stream.reminder:segment-1',
            'user-1',
          );
        expect(complete)
          .not.toHaveBeenCalled();
      },
    );
  },
);
