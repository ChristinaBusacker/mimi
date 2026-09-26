import type {
  CommunityEventType,
} from './community-event';

export type CommunityAchievementConditionMode =
  | 'all'
  | 'any';

export type CommunityAchievementMetric =
  | 'total-xp'
  | 'event-count'
  | 'distinct-event-days'
  | 'discord-membership-current-days'
  | 'discord-membership-total-days'
  | 'twitch-subscription-months'
  | 'twitch-watch-streak';

export type CommunityAchievementOperator =
  'gte';

export interface CommunityLocalizedText {
  de: string;
  en: string | null;
}

export interface CommunityLevelDefinition {
  level: number;
  enabled: boolean;
  requiredXp: number;
  name: CommunityLocalizedText;
  displayColor: string | null;
  discordRoleId: string | null;
  badgeAssetId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveCommunityLevelDefinition {
  enabled: boolean;
  requiredXp: number;
  name: CommunityLocalizedText;
  displayColor: string | null;
  discordRoleId: string | null;
  badgeAssetId: string | null;
}

export interface CommunityTitleDefinition {
  id: string;
  key: string;
  enabled: boolean;
  name: CommunityLocalizedText;
  description: CommunityLocalizedText;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveCommunityTitleDefinition {
  enabled: boolean;
  name: CommunityLocalizedText;
  description: CommunityLocalizedText;
}

export interface CommunityAchievementCondition {
  id: string;
  metric: CommunityAchievementMetric;
  operator: CommunityAchievementOperator;
  threshold: number;
  eventType: CommunityEventType | null;
  sortOrder: number;
}

export interface SaveCommunityAchievementCondition {
  metric: CommunityAchievementMetric;
  operator: CommunityAchievementOperator;
  threshold: number;
  eventType: CommunityEventType | null;
}

export interface CommunityAchievementDefinition {
  id: string;
  key: string;
  enabled: boolean;
  name: CommunityLocalizedText;
  description: CommunityLocalizedText;
  badgeAssetId: string | null;
  conditionMode:
    CommunityAchievementConditionMode;
  conditions:
    CommunityAchievementCondition[];
  xpReward: number;
  unlockedTitleId: string | null;
  discordRoleId: string | null;
  sortOrder: number;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveCommunityAchievementDefinition {
  enabled: boolean;
  name: CommunityLocalizedText;
  description: CommunityLocalizedText;
  badgeAssetId: string | null;
  conditionMode:
    CommunityAchievementConditionMode;
  conditions:
    SaveCommunityAchievementCondition[];
  xpReward: number;
  unlockedTitleId: string | null;
  discordRoleId: string | null;
  sortOrder: number;
}

export interface CommunityProgressionSnapshot {
  totalXp: number;
  level:
    CommunityLevelDefinition | null;
  selectedTitleId: string | null;
  unlockedTitleIds: string[];
  unlockedAchievementIds: string[];
}
