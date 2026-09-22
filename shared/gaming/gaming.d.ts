import type { TwitchScheduledStream } from '../twitch/twitch-status';

export type GamingLocale = 'de' | 'en';

export interface SteamScreenshot {
  thumbnailUrl: string;
  fullSizeUrl: string;
}

export interface SteamGameInfo {
  appId: number;
  name: string;
  shortDescription: string | null;
  headerImageUrl: string | null;
  capsuleImageUrl: string | null;
  screenshots: SteamScreenshot[];
  genres: string[];
  categories: string[];
  developers: string[];
  publishers: string[];
  releaseDate: string | null;
  websiteUrl: string | null;
  storeUrl: string;
}

export interface GamingNextStream {
  stream: TwitchScheduledStream | null;
  game: SteamGameInfo | null;
}
