import type {
  PushPublicKeyResponse,
} from '@shared/push/push';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import {
  RemovePushSubscriptionDto,
  SavePushSubscriptionDto,
} from './dto/push-subscription.dto';
import { PushService } from './push.service';

@ApiTags('Push')
@Controller('push')
export class PushController {
  constructor(
    private readonly push:
      PushService,
  ) {}

  @Get('public-key')
  @ApiOperation({
    summary:
      'Get the public VAPID key for web push',
  })
  getPublicKey():
    PushPublicKeyResponse {
    return this.push.getPublicKey();
  }

  @Post('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @ApiOperation({
    summary:
      'Register the current browser push subscription',
  })
  async saveSubscription(
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: SavePushSubscriptionDto,
  ): Promise<void> {
    await this.push.saveSubscription(
      request.user.uuid,
      dto,
    );
  }

  @Delete('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @ApiOperation({
    summary:
      'Remove the current browser push subscription',
  })
  async removeSubscription(
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: RemovePushSubscriptionDto,
  ): Promise<void> {
    await this.push.removeSubscription(
      request.user.uuid,
      dto.endpoint,
    );
  }
}
