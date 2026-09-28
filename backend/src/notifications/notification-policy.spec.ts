import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  defaultNotificationTagFor,
  notificationPreferenceGroupFor,
} from './notification-policy';

describe(
  'notification policy',
  () => {
    it(
      'maps detailed notification types to compact user preference groups',
      () => {
        expect(
          notificationPreferenceGroupFor(
            'stream.live',
          ),
        ).toBe('streams');
        expect(
          notificationPreferenceGroupFor(
            'music.published',
          ),
        ).toBe('music');
        expect(
          notificationPreferenceGroupFor(
            'blog.published',
          ),
        ).toBe('blog');
        expect(
          notificationPreferenceGroupFor(
            'community.level-reached',
          ),
        ).toBe('personal');
      },
    );

    it(
      'collapses community progress notifications under one stable tag',
      () => {
        expect(
          defaultNotificationTagFor(
            'community.achievement-unlocked',
          ),
        ).toBe('community-progress');
        expect(
          defaultNotificationTagFor(
            'community.role-unlocked',
          ),
        ).toBe('community-progress');
        expect(
          defaultNotificationTagFor(
            'blog.comment-featured',
          ),
        ).toBeUndefined();
      },
    );
  },
);
