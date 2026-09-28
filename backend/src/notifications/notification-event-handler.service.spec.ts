import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationEventHandlerService } from './notification-event-handler.service';
import { NotificationEventsService } from './notification-events.service';

const handlers: NotificationEventHandlerService[] = [];

function createHandler(): {
  events: NotificationEventsService;
  notifySubscribers: ReturnType<typeof vi.fn>;
  notifyUser: ReturnType<typeof vi.fn>;
} {
  const events =
    new NotificationEventsService();
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
  const notifications = {
    notifySubscribers,
    notifyUser,
  } as unknown as NotificationDispatchService;
  const handler =
    new NotificationEventHandlerService(
      events,
      notifications,
    );

  handler.onApplicationBootstrap();
  handlers.push(handler);

  return {
    events,
    notifySubscribers,
    notifyUser,
  };
}

async function flushEvents(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

afterEach(() => {
  for (const handler of handlers.splice(0)) {
    handler.onApplicationShutdown();
  }
});

describe(
  'NotificationEventHandlerService',
  () => {
    it(
      'maps a published blog post to one localized broadcast with a stable event key',
      async () => {
        const {
          events,
          notifySubscribers,
        } = createHandler();

        events.publish(
          'blog.published',
          {
            postUuid: 'post-1',
            slug: 'mein-artikel',
            titleDe: 'Mein Artikel',
            titleEn: 'My post',
          },
        );
        await flushEvents();

        expect(notifySubscribers)
          .toHaveBeenCalledOnce();
        expect(notifySubscribers)
          .toHaveBeenCalledWith({
            type: 'blog.published',
            eventKey:
              'blog.published:post-1',
            content: {
              de: {
                title:
                  'Neuer Blogartikel',
                body: 'Mein Artikel',
              },
              en: {
                title: 'New blog post',
                body: 'My post',
              },
            },
            url: '/blog/mein-artikel',
          });
      },
    );

    it(
      'uses album and track routes without producing duplicate delivery keys',
      async () => {
        const {
          events,
          notifySubscribers,
        } = createHandler();

        events.publish(
          'music.published',
          {
            kind: 'album',
            uuid: 'album-1',
            slug: 'erstes-album',
            albumSlug: null,
            titleDe: 'Erstes Album',
            titleEn: 'First album',
          },
        );
        events.publish(
          'music.published',
          {
            kind: 'track',
            uuid: 'track-1',
            slug: 'erster-song',
            albumSlug: 'erstes-album',
            titleDe: 'Erster Song',
            titleEn: 'First song',
          },
        );
        await flushEvents();

        expect(notifySubscribers)
          .toHaveBeenCalledTimes(2);
        expect(notifySubscribers)
          .toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
              eventKey:
                'music.published:album:album-1',
              url:
                '/music/albums/erstes-album',
            }),
          );
        expect(notifySubscribers)
          .toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
              eventKey:
                'music.published:track:track-1',
              url:
                '/music/albums/erstes-album',
            }),
          );
      },
    );

    it(
      'targets a featured-comment notification only at the comment author',
      async () => {
        const {
          events,
          notifyUser,
        } = createHandler();

        events.publish(
          'blog.comment.featured',
          {
            userUuid: 'user-1',
            commentUuid: 'comment-1',
            postSlug: 'mein-artikel',
          },
        );
        await flushEvents();

        expect(notifyUser)
          .toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
              type:
                'blog.comment-featured',
              eventKey:
                'blog.comment.featured:comment-1',
              url: '/blog/mein-artikel',
            }),
          );
      },
    );

    it(
      'bundles multiple unlocked achievements into one personal notification',
      async () => {
        const {
          events,
          notifyUser,
        } = createHandler();

        events.publish(
          'community.progress.unlocked',
          {
            userUuid: 'user-1',
            sourceEventUuid:
              'community-event-1',
            achievements: [
              {
                uuid: 'achievement-1',
                nameDe: 'Ein Jahr dabei',
                nameEn: 'One year together',
                hasAdditionalRewards: true,
              },
              {
                uuid: 'achievement-2',
                nameDe: 'Aktiv',
                nameEn: 'Active',
                hasAdditionalRewards: false,
              },
            ],
          },
        );
        await flushEvents();

        expect(notifyUser)
          .toHaveBeenCalledOnce();
        expect(notifyUser)
          .toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
              type:
                'community.achievement-unlocked',
              eventKey:
                'community.progress:community-event-1',
              content: expect.objectContaining({
                de: expect.objectContaining({
                  title:
                    '2 Achievements freigeschaltet',
                }),
              }),
            }),
          );
      },
    );

    it(
      'does not dispatch an empty community progress event',
      async () => {
        const {
          events,
          notifyUser,
        } = createHandler();

        events.publish(
          'community.progress.unlocked',
          {
            userUuid: 'user-1',
            sourceEventUuid:
              'community-event-empty',
            achievements: [],
          },
        );
        await flushEvents();

        expect(notifyUser)
          .not.toHaveBeenCalled();
      },
    );
  },
);
