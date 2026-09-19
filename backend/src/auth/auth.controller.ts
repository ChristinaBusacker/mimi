import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthenticatedUserDto } from './dto/authenticated-user.dto';
import { LoginDto } from './dto/login.dto';
import { DiscordAuthGuard } from './guards/discord-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUserDto;
};

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @ApiOperation({
    summary: 'Log in with email and password',
  })
  @ApiBody({
    type: LoginDto,
  })
  @ApiOkResponse({
    description: 'The authenticated user.',
    type: AuthenticatedUserDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The credentials are invalid.',
  })
  login(@Req() request: AuthenticatedRequest): AuthenticatedUserDto {
    return request.user;
  }

  @Get('discord')
  @UseGuards(DiscordAuthGuard)
  @ApiOperation({
    summary: 'Start Discord authentication',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Discord for authentication.',
  })
  discordLogin(): void {}

  @Get('discord/callback')
  @UseGuards(DiscordAuthGuard)
  @ApiOperation({
    summary: 'Handle the Discord authentication callback',
  })
  @ApiOkResponse({
    description: 'The authenticated user.',
    type: AuthenticatedUserDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Discord authentication failed.',
  })
  discordCallback(@Req() request: AuthenticatedRequest): AuthenticatedUserDto {
    return request.user;
  }
}
