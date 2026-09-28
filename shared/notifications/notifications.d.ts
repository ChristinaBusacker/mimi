export type NotificationLocale = 'de' | 'en';

export type NotificationPreferenceGroup =
  | 'streams'
  | 'music'
  | 'blog'
  | 'personal';

export type NotificationType =
  | 'stream.reminder'
  | 'stream.live'
  | 'stream.schedule-changed'
  | 'stream.cancelled'
  | 'blog.published'
  | 'music.published'
  | 'community.achievement-unlocked'
  | 'community.level-reached'
  | 'community.title-unlocked'
  | 'community.role-unlocked'
  | 'blog.comment-featured';

export interface NotificationPreferenceSelection {
  streams: boolean;
  music: boolean;
  blog: boolean;
  personal: boolean;
}

export interface NotificationPreferences
  extends NotificationPreferenceSelection {
  locale: NotificationLocale;
}

export interface UpdateNotificationPreferences
  extends NotificationPreferences {}
