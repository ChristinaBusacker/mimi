import { Controller, Get } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';

import type { TwitchStatus } from '@shared/twitch/twitch-status';

import {
  TwitchLiveStatusDto,
  TwitchOfflineStatusDto,
  TwitchUpcomingStatusDto,
} from './dto/twitch-status.dto';
import { TwitchService } from './twitch.service';

@ApiTags('Twitch')
@ApiExtraModels(
  TwitchLiveStatusDto,
  TwitchUpcomingStatusDto,
  TwitchOfflineStatusDto,
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
}
