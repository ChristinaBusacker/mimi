import type {
  CommunityDashboard,
} from '@shared/community/community-dashboard';

import {
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Logger,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../../auth/session-cookie';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import { CommunityDashboardService } from '../community-dashboard.service';
import { CommunityTwitchIdentityService } from './community-twitch-identity.service';

@ApiTags('Community')
@Controller('community/twitch')
export class CommunityTwitchController {
  private readonly logger =
    new Logger(
      CommunityTwitchController.name,
    );

  constructor(
    private readonly twitch:
      CommunityTwitchIdentityService,
    private readonly dashboard:
      CommunityDashboardService,
    private readonly config:
      ConfigService,
  ) {}

  @Get('connect')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @ApiOperation({
    summary:
      'Connect Twitch to the current community account',
  })
  @ApiResponse({
    status: 302,
    description:
      'Redirects to Twitch for authorization.',
  })
  async connect(
    @Req()
    request: AuthenticatedRequest,
    @Res()
    response: Response,
  ): Promise<void> {
    response.redirect(
      HttpStatus.FOUND,
      await this.twitch
        .createAuthorizationUrl(
          request.user.uuid,
        ),
    );
  }

  @Get('callback')
  @ApiOperation({
    summary:
      'Handle the Twitch account connection callback',
  })
  @ApiResponse({
    status: 302,
    description:
      'Connects Twitch and redirects to the community dashboard.',
  })
  async callback(
    @Query('code')
    code: string | undefined,
    @Query('state')
    state: string | undefined,
    @Query('error')
    twitchError: string | undefined,
    @Res()
    response: Response,
  ): Promise<void> {
    let result:
      | 'connected'
      | 'conflict'
      | 'failed' = 'failed';

    if (!twitchError) {
      try {
        await this.twitch.completeLink(
          code,
          state,
        );
        result = 'connected';
      } catch (error: unknown) {
        if (
          error instanceof
          ConflictException
        ) {
          result = 'conflict';
        } else {
          this.logger.warn(
            `Twitch account linking failed: ${this.errorMessage(error)}`,
          );
        }
      }
    }

    response.redirect(
      HttpStatus.FOUND,
      this.getFrontendUrl(
        `/community/dashboard?twitch=${result}`,
      ),
    );
  }

  @Delete()
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @ApiOperation({
    summary:
      'Disconnect Twitch from the current community account',
  })
  async disconnect(
    @Req()
    request: AuthenticatedRequest,
  ): Promise<CommunityDashboard> {
    await this.twitch.disconnect(
      request.user.uuid,
    );

    return this.dashboard.getDashboard(
      request.user.uuid,
    );
  }

  private getFrontendUrl(
    path: string,
  ): string {
    const baseUrl = new URL(
      this.config.getOrThrow<string>(
        'PUBLIC_SITE_URL',
      ),
    );

    if (
      baseUrl.protocol !== 'http:' &&
      baseUrl.protocol !== 'https:'
    ) {
      throw new Error(
        'PUBLIC_SITE_URL must use HTTP or HTTPS.',
      );
    }

    return new URL(
      path,
      baseUrl,
    ).toString();
  }

  private errorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
