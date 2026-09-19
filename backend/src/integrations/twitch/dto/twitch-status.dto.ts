import { ApiProperty } from '@nestjs/swagger';

import type {
  HeroType,
  TwitchLiveStatus,
  TwitchOfflineStatus,
  TwitchUpcomingStatus,
} from '@shared/twitch/twitch-status';

const HERO_TYPES: HeroType[] = ['music', 'chatting', 'gaming'];

export class TwitchLiveStatusDto implements TwitchLiveStatus {
  @ApiProperty({
    enum: ['live'],
  })
  state!: 'live';

  @ApiProperty()
  title!: string;

  @ApiProperty({
    nullable: true,
  })
  category!: string | null;

  @ApiProperty({
    enum: HERO_TYPES,
    nullable: true,
  })
  heroType!: HeroType | null;

  @ApiProperty({
    format: 'date-time',
  })
  startedAt!: string;

  @ApiProperty({
    format: 'uri',
  })
  channelUrl!: string;
}

export class TwitchUpcomingStatusDto implements TwitchUpcomingStatus {
  @ApiProperty({
    enum: ['upcoming'],
  })
  state!: 'upcoming';

  @ApiProperty()
  title!: string;

  @ApiProperty({
    nullable: true,
  })
  category!: string | null;

  @ApiProperty({
    enum: HERO_TYPES,
    nullable: true,
  })
  heroType!: HeroType | null;

  @ApiProperty({
    format: 'date-time',
  })
  startsAt!: string;

  @ApiProperty({
    format: 'uri',
  })
  channelUrl!: string;
}

export class TwitchOfflineStatusDto implements TwitchOfflineStatus {
  @ApiProperty({
    enum: ['none'],
  })
  state!: 'none';

  @ApiProperty({
    format: 'uri',
  })
  channelUrl!: string;
}
