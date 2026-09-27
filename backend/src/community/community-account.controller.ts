import type {
  CommunityDashboard,
} from '@shared/community/community-dashboard';

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
import { CommunityDashboardService } from './community-dashboard.service';
import { CommunityProfileCustomizationService } from './community-profile-customization.service';
import {
  PinCommunityAchievementsDto,
  SelectCommunityDiscordShowcaseRoleDto,
  SelectCommunityProfileColorDto,
  SelectCommunityTitleDto,
} from './dto/community-profile-customization.dto';

@ApiTags('Community')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@Controller('community/me')
@UseGuards(SessionAuthGuard)
export class CommunityAccountController {
  constructor(
    private readonly dashboard:
      CommunityDashboardService,
    private readonly customization:
      CommunityProfileCustomizationService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Get the current community dashboard',
  })
  getDashboard(
    @Req()
    request: AuthenticatedRequest,
  ): Promise<CommunityDashboard> {
    return this.dashboard.getDashboard(
      request.user.uuid,
    );
  }

  @Put('title')
  @ApiOperation({
    summary:
      'Select an unlocked community title',
  })
  async selectTitle(
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: SelectCommunityTitleDto,
  ): Promise<CommunityDashboard> {
    await this.customization.selectTitle(
      request.user.uuid,
      dto.titleId,
    );

    return this.dashboard.getDashboard(
      request.user.uuid,
    );
  }

  @Put('profile-color')
  @ApiOperation({
    summary:
      'Select an unlocked community profile color',
  })
  async selectProfileColor(
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: SelectCommunityProfileColorDto,
  ): Promise<CommunityDashboard> {
    await this.customization
      .selectProfileColor(
        request.user.uuid,
        dto.achievementId,
      );

    return this.dashboard.getDashboard(
      request.user.uuid,
    );
  }

  @Put('discord-showcase-role')
  @ApiOperation({
    summary:
      'Select an unlocked Discord showcase role',
  })
  async selectDiscordShowcaseRole(
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: SelectCommunityDiscordShowcaseRoleDto,
  ): Promise<CommunityDashboard> {
    await this.customization
      .selectDiscordShowcaseRole(
        request.user.uuid,
        dto.roleId,
      );

    return this.dashboard.getDashboard(
      request.user.uuid,
    );
  }

  @Put('pinned-achievements')
  @ApiOperation({
    summary:
      'Choose up to three unlocked achievements to feature',
  })
  async pinAchievements(
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: PinCommunityAchievementsDto,
  ): Promise<CommunityDashboard> {
    await this.customization
      .setPinnedAchievements(
        request.user.uuid,
        dto.achievementIds,
      );

    return this.dashboard.getDashboard(
      request.user.uuid,
    );
  }
}
