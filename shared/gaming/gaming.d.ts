import type { TwitchScheduledStream } from '../twitch/twitch-status';

export type GamingLocale = 'de' | 'en';

export interface SteamGameInfo {
  appId: number;
  name: string;
  shortDescription: string | null;
  headerImageUrl: string | null;
  capsuleImageUrl: string | null;
  genres: string[];
  developers: string[];
  publishers: string[];
  releaseDate: string | null;
  storeUrl: string;
}

export interface GamingNextStream {
  stream: TwitchScheduledStream | null;
  game: SteamGameInfo | null;
}
