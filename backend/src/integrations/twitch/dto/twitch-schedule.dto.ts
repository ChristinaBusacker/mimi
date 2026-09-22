import type {
  TwitchCategory,
  TwitchScheduledStream,
} from '@shared/twitch/twitch-status';

import { ApiProperty } from '@nestjs/swagger';

export class TwitchCategoryDto implements TwitchCategory {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class TwitchScheduledStreamDto
  implements TwitchScheduledStream
{
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({
    format: 'date-time',
  })
  startsAt!: string;

  @ApiProperty({
    format: 'date-time',
  })
  endsAt!: string;

  @ApiProperty({
    type: TwitchCategoryDto,
    nullable: true,
  })
  category!: TwitchCategoryDto | null;

  @ApiProperty({
    enum: ['music', 'chatting', 'gaming'],
    nullable: true,
  })
  heroType!: 'music' | 'chatting' | 'gaming' | null;

  @ApiProperty()
  channelUrl!: string;
}
