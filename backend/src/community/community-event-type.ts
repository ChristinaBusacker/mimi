import type {
  CommunityEventType,
} from '@shared/community/community-event';

interface CommunityEventTypeConfig {
  rewardRule: boolean;
  contentLength: boolean;
}

const COMMUNITY_EVENT_TYPE_REGISTRY = {
  'discord.message.activity': {
    rewardRule: true,
    contentLength: true,
  },
  'discord.membership.day': {
    rewardRule: true,
    contentLength: false,
  },
  'discord.event.attended': {
    rewardRule: true,
    contentLength: false,
  },
  'twitch.chat.activity': {
    rewardRule: true,
    contentLength: true,
  },
  'twitch.subscription.started': {
    rewardRule: true,
    contentLength: false,
  },
  'twitch.subscription.ended': {
    rewardRule: true,
    contentLength: false,
  },
  'twitch.subscription.resub': {
    rewardRule: true,
    contentLength: false,
  },
  'twitch.subscription.month': {
    rewardRule: true,
    contentLength: false,
  },
  'twitch.watch-streak': {
    rewardRule: true,
    contentLength: false,
  },
  'twitch.stream.check-in': {
    rewardRule: true,
    contentLength: false,
  },
  'blog.comment.created': {
    rewardRule: true,
    contentLength: true,
  },
  'blog.comment.featured': {
    rewardRule: true,
    contentLength: false,
  },
  'achievement.unlocked': {
    rewardRule: false,
    contentLength: false,
  },
} satisfies Record<
  CommunityEventType,
  CommunityEventTypeConfig
>;

export const COMMUNITY_EVENT_TYPES =
  (
    Object.entries(
      COMMUNITY_EVENT_TYPE_REGISTRY,
    ) as Array<[
      CommunityEventType,
      CommunityEventTypeConfig,
    ]>
  )
    .filter(
      ([, config]) =>
        config.rewardRule,
    )
    .map(([eventType]) => eventType);

export function isCommunityEventType(
  value: string,
): value is CommunityEventType {
  return Object.hasOwn(
    COMMUNITY_EVENT_TYPE_REGISTRY,
    value,
  );
}

export function isRewardRuleEventType(
  value: string,
): value is CommunityEventType {
  return (
    isCommunityEventType(value) &&
    COMMUNITY_EVENT_TYPE_REGISTRY[
      value
    ].rewardRule
  );
}

export function supportsContentLength(
  eventType: CommunityEventType,
): boolean {
  return COMMUNITY_EVENT_TYPE_REGISTRY[
    eventType
  ].contentLength;
}
