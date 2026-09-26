export type CommunityEventSource =
  | 'discord'
  | 'twitch'
  | 'website'
  | 'system';

export type CommunityEventType =
  | 'discord.message.activity'
  | 'discord.membership.day'
  | 'discord.event.attended'
  | 'twitch.chat.activity'
  | 'twitch.subscription.started'
  | 'twitch.subscription.ended'
  | 'twitch.subscription.resub'
  | 'twitch.subscription.month'
  | 'twitch.watch-streak'
  | 'twitch.stream.check-in'
  | 'blog.comment.created'
  | 'blog.comment.featured'
  | 'achievement.unlocked';

export interface CommunityEventRule {
  eventType: CommunityEventType;
  enabled: boolean;
  xpAmount: number;
  dailyRewardLimit: number | null;
  contextRewardLimit: number | null;
  cooldownSeconds: number | null;
  minimumContentLength: number | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveCommunityEventRule {
  enabled: boolean;
  xpAmount: number;
  dailyRewardLimit: number | null;
  contextRewardLimit: number | null;
  cooldownSeconds: number | null;
  minimumContentLength: number | null;
}
