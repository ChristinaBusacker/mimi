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

export interface CommunityDashboardTwitchConnection {
  configured: boolean;
  connected: boolean;
  login: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  linkedAt: string | null;
}

export interface CommunityDashboardTitle {
  id: string;
  name: CommunityLocalizedText;
  description: CommunityLocalizedText;
  selected: boolean;
}

export interface CommunityDashboardDiscordShowcaseRole {
  id: string;
  name: string;
  color: string | null;
  achievementId: string;
  unlocked: boolean;
  selected: boolean;
  availableOnDiscord: boolean;
}

export interface CommunityDashboard {
  membership: CommunityDashboardMembership;
  discordDisplayName: string | null;
  memberSince: string | null;
  twitch: CommunityDashboardTwitchConnection;
  totalXp: number;
  level: CommunityDashboardLevel | null;
  nextLevel: CommunityDashboardLevel | null;
  progressPercent: number;
  achievements: CommunityDashboardAchievement[];
  titles: CommunityDashboardTitle[];
  discordShowcaseRoles: CommunityDashboardDiscordShowcaseRole[];
  selectedDiscordShowcaseRoleId: string | null;
  customization: CommunityProfileCustomization | null;
}
