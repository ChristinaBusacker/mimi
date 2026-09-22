import type {
  GamingNextStream,
  SteamGameInfo,
} from '@shared/gaming/gaming';

import { ApiProperty } from '@nestjs/swagger';

import { TwitchScheduledStreamDto } from '../../integrations/twitch/dto/twitch-schedule.dto';

export class SteamGameInfoDto implements SteamGameInfo {
  @ApiProperty()
  appId!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    nullable: true,
    type: String,
  })
  shortDescription!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
  })
  headerImageUrl!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
  })
  capsuleImageUrl!: string | null;

  @ApiProperty({
    type: String,
    isArray: true,
  })
  genres!: string[];

  @ApiProperty({
    type: String,
    isArray: true,
  })
  developers!: string[];

  @ApiProperty({
    type: String,
    isArray: true,
  })
  publishers!: string[];

  @ApiProperty({
    nullable: true,
    type: String,
  })
  releaseDate!: string | null;

  @ApiProperty()
  storeUrl!: string;
}

export class GamingNextStreamDto implements GamingNextStream {
  @ApiProperty({
    type: TwitchScheduledStreamDto,
    nullable: true,
  })
  stream!: TwitchScheduledStreamDto | null;

  @ApiProperty({
    type: SteamGameInfoDto,
    nullable: true,
  })
  game!: SteamGameInfoDto | null;
}
