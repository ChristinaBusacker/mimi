import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

import { CacheService } from '../cache/cache.service';
import { EventsService } from '../events/events.service';
import type { HeroType, TwitchStatus } from '@shared/twitch/twitch-status';

interface TwitchAppToken {
  value: string;
  expiresAt: number;
}

interface TwitchUserResponse {
  data: Array<{
    id: string;
    login: string;
    display_name: string;
  }>;
}

interface TwitchStream {
  id: string;
  title: string;
  game_id: string;
  game_name: string;
  started_at: string;
}

interface TwitchStreamsResponse {
  data: TwitchStream[];
}

interface TwitchScheduleSegment {
  id: string;
  start_time: string;
  end_time: string;
  title: string;

  canceled_until: string | null;

  category: {
    id: string;
    name: string;
  } | null;
}

interface TwitchScheduleResponse {
  data: {
    segments: TwitchScheduleSegment[];
  };
}

@Injectable()
export class TwitchService implements OnApplicationBootstrap {
  private static readonly LIVE_CACHE_KEY = 'twitch.live';

  private static readonly SCHEDULE_CACHE_KEY = 'twitch.schedule';

  private readonly logger = new Logger(TwitchService.name);

  private token?: TwitchAppToken;

  private broadcasterId?: string;

  private live: TwitchStream | null = null;

  private schedule: TwitchScheduleSegment[] = [];

  private previousStatus?: string;

  constructor(
    private readonly configService: ConfigService,

    private readonly cache: CacheService,

    private readonly events: EventsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.restoreCache();

    this.previousStatus = JSON.stringify(this.getStatus());

    await Promise.allSettled([this.refreshLive(), this.refreshSchedule()]);
  }

  getStatus(): TwitchStatus {
    const channelLogin = this.configService.getOrThrow<string>('TWITCH_CHANNEL_LOGIN');

    const channelUrl = `https://www.twitch.tv/${channelLogin}`;

    if (this.live) {
      const category = this.live.game_name || null;

      return {
        state: 'live',

        title: this.live.title,

        category,

        heroType: this.mapHeroType(category),

        startedAt: this.live.started_at,

        channelUrl,
      };
    }

    const now = Date.now();

    const next = this.schedule
      .filter((segment) => segment.canceled_until === null && Date.parse(segment.start_time) > now)
      .sort((left, right) => Date.parse(left.start_time) - Date.parse(right.start_time))[0];

    if (!next) {
      return {
        state: 'none',
        channelUrl,
      };
    }

    const category = next.category?.name ?? null;

    return {
      state: 'upcoming',

      title: next.title,

      category,

      heroType: this.mapHeroType(category),

      startsAt: next.start_time,

      channelUrl,
    };
  }

  @Interval(20_000)
  async pollLive(): Promise<void> {
    await this.refreshLive();
  }

  @Interval(5 * 60_000)
  async pollSchedule(): Promise<void> {
    await this.refreshSchedule();
  }

  private async restoreCache(): Promise<void> {
    const [live, schedule] = await Promise.all([
      this.cache.get<TwitchStream | null>(TwitchService.LIVE_CACHE_KEY),

      this.cache.get<TwitchScheduleSegment[]>(TwitchService.SCHEDULE_CACHE_KEY),
    ]);

    if (live) {
      this.live = live.value;
    }

    if (schedule) {
      this.schedule = schedule.value;
    }
  }

  private async refreshLive(): Promise<void> {
    try {
      const broadcasterId = await this.getBroadcasterId();

      const response = await this.twitchRequest<TwitchStreamsResponse>('/streams', {
        user_id: broadcasterId,
      });

      const wasLive = this.live !== null;

      this.live = response?.data[0] ?? null;

      await this.cache.refresh(TwitchService.LIVE_CACHE_KEY, async () => this.live);

      this.publishStatusIfChanged();

      if (wasLive && !this.live) {
        await this.refreshSchedule();
      }
    } catch (error: unknown) {
      this.logger.warn(`Could not refresh Twitch live status: ${this.getErrorMessage(error)}`);
    }
  }

  private async refreshSchedule(): Promise<void> {
    try {
      const broadcasterId = await this.getBroadcasterId();

      const response = await this.twitchRequest<TwitchScheduleResponse>(
        '/schedule',
        {
          broadcaster_id: broadcasterId,

          first: '10',
        },
        true,
      );

      this.schedule = response?.data.segments ?? [];

      await this.cache.refresh(TwitchService.SCHEDULE_CACHE_KEY, async () => this.schedule);

      this.publishStatusIfChanged();
    } catch (error: unknown) {
      this.logger.warn(`Could not refresh Twitch schedule: ${this.getErrorMessage(error)}`);
    }
  }

  private async getBroadcasterId(): Promise<string> {
    if (this.broadcasterId) {
      return this.broadcasterId;
    }

    const login = this.configService.getOrThrow<string>('TWITCH_CHANNEL_LOGIN');

    const response = await this.twitchRequest<TwitchUserResponse>('/users', {
      login,
    });

    const user = response?.data[0];

    if (!user) {
      throw new Error(`Twitch user "${login}" was not found.`);
    }

    this.broadcasterId = user.id;

    return user.id;
  }

  private async twitchRequest<T>(
    path: string,
    parameters: Record<string, string>,
    allowNotFound = false,
  ): Promise<T | null> {
    const token = await this.getAppAccessToken();

    const url = new URL(`https://api.twitch.tv/helix${path}`);

    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,

        'Client-Id': this.configService.getOrThrow<string>('TWITCH_CLIENT_ID'),
      },
    });

    if (response.status === 404 && allowNotFound) {
      return null;
    }

    if (response.status === 401) {
      this.token = undefined;

      throw new Error('Twitch access token was rejected.');
    }

    if (!response.ok) {
      throw new Error(`Twitch returned ${response.status}.`);
    }

    return response.json() as Promise<T>;
  }

  private async getAppAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token.value;
    }

    const clientId = this.configService.getOrThrow<string>('TWITCH_CLIENT_ID');

    const clientSecret = this.configService.getOrThrow<string>('TWITCH_CLIENT_SECRET');

    const body = new URLSearchParams({
      client_id: clientId,

      client_secret: clientSecret,

      grant_type: 'client_credentials',
    });

    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },

      body,
    });

    if (!response.ok) {
      throw new Error(`Could not obtain Twitch access token (${response.status}).`);
    }

    const result = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.token = {
      value: result.access_token,

      expiresAt: Date.now() + result.expires_in * 1000 - 60_000,
    };

    return this.token.value;
  }

  private mapHeroType(category: string | null): HeroType | null {
    if (!category) {
      return null;
    }

    if (category.toLowerCase() === 'music') {
      return 'music';
    }

    if (category.toLowerCase() === 'just chatting') {
      return 'chatting';
    }

    return 'gaming';
  }

  private publishStatusIfChanged(): void {
    const status = this.getStatus();

    const serialized = JSON.stringify(status);

    if (serialized === this.previousStatus) {
      return;
    }

    this.previousStatus = serialized;

    this.events.publish('twitch.status.updated', status);
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
