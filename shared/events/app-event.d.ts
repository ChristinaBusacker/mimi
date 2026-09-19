import type { TwitchStatus } from '../twitch/twitch-status';
import type { YouTubeVideo } from '../youtube/youtube-video';

export interface AppEventMap {
  heartbeat: {
    timestamp: string;
  };
  'twitch.status.updated': TwitchStatus;
  'youtube.videos.updated': YouTubeVideo[];
}

export type AppEventType = keyof AppEventMap;

export type AppEvent<TType extends AppEventType = AppEventType> =
  TType extends AppEventType
    ? {
        type: TType;
        data: AppEventMap[TType];
      }
    : never;
