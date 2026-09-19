import { Controller, Get } from '@nestjs/common';

import { YouTubeService } from './youtube.service';
import { YouTubeVideo } from './youtube.types';

@Controller('youtube')
export class YouTubeController {
  constructor(private readonly youTubeService: YouTubeService) {}

  @Get('videos')
  getVideos(): Promise<YouTubeVideo[]> {
    return this.youTubeService.getVideos();
  }
}
