import type { ParamMap } from '@angular/router';

import type {
  HeroType,
  TwitchStatus,
} from '@shared/twitch/twitch-status';
import type { YouTubeVideo } from '@shared/youtube/youtube-video';

const HERO_TYPES: HeroType[] = ['music', 'chatting', 'gaming'];
const PREVIEW_CHANNEL_URL = 'https://www.twitch.tv/';
const PREVIEW_STARTS_AT = '2026-09-20T18:00:00.000Z';

export function createTwitchPreview(
  queryParams: ParamMap,
  currentStatus: TwitchStatus | null,
): TwitchStatus | null {
  const state = queryParams.get('hero');

  if (state !== 'live' && state !== 'upcoming' && state !== 'none') {
    return null;
  }

  const channelUrl = currentStatus?.channelUrl ?? PREVIEW_CHANNEL_URL;

  if (state === 'none') {
    return {
      state: 'none',
      channelUrl,
    };
  }

  const heroType = getHeroType(queryParams.get('heroType'));

  if (state === 'live') {
    return {
      state: 'live',
      title: 'Preview Stream',
      category: getCategory(heroType),
      heroType,
      startedAt: '2026-09-19T18:00:00.000Z',
      channelUrl,
    };
  }

  return {
    state: 'upcoming',
    title: 'Preview Stream',
    category: getCategory(heroType),
    heroType,
    startsAt: PREVIEW_STARTS_AT,
    channelUrl,
  };
}

export function createVideoPreview(queryParams: ParamMap): YouTubeVideo[] | null {
  if (queryParams.get('previewVideos') !== '1') {
    return null;
  }

  return [
    createPreviewVideo('1', 'Acoustic Session', 754),
    createPreviewVideo('2', 'Gaming Highlights', 1_128),
    createPreviewVideo('3', 'Community Abend', 542),
  ];
}

function getHeroType(value: string | null): HeroType {
  return HERO_TYPES.find((heroType) => heroType === value) ?? 'music';
}

function getCategory(heroType: HeroType): string {
  if (heroType === 'chatting') {
    return 'Just Chatting';
  }

  if (heroType === 'music') {
    return 'Music';
  }

  return 'Preview Game';
}

function createPreviewVideo(
  id: string,
  title: string,
  durationSeconds: number,
): YouTubeVideo {
  return {
    id: `preview-${id}`,
    url: 'https://www.youtube.com/',
    title,
    description: 'Preview content for layout review.',
    descriptionExcerpt: 'Preview content for layout review.',
    thumbnailUrl: '/images/video-tile.png',
    durationSeconds,
    publishedAt: '2026-09-19T18:00:00.000Z',
  };
}
