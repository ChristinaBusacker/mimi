import type {
  CommunityAchievementMetric,
} from '@shared/community/community-progression';

interface CommunityAchievementMetricConfig {
  requiresEventType: boolean;
}

const COMMUNITY_ACHIEVEMENT_METRIC_REGISTRY = {
  'total-xp': {
    requiresEventType: false,
  },
  'event-count': {
    requiresEventType: true,
  },
  'distinct-event-days': {
    requiresEventType: true,
  },
  'discord-membership-current-days': {
    requiresEventType: false,
  },
  'discord-membership-total-days': {
    requiresEventType: false,
  },
  'twitch-subscription-months': {
    requiresEventType: false,
  },
  'twitch-watch-streak': {
    requiresEventType: false,
  },
} satisfies Record<
  CommunityAchievementMetric,
  CommunityAchievementMetricConfig
>;


export function getCommunityAchievementMetrics():
  CommunityAchievementMetric[] {
  return Object.keys(
    COMMUNITY_ACHIEVEMENT_METRIC_REGISTRY,
  ) as CommunityAchievementMetric[];
}

export function isCommunityAchievementMetric(
  value: string,
): value is CommunityAchievementMetric {
  return Object.hasOwn(
    COMMUNITY_ACHIEVEMENT_METRIC_REGISTRY,
    value,
  );
}

export function achievementMetricRequiresEventType(
  metric: CommunityAchievementMetric,
): boolean {
  return COMMUNITY_ACHIEVEMENT_METRIC_REGISTRY[
    metric
  ].requiresEventType;
}
