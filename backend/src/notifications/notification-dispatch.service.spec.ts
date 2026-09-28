import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { PushService } from '../push/push.service';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationPreferencesService } from './notification-preferences.service';

function createService(): {
  service: NotificationDispatchService;
  getRecipient: ReturnType<typeof vi.fn>;
  listRecipients: ReturnType<typeof vi.fn>;
  sendToUser: ReturnType<typeof vi.fn>;
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

  const preferences = {
    getRecipient,
    listRecipients,
  } as unknown as NotificationPreferencesService;
  const push = {
    sendToUser,
  } as unknown as PushService;

  return {
    service:
      new NotificationDispatchService(
        preferences,
        push,
      ),
    getRecipient,
    listRecipients,
    sendToUser,
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
  },
);
