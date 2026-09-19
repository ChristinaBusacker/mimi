import type { YouTubeVideo } from '@shared/youtube/youtube-video';

export class LoadYouTubeVideos {
  static readonly type = '[YouTube] Load Videos';
}

export class SetYouTubeVideos {
  static readonly type = '[YouTube] Set Videos';

  constructor(public readonly videos: YouTubeVideo[]) {}
}
