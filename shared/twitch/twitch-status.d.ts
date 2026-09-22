export type HeroType = 'music' | 'chatting' | 'gaming';

export type TwitchStatus =
  TwitchLiveStatus | TwitchUpcomingStatus | TwitchOfflineStatus;

export interface TwitchCategory {
  id: string;
  name: string;
}

export interface TwitchScheduledStream {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  category: TwitchCategory | null;
  heroType: HeroType | null;
  channelUrl: string;
}

export interface TwitchLiveStatus {
  state: 'live';
  title: string;
  category: string | null;
  heroType: HeroType | null;
  startedAt: string;
  channelUrl: string;
}

export interface TwitchUpcomingStatus {
  state: 'upcoming';
  title: string;
  category: string | null;
  heroType: HeroType | null;
  startsAt: string;
  channelUrl: string;
}

export interface TwitchOfflineStatus {
  state: 'none';
  channelUrl: string;
}
