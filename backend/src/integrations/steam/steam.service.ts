import type { GamingLocale, SteamGameInfo } from '@shared/gaming/gaming';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

import { CacheService } from '../cache/cache.service';
import {
  createFallbackSteamGame,
  type SteamAppListResponse,
  type SteamAppMatch,
  type SteamStoreAppDetailsResponse,
  steamStoreLanguage,
} from './steam.types';

@Injectable()
export class SteamService {
  private static readonly APP_MATCH_TTL_MS = 30 * 24 * 60 * 60_000;

  private static readonly GAME_DETAILS_TTL_MS = 24 * 60 * 60_000;

  private readonly logger = new Logger(SteamService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly cache: CacheService,
  ) {}

  async findExactGameByName(name: string): Promise<SteamAppMatch | null> {
    const normalizedName = this.normalizeName(name);

    if (!normalizedName) {
      return null;
    }

    const cacheKey = this.createMatchCacheKey(normalizedName);

    const cached = await this.cache.getOrRefresh<SteamAppMatch | null>(
      cacheKey,
      SteamService.APP_MATCH_TTL_MS,
      () => this.findExactGameByNameFromSteam(normalizedName),
    );

    return cached.value;
  }

  async getGame(match: SteamAppMatch, locale: GamingLocale): Promise<SteamGameInfo> {
    const cacheKey = `steam.game.v2.${match.appId}.${locale}`;

    try {
      const cached = await this.cache.getOrRefresh<SteamGameInfo>(
        cacheKey,
        SteamService.GAME_DETAILS_TTL_MS,
        () => this.loadStoreGame(match, locale),
      );

      return cached.value;
    } catch (error: unknown) {
      this.logger.warn(
        `Could not load Steam details for app ${match.appId}: ${this.getErrorMessage(error)}`,
      );

      return createFallbackSteamGame(match);
    }
  }

  private async findExactGameByNameFromSteam(
    normalizedName: string,
  ): Promise<SteamAppMatch | null> {
    const apiKey = this.getApiKey();
    const matches: SteamAppMatch[] = [];
    let lastAppId: number | undefined;

    do {
      const input: Record<string, boolean | number> = {
        include_games: true,
        include_dlc: false,
        include_software: false,
        include_videos: false,
        include_hardware: false,
        max_results: 50_000,
      };

      if (lastAppId !== undefined) {
        input['last_appid'] = lastAppId;
      }

      const url = new URL('https://api.steampowered.com/IStoreService/GetAppList/v1/');

      url.searchParams.set('key', apiKey);
      url.searchParams.set('input_json', JSON.stringify(input));

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Steam app list returned ${response.status}.`);
      }

      const result = (await response.json()) as SteamAppListResponse;
      const apps = result.response.apps ?? [];

      for (const app of apps) {
        if (this.normalizeName(app.name) !== normalizedName) {
          continue;
        }

        matches.push({
          appId: app.appid,
          name: app.name,
        });

        if (matches.length > 1) {
          return null;
        }
      }

      if (!result.response.have_more_results) {
        break;
      }

      const nextLastAppId = result.response.last_appid ?? apps.at(-1)?.appid;

      if (nextLastAppId === undefined || nextLastAppId === lastAppId) {
        break;
      }

      lastAppId = nextLastAppId;
    } while (true);

    return matches[0] ?? null;
  }

  private async loadStoreGame(match: SteamAppMatch, locale: GamingLocale): Promise<SteamGameInfo> {
    // Steam does not document a rich public game-details
    // Web API. Keep the Store endpoint isolated here and
    // treat it as best-effort enrichment.
    const url = new URL('https://store.steampowered.com/api/appdetails');

    url.searchParams.set('appids', String(match.appId));
    url.searchParams.set('l', steamStoreLanguage(locale));

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Steam Store details returned ${response.status}.`);
    }

    const result = (await response.json()) as SteamStoreAppDetailsResponse;
    const app = result[String(match.appId)];

    if (!app?.success || !app.data) {
      return createFallbackSteamGame(match);
    }

    return {
      appId: match.appId,
      name: app.data.name || match.name,
      shortDescription: app.data.short_description?.trim() || null,
      headerImageUrl: app.data.header_image ?? null,
      capsuleImageUrl: app.data.capsule_image ?? null,
      screenshots:
        app.data.screenshots?.map((screenshot) => ({
          thumbnailUrl: screenshot.path_thumbnail,
          fullSizeUrl: screenshot.path_full,
        })) ?? [],
      genres: app.data.genres?.map((genre) => genre.description) ?? [],
      categories: app.data.categories?.map((category) => category.description) ?? [],
      developers: app.data.developers ?? [],
      publishers: app.data.publishers ?? [],
      releaseDate: app.data.release_date?.date || null,
      websiteUrl: app.data.website?.trim() || null,
      storeUrl: `https://store.steampowered.com/app/${match.appId}/`,
    };
  }

  private createMatchCacheKey(normalizedName: string): string {
    const hash = createHash('sha256').update(normalizedName).digest('hex').slice(0, 24);

    return `steam.match.${hash}`;
  }

  private normalizeName(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private getApiKey(): string {
    const apiKey = this.configService.get<string>('STEAM_WEB_API_KEY')?.trim();

    if (!apiKey) {
      throw new Error('STEAM_WEB_API_KEY is not configured.');
    }

    return apiKey;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
