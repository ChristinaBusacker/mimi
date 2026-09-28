export interface PublishedBlogNotificationEvent {
  postUuid: string;
  slug: string;
  titleDe: string;
  titleEn: string;
}

export interface PublishedMusicNotificationEvent {
  kind: 'album' | 'track';
  uuid: string;
  slug: string;
  albumSlug: string | null;
  titleDe: string;
  titleEn: string;
}

export interface FeaturedCommentNotificationEvent {
  userUuid: string;
  commentUuid: string;
  postSlug: string;
}

export interface CommunityAchievementNotificationItem {
  uuid: string;
  nameDe: string;
  nameEn: string;
  hasAdditionalRewards: boolean;
}

export interface CommunityProgressNotificationEvent {
  userUuid: string;
  sourceEventUuid: string;
  achievements:
    CommunityAchievementNotificationItem[];
}

export interface NotificationInternalEventMap {
  'blog.published':
    PublishedBlogNotificationEvent;
  'music.published':
    PublishedMusicNotificationEvent;
  'blog.comment.featured':
    FeaturedCommentNotificationEvent;
  'community.progress.unlocked':
    CommunityProgressNotificationEvent;
}

export type NotificationInternalEventType =
  keyof NotificationInternalEventMap;

export type NotificationInternalEvent = {
  [TType in NotificationInternalEventType]: {
    type: TType;
    data:
      NotificationInternalEventMap[TType];
  };
}[NotificationInternalEventType];
