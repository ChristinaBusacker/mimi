import type {
  NotificationPreferenceGroup,
  NotificationType,
} from '@shared/notifications/notifications';

const GROUP_BY_TYPE = {
  'stream.reminder': 'streams',
  'stream.live': 'streams',
  'stream.schedule-changed': 'streams',
  'stream.cancelled': 'streams',
  'blog.published': 'blog',
  'music.published': 'music',
  'community.achievement-unlocked':
    'personal',
  'community.level-reached':
    'personal',
  'community.title-unlocked':
    'personal',
  'community.role-unlocked':
    'personal',
  'blog.comment-featured':
    'personal',
} satisfies Record<
  NotificationType,
  NotificationPreferenceGroup
>;

const COMMUNITY_PROGRESS_TYPES =
  new Set<NotificationType>([
    'community.achievement-unlocked',
    'community.level-reached',
    'community.title-unlocked',
    'community.role-unlocked',
  ]);

export function notificationPreferenceGroupFor(
  type: NotificationType,
): NotificationPreferenceGroup {
  return GROUP_BY_TYPE[type];
}

export function defaultNotificationTagFor(
  type: NotificationType,
): string | undefined {
  return COMMUNITY_PROGRESS_TYPES.has(
    type,
  )
    ? 'community-progress'
    : undefined;
}
