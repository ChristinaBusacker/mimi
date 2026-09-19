import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from './auth.service';
import { DiscordAuthGuard } from './guards/discord-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('auth')
export class AuthController {
  @Post('login')
  @UseGuards(LocalAuthGuard)
  login(@Req() request: AuthenticatedRequest): AuthenticatedUser {
    return request.user;
  }

  @Get('discord')
  @UseGuards(DiscordAuthGuard)
  discordLogin(): void {}

  @Get('discord/callback')
  @UseGuards(DiscordAuthGuard)
  discordCallback(@Req() request: AuthenticatedRequest): AuthenticatedUser {
    return request.user;
  }
}
