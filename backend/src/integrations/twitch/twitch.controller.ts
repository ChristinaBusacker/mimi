import { Controller, Get } from '@nestjs/common';

import { TwitchService } from './twitch.service';
import type { TwitchStatus } from './twitch.types';

@Controller('twitch')
export class TwitchController {
  constructor(private readonly twitchService: TwitchService) {}

  @Get('status')
  getStatus(): TwitchStatus {
    return this.twitchService.getStatus();
  }
}
