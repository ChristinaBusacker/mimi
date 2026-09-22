import type {
  GamingLocale,
  GamingNextStream,
} from '@shared/gaming/gaming';

import {
  Injectable,
  Logger,
} from '@nestjs/common';

import { CacheService } from '../integrations/cache/cache.service';
import { SteamService } from '../integrations/steam/steam.service';
import { TwitchService } from '../integrations/twitch/twitch.service';

@Injectable()
export class GamingService {
  private static readonly CATEGORY_MAPPING_TTL_MS =
    30 * 24 * 60 * 60_000;

  private readonly logger = new Logger(GamingService.name);

  constructor(
    private readonly twitch: TwitchService,
    private readonly steam: SteamService,
    private readonly cache: CacheService,
  ) {}

  async getNextStream(
    locale: GamingLocale,
  ): Promise<GamingNextStream> {
    const stream =
      this.twitch.getNextScheduledStream('gaming');

    if (!stream?.category) {
      return {
        stream,
        game: null,
      };
    }

    try {
      const mapping =
        await this.cache.getOrRefresh(
          `gaming.steam-map.${stream.category.id}`,
          GamingService.CATEGORY_MAPPING_TTL_MS,
          () =>
            this.steam.findExactGameByName(
              stream.category!.name,
            ),
        );

      if (!mapping.value) {
        return {
          stream,
          game: null,
        };
      }

      return {
        stream,
        game: await this.steam.getGame(
          mapping.value,
          locale,
        ),
      };
    } catch (error: unknown) {
      this.logger.warn(
        `Could not enrich Twitch category "${stream.category.name}" with Steam: ${this.getErrorMessage(error)}`,
      );

      return {
        stream,
        game: null,
      };
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
