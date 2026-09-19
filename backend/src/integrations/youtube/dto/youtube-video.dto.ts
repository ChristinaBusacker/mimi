import { ApiProperty } from '@nestjs/swagger';

import type { YouTubeVideo } from '@shared/youtube/youtube-video';

export class YouTubeVideoDto implements YouTubeVideo {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    format: 'uri',
  })
  url!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  descriptionExcerpt!: string;

  @ApiProperty({
    format: 'uri',
  })
  thumbnailUrl!: string;

  @ApiProperty({
    minimum: 0,
  })
  durationSeconds!: number;

  @ApiProperty({
    format: 'date-time',
  })
  publishedAt!: string;
}
