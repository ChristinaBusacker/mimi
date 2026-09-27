import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Post,
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
import type {
  Request,
  Response,
} from 'express';

import { AdminGuard } from '../../auth/guards/admin.guard';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../../auth/session-cookie';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import {
  CommunityTwitchEventSubService,
  type TwitchEventSubWebhookBody,
} from './community-twitch-eventsub.service';

type EventSubRequest = Request & {
  rawBody?: Buffer;
};

@ApiTags('Community Twitch EventSub')
@Controller('community/twitch/eventsub')
export class CommunityTwitchEventSubController {
  constructor(
    private readonly eventSub:
      CommunityTwitchEventSubService,
    private readonly config:
      ConfigService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Receive Twitch EventSub webhook messages',
  })
  @ApiResponse({
    status: 204,
    description:
      'The Twitch EventSub notification was accepted.',
  })
  async webhook(
    @Req() request: EventSubRequest,
    @Res() response: Response,
  ): Promise<void> {
    if (!request.rawBody) {
      throw new BadRequestException(
        'Raw request body is required for Twitch EventSub verification.',
      );
    }

    const result =
      await this.eventSub.handleWebhook({
        messageId:
          this.header(
            request,
            'twitch-eventsub-message-id',
          ),
        messageTimestamp:
          this.header(
            request,
            'twitch-eventsub-message-timestamp',
          ),
        messageSignature:
          this.header(
            request,
            'twitch-eventsub-message-signature',
          ),
        messageType:
          this.header(
            request,
            'twitch-eventsub-message-type',
          ),
        rawBody: request.rawBody,
        body:
          request.body as
            TwitchEventSubWebhookBody,
      });

    if (result.challenge) {
      response
        .status(HttpStatus.OK)
        .type('text/plain')
        .send(result.challenge);
      return;
    }

    response
      .status(HttpStatus.NO_CONTENT)
      .send();
  }

  @Get('setup')
  @UseGuards(
    SessionAuthGuard,
    AdminGuard,
  )
  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @ApiOperation({
    summary:
      'Authorize the configured Twitch broadcaster for community EventSub events',
  })
  @ApiResponse({
    status: 302,
    description:
      'Redirects the admin to Twitch for broadcaster authorization.',
  })
  setup(
    @Req()
    request: AuthenticatedRequest,
    @Res() response: Response,
  ): void {
    response.redirect(
      HttpStatus.FOUND,
      this.eventSub
        .createBroadcasterAuthorizationUrl(
          request.user.uuid,
        ),
    );
  }

  @Get('setup/callback')
  @UseGuards(
    SessionAuthGuard,
    AdminGuard,
  )
  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @ApiOperation({
    summary:
      'Complete Twitch broadcaster authorization for EventSub',
  })
  @ApiResponse({
    status: 302,
    description:
      'Completes EventSub authorization and redirects to the admin area.',
  })
  async setupCallback(
    @Req()
    request: AuthenticatedRequest,
    @Res() response: Response,
    @Query('code')
    code?: string,
    @Query('state')
    state?: string,
    @Query('error')
    error?: string,
  ): Promise<void> {
    if (error) {
      response.redirect(
        HttpStatus.FOUND,
        this.frontendUrl(
          '/admin?eventsub=denied',
        ),
      );
      return;
    }

    await this.eventSub
      .completeBroadcasterAuthorization(
        request.user.uuid,
        code,
        state,
      );

    response.redirect(
      HttpStatus.FOUND,
      this.frontendUrl(
        '/admin?eventsub=connected',
      ),
    );
  }

  private header(
    request: Request,
    name: string,
  ): string | undefined {
    const value = request.headers[name];

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }

  private frontendUrl(
    path: string,
  ): string {
    return new URL(
      path,
      this.config.getOrThrow<string>(
        'PUBLIC_SITE_URL',
      ),
    ).toString();
  }
}
