import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { YouTubeVideoDto } from './dto/youtube-video.dto';
import { YouTubeService } from './youtube.service';

@ApiTags('YouTube')
@Controller('youtube')
export class YouTubeController {
  constructor(private readonly youTubeService: YouTubeService) {}

  @Get('videos')
  @ApiOperation({
    summary: 'Get the latest YouTube videos',
  })
  @ApiOkResponse({
    type: YouTubeVideoDto,
    isArray: true,
  })
  getVideos(): Promise<YouTubeVideoDto[]> {
    return this.youTubeService.getVideos();
  }
}
