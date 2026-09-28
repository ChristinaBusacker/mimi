import type {
  NotificationPreferences,
} from '@shared/notifications/notifications';

import {
  Body,
  Controller,
  Get,
  Put,
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
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationPreferencesService } from './notification-preferences.service';

@ApiTags('Notifications')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(
    private readonly preferences:
      NotificationPreferencesService,
  ) {}

  @Get('preferences')
  @ApiOperation({
    summary:
      'Get notification preferences for the current user',
  })
  getPreferences(
    @Req()
    request: AuthenticatedRequest,
  ): Promise<NotificationPreferences> {
    return this.preferences.get(
      request.user.uuid,
    );
  }

  @Put('preferences')
  @ApiOperation({
    summary:
      'Update notification preferences for the current user',
  })
  updatePreferences(
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.preferences.update(
      request.user.uuid,
      dto,
    );
  }
}
