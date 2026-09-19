import { Controller, Get } from '@nestjs/common';

import { TwitchService } from './twitch.service';
import type { TwitchStatus } from '@shared/twitch/twitch-status';

@Controller('twitch')
export class TwitchController {
  constructor(private readonly twitchService: TwitchService) {}

  @Get('status')
  getStatus(): TwitchStatus {
    return this.twitchService.getStatus();
  }
}
