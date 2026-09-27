import type {
  CommunityPublicSummary,
} from '@shared/community/community-public';

import {
  Controller,
  Get,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { DiscordBotService } from './discord/discord-bot.service';

@ApiTags('Community')
@Controller('community')
export class CommunityPublicController {
  constructor(
    private readonly discord:
      DiscordBotService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Get public live community information',
  })
  getSummary(): Promise<CommunityPublicSummary> {
    return this.discord.getPublicSummary();
  }
}
