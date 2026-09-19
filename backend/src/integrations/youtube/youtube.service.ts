import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

import { CacheService } from '../cache/cache.service';
import { EventsService } from '../events/events.service';

import { YouTubeVideo } from './youtube.types';

interface YouTubeChannelResponse {
  items: Array<{
    contentDetails: {
      relatedPlaylists: {
        uploads: string;
      };
    };
  }>;
}

interface YouTubePlaylistResponse {
  items: Array<{
    contentDetails: {
      videoId: string;
    };
  }>;
}

interface YouTubeThumbnail {
  url: string;
}

interface YouTubeVideoResponse {
  items: Array<{
    id: string;

    snippet: {
      title: string;
      description: string;
      publishedAt: string;

      thumbnails: {
        default?: YouTubeThumbnail;
        medium?: YouTubeThumbnail;
        high?: YouTubeThumbnail;
        standard?: YouTubeThumbnail;
        maxres?: YouTubeThumbnail;
      };
    };

    contentDetails: {
      duration: string;
    };

    status: {
      privacyStatus: string;
    };
  }>;
}

@Injectable()
export class YouTubeService implements OnApplicationBootstrap {
  private static readonly CACHE_KEY = 'youtube.videos';

  private static readonly CACHE_TTL = 5 * 60 * 1000;

  private readonly logger = new Logger(YouTubeService.name);

  constructor(
    private readonly configService: ConfigService,

    private readonly cache: CacheService,

    private readonly events: EventsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.refreshSafely();
  }

  async getVideos(): Promise<YouTubeVideo[]> {
    const cached = await this.cache.getOrRefresh(
      YouTubeService.CACHE_KEY,
      YouTubeService.CACHE_TTL,
      () => this.fetchVideos(),
    );

    return cached.value;
  }

  @Interval(YouTubeService.CACHE_TTL)
  async refreshInterval(): Promise<void> {
    await this.refreshSafely();
  }

  private async refreshSafely(): Promise<void> {
    try {
      const previous = await this.cache.get<YouTubeVideo[]>(
        YouTubeService.CACHE_KEY,
      );

      const refreshed = await this.cache.refresh(YouTubeService.CACHE_KEY, () =>
        this.fetchVideos(),
      );

      if (!previous || !this.sameVideos(previous.value, refreshed.value)) {
        this.events.publish('youtube.videos.updated', refreshed.value);
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Could not refresh YouTube videos: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private async fetchVideos(): Promise<YouTubeVideo[]> {
    const apiKey = this.configService.getOrThrow<string>('YOUTUBE_API_KEY');

    const channelId =
      this.configService.getOrThrow<string>('YOUTUBE_CHANNEL_ID');

    const limit = Number(
      this.configService.get<string>('YOUTUBE_VIDEO_LIMIT') ?? 6,
    );

    const uploadsPlaylistId = await this.getUploadsPlaylistId(
      apiKey,
      channelId,
    );

    const candidateCount = Math.min(Math.max(limit * 4, 20), 50);

    const playlist = await this.fetchJson<YouTubePlaylistResponse>(
      'https://www.googleapis.com/youtube/v3/playlistItems',
      {
        part: 'contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: String(candidateCount),
        key: apiKey,
      },
    );

    const videoIds = playlist.items.map((item) => item.contentDetails.videoId);

    if (videoIds.length === 0) {
      return [];
    }

    const response = await this.fetchJson<YouTubeVideoResponse>(
      'https://www.googleapis.com/youtube/v3/videos',
      {
        part: 'snippet,contentDetails,status',
        id: videoIds.join(','),
        key: apiKey,
      },
    );

    return response.items
      .filter((video) => video.status.privacyStatus === 'public')
      .map((video) => this.mapVideo(video))
      .filter((video) => video.durationSeconds > 120)
      .sort(
        (left, right) =>
          Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
      )
      .slice(0, limit);
  }

  private async getUploadsPlaylistId(
    apiKey: string,
    channelId: string,
  ): Promise<string> {
    const response = await this.fetchJson<YouTubeChannelResponse>(
      'https://www.googleapis.com/youtube/v3/channels',
      {
        part: 'contentDetails',
        id: channelId,
        key: apiKey,
      },
    );

    const channel = response.items[0];

    if (!channel) {
      throw new Error(`YouTube channel "${channelId}" was not found.`);
    }

    return channel.contentDetails.relatedPlaylists.uploads;
  }

  private mapVideo(video: YouTubeVideoResponse['items'][number]): YouTubeVideo {
    const durationSeconds = this.parseDuration(video.contentDetails.duration);

    return {
      id: video.id,

      url: `https://www.youtube.com/watch?v=${video.id}`,

      title: video.snippet.title,

      description: video.snippet.description,

      descriptionExcerpt: this.createExcerpt(video.snippet.description),

      thumbnailUrl: this.getThumbnailUrl(video.snippet.thumbnails),

      durationSeconds,

      publishedAt: video.snippet.publishedAt,
    };
  }

  private parseDuration(duration: string): number {
    const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(
      duration,
    );

    if (!match) {
      return 0;
    }

    const days = Number(match[1] ?? 0);

    const hours = Number(match[2] ?? 0);

    const minutes = Number(match[3] ?? 0);

    const seconds = Number(match[4] ?? 0);

    return days * 86_400 + hours * 3_600 + minutes * 60 + seconds;
  }

  private createExcerpt(description: string): string {
    const normalized = description.replace(/\s+/g, ' ').trim();

    if (normalized.length <= 220) {
      return normalized;
    }

    return `${normalized.slice(0, 217).trimEnd()}...`;
  }

  private getThumbnailUrl(
    thumbnails: YouTubeVideoResponse['items'][number]['snippet']['thumbnails'],
  ): string {
    return (
      thumbnails.maxres?.url ??
      thumbnails.standard?.url ??
      thumbnails.high?.url ??
      thumbnails.medium?.url ??
      thumbnails.default?.url ??
      ''
    );
  }

  private async fetchJson<T>(
    url: string,
    parameters: Record<string, string>,
  ): Promise<T> {
    const requestUrl = new URL(url);

    for (const [key, value] of Object.entries(parameters)) {
      requestUrl.searchParams.set(key, value);
    }

    const response = await fetch(requestUrl);

    if (!response.ok) {
      throw new Error(`YouTube returned ${response.status}.`);
    }

    return response.json() as Promise<T>;
  }

  private sameVideos(left: YouTubeVideo[], right: YouTubeVideo[]): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
