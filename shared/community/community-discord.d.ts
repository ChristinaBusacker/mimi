export type CommunityDiscordRoleKind =
  | 'level-range'
  | 'showcase'
  | 'special';

export interface CommunityDiscordRoleOption {
  id: string;
  name: string;
  color: string | null;
  position: number;
}

export interface CommunityDiscordRoleCatalog {
  configured: boolean;
  connected: boolean;
  roles: CommunityDiscordRoleOption[];
}

export interface CommunityDiscordRoleDefinition {
  id: string;
  key: string;
  kind: CommunityDiscordRoleKind;
  name: string;
  color: string | null;
  enabled: boolean;
  discordRoleId: string | null;
  provisionedByCommunity: boolean;
  achievementId: string | null;
  minimumLevel: number | null;
  maximumLevel: number | null;
  sortOrder: number;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveCommunityDiscordRoleDefinition {
  kind: CommunityDiscordRoleKind;
  name: string;
  color: string | null;
  enabled: boolean;
  achievementId: string | null;
  minimumLevel: number | null;
  maximumLevel: number | null;
  sortOrder: number;
}
