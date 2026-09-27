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
