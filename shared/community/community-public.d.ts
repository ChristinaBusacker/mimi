export interface CommunityDiscordSummary {
  configured: boolean;
  connected: boolean;
  guildName: string | null;
  memberCount: number | null;
  onlineCount: number | null;
  inviteUrl: string | null;
  updatedAt: string;
}

export interface CommunityPublicSummary {
  discord: CommunityDiscordSummary;
}
