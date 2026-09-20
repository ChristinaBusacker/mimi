import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AuthSessionService } from './auth-session.service';
import { AuthenticatedUserDto } from './dto/authenticated-user.dto';
import { LoginDto } from './dto/login.dto';
import { DiscordAuthGuard } from './guards/discord-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import {
  AUTH_SESSION_COOKIE,
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from './session-cookie';
import type { AuthenticatedRequest } from './types/authenticated-request';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly sessions: AuthSessionService,
  ) {}

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
  async login(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatedUserDto> {
    await this.startSession(request, response);

    return request.user;
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @ApiOperation({
    summary: 'Get the currently authenticated user',
  })
  @ApiOkResponse({
    description: 'The authenticated user.',
    type: AuthenticatedUserDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No valid session is available.',
  })
  me(@Req() request: AuthenticatedRequest): AuthenticatedUserDto {
    return request.user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @ApiOperation({
    summary: 'Log out the current session',
  })
  @ApiNoContentResponse({
    description: 'The current session was cleared.',
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = readSessionCookie(request);

    if (token) {
      await this.sessions.revoke(token);
    }

    clearSessionCookie(response);
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
  async discordCallback(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatedUserDto> {
    await this.startSession(request, response);

    return request.user;
  }

  private async startSession(
    request: AuthenticatedRequest,
    response: Response,
  ): Promise<void> {
    const session = await this.sessions.create(request.user.uuid);

    setSessionCookie(
      response,
      session.token,
      session.expiresAt,
    );
  }
}
