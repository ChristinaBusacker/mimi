import type {
  CommunityDiscordRoleKind,
} from './community-discord';
import type {
  CommunityEventType,
  SaveCommunityEventRule,
} from './community-event';
import type {
  CommunityAchievementConditionMode,
  CommunityAchievementMetric,
  CommunityAchievementOperator,
  CommunityLocalizedText,
} from './community-progression';

export interface CommunityEventRuleTransferEntry
  extends SaveCommunityEventRule {
  eventType: CommunityEventType;
}

export interface CommunityTitleTransferEntry {
  key: string;
  enabled: boolean;
  name: CommunityLocalizedText;
  description: CommunityLocalizedText;
}

export interface CommunityAchievementConditionTransferEntry {
  metric: CommunityAchievementMetric;
  operator: CommunityAchievementOperator;
  threshold: number;
  eventType: CommunityEventType | null;
}

export interface CommunityAchievementTransferEntry {
  key: string;
  enabled: boolean;
  name: CommunityLocalizedText;
  description: CommunityLocalizedText;
  conditionMode: CommunityAchievementConditionMode;
  conditions: CommunityAchievementConditionTransferEntry[];
  xpReward: number;
  unlockedTitleKey: string | null;
  unlockedProfileColor: string | null;
  sortOrder: number;
}

export interface CommunityDiscordRoleTransferEntry {
  key: string;
  kind: CommunityDiscordRoleKind;
  name: string;
  color: string | null;
  enabled: boolean;
  achievementKey: string | null;
  minimumLevel: number | null;
  maximumLevel: number | null;
  sortOrder: number;
}

export interface CommunitySettingsTransferData {
  eventRules: CommunityEventRuleTransferEntry[];
  levels: number[];
  titles: CommunityTitleTransferEntry[];
  achievements: CommunityAchievementTransferEntry[];
  discordRoles: CommunityDiscordRoleTransferEntry[];
}
