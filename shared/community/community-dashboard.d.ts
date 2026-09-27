import type {
  CommunityLocalizedText,
  CommunityProfileCustomization,
} from './community-progression';

export type CommunityDashboardMembership =
  | 'not-connected'
  | 'not-member'
  | 'member';

export interface CommunityDashboardLevel {
  level: number;
  requiredXp: number;
}

export interface CommunityDashboardAchievement {
  id: string;
  key: string;
  name: CommunityLocalizedText;
  description: CommunityLocalizedText;
  badgeAssetId: string | null;
  unlockedProfileColor: string | null;
  unlocked: boolean;
  pinned: boolean;
}

export interface CommunityDashboardTitle {
  id: string;
  name: CommunityLocalizedText;
  description: CommunityLocalizedText;
  selected: boolean;
}

export interface CommunityDashboard {
  membership: CommunityDashboardMembership;
  discordDisplayName: string | null;
  memberSince: string | null;
  totalXp: number;
  level: CommunityDashboardLevel | null;
  nextLevel: CommunityDashboardLevel | null;
  progressPercent: number;
  achievements: CommunityDashboardAchievement[];
  titles: CommunityDashboardTitle[];
  customization: CommunityProfileCustomization | null;
}
