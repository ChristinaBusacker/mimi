import type {
  CommunityEventType,
} from '@shared/community/community-event';

const COMMUNITY_EVENT_TYPE_REGISTRY = {
  'discord.message.activity': true,
  'discord.membership.day': true,
  'discord.event.attended': true,
  'twitch.chat.activity': true,
  'twitch.subscription.started': true,
  'twitch.subscription.ended': true,
  'twitch.subscription.resub': true,
  'twitch.watch-streak': true,
  'twitch.stream.check-in': true,
  'blog.comment.created': true,
  'blog.comment.featured': true,
} satisfies Record<
  CommunityEventType,
  true
>;

export const COMMUNITY_EVENT_TYPES =
  Object.keys(
    COMMUNITY_EVENT_TYPE_REGISTRY,
  ) as CommunityEventType[];

const CONTENT_LENGTH_EVENT_TYPES =
  new Set<CommunityEventType>([
    'discord.message.activity',
    'twitch.chat.activity',
    'blog.comment.created',
  ]);

export function isCommunityEventType(
  value: string,
): value is CommunityEventType {
  return Object.hasOwn(
    COMMUNITY_EVENT_TYPE_REGISTRY,
    value,
  );
}

export function supportsContentLength(
  eventType: CommunityEventType,
): boolean {
  return CONTENT_LENGTH_EVENT_TYPES.has(
    eventType,
  );
}
