import type {
  GamingLocale,
  SteamGameInfo,
} from '@shared/gaming/gaming';

export interface SteamAppMatch {
  appId: number;
  name: string;
}

export interface SteamAppListItem {
  appid: number;
  name: string;
}

export interface SteamAppListResponse {
  response: {
    apps?: SteamAppListItem[];
    have_more_results?: boolean;
    last_appid?: number;
  };
}

export interface SteamStoreAppDetails {
  name: string;
  short_description?: string;
  header_image?: string;
  capsule_image?: string;
  website?: string;
  developers?: string[];
  publishers?: string[];
  genres?: Array<{
    id: string;
    description: string;
  }>;
  categories?: Array<{
    id: number;
    description: string;
  }>;
  screenshots?: Array<{
    id: number;
    path_thumbnail: string;
    path_full: string;
  }>;
  release_date?: {
    coming_soon: boolean;
    date: string;
  };
}

export type SteamStoreAppDetailsResponse = Record<
  string,
  {
    success: boolean;
    data?: SteamStoreAppDetails;
  }
>;

export function createFallbackSteamGame(
  match: SteamAppMatch,
): SteamGameInfo {
  return {
    appId: match.appId,
    name: match.name,
    shortDescription: null,
    headerImageUrl: null,
    capsuleImageUrl: null,
    screenshots: [],
    genres: [],
    categories: [],
    developers: [],
    publishers: [],
    releaseDate: null,
    websiteUrl: null,
    storeUrl: `https://store.steampowered.com/app/${match.appId}/`,
  };
}

export function steamStoreLanguage(
  locale: GamingLocale,
): string {
  return locale === 'de' ? 'german' : 'english';
}
