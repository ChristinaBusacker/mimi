import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';

import type {
  HeroType,
  TwitchScheduledStream,
  TwitchStatus,
} from '@shared/twitch/twitch-status';

import { TwitchScheduledStreamDto } from './dto/twitch-schedule.dto';
import {
  TwitchLiveStatusDto,
  TwitchOfflineStatusDto,
  TwitchUpcomingStatusDto,
} from './dto/twitch-status.dto';
import { TwitchService } from './twitch.service';

const HERO_TYPES: readonly HeroType[] = [
  'music',
  'chatting',
  'gaming',
];

@ApiTags('Twitch')
@ApiExtraModels(
  TwitchLiveStatusDto,
  TwitchUpcomingStatusDto,
  TwitchOfflineStatusDto,
  TwitchScheduledStreamDto,
)
@Controller('twitch')
export class TwitchController {
  constructor(private readonly twitchService: TwitchService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get the current Twitch status',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        {
          $ref: getSchemaPath(TwitchLiveStatusDto),
        },
        {
          $ref: getSchemaPath(TwitchUpcomingStatusDto),
        },
        {
          $ref: getSchemaPath(TwitchOfflineStatusDto),
        },
      ],
    },
  })
  getStatus(): TwitchStatus {
    return this.twitchService.getStatus();
  }

  @Get('schedule/next')
  @ApiOperation({
    summary: 'Get the next scheduled Twitch stream',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: HERO_TYPES,
    description:
      'Optionally restrict the result to music, chatting or gaming.',
  })
  @ApiOkResponse({
    type: TwitchScheduledStreamDto,
    description:
      'The next matching scheduled stream, or null when none is scheduled.',
  })
  @ApiBadRequestResponse({
    description: 'The requested stream type is not supported.',
  })
  getNextScheduledStream(
    @Query('type') type?: string,
  ): TwitchScheduledStream | null {
    if (type === undefined) {
      return this.twitchService.getNextScheduledStream();
    }

    if (!this.isHeroType(type)) {
      throw new BadRequestException(
        `Unsupported Twitch stream type "${type}".`,
      );
    }

    return this.twitchService.getNextScheduledStream(type);
  }

  private isHeroType(value: string): value is HeroType {
    return HERO_TYPES.some((type) => type === value);
  }
}
