import type {
  CommunityBalancingDefaults,
} from '@shared/community/community-balancing';
import type {
  CommunityDiscordRoleCatalog,
} from '@shared/community/community-discord';
import type {
  CommunityEventRule,
  CommunityEventType,
} from '@shared/community/community-event';
import type {
  CommunityAchievementDefinition,
  CommunityAchievementMetric,
  CommunityLevelDefinition,
  CommunityTitleDefinition,
} from '@shared/community/community-progression';

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import {
  achievementMetricRequiresEventType,
  getCommunityAchievementMetrics,
} from './community-achievement-metric';
import { CommunityBalancingDefaultsService } from './community-balancing-defaults.service';
import { CommunityEventRuleService } from './community-event-rule.service';
import { supportsContentLength } from './community-event-type';
import { CommunityProgressionDefinitionService } from './community-progression-definition.service';
import { DiscordBotService } from './discord/discord-bot.service';
import {
  SaveCommunityAchievementDto,
  SaveCommunityEventRuleDto,
  SaveCommunityLevelsDto,
  SaveCommunityTitleDto,
} from './dto/community-admin.dto';

interface CommunityEventTypeInfo {
  eventType: CommunityEventType;
  supportsContentLength: boolean;
}

interface CommunityAchievementMetricInfo {
  metric: CommunityAchievementMetric;
  requiresEventType: boolean;
}

@ApiTags('Community administration')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@Controller('admin/community')
@UseGuards(
  SessionAuthGuard,
  AdminGuard,
)
export class CommunityAdminController {
  constructor(
    private readonly eventRules:
      CommunityEventRuleService,
    private readonly definitions:
      CommunityProgressionDefinitionService,
    private readonly defaults:
      CommunityBalancingDefaultsService,
    private readonly discordBot:
      DiscordBotService,
  ) {}

  @Get('defaults')
  @ApiOperation({
    summary:
      'Get versioned community balancing defaults',
  })
  getDefaults(): CommunityBalancingDefaults {
    return this.defaults.getAdminDefaults();
  }

  @Get('discord/roles')
  @ApiOperation({
    summary:
      'List Discord roles the community bot can assign',
  })
  getDiscordRoles():
    Promise<CommunityDiscordRoleCatalog> {
    return this.discordBot
      .getRoleCatalog();
  }

  @Get('event-types')
  @ApiOperation({
    summary:
      'List configurable community event types',
  })
  getEventTypes():
    CommunityEventTypeInfo[] {
    return this.eventRules
      .getKnownEventTypes()
      .map((eventType) => ({
        eventType,
        supportsContentLength:
          supportsContentLength(
            eventType,
          ),
      }));
  }

  @Get('event-rules')
  @ApiOperation({
    summary:
      'List community XP reward rules',
  })
  getEventRules():
    Promise<CommunityEventRule[]> {
    return this.eventRules.getRules();
  }

  @Put('event-rules/:eventType')
  @ApiOperation({
    summary:
      'Create or update a community XP reward rule',
  })
  saveEventRule(
    @Param('eventType')
    eventType: string,
    @Body()
    dto: SaveCommunityEventRuleDto,
    @Req()
    request: AuthenticatedRequest,
  ): Promise<CommunityEventRule> {
    return this.eventRules.saveRule(
      eventType,
      dto,
      request.user.uuid,
    );
  }

  @Post('event-rules/:eventType/restore-default')
  @ApiOperation({
    summary:
      'Restore the versioned default for one XP rule',
  })
  restoreEventRule(
    @Param('eventType')
    eventType: string,
    @Req()
    request: AuthenticatedRequest,
  ): Promise<CommunityEventRule> {
    return this.defaults.restoreEventRule(
      eventType,
      request.user.uuid,
    );
  }

  @Get('achievement-metrics')
  @ApiOperation({
    summary:
      'List supported achievement metrics',
  })
  getAchievementMetrics():
    CommunityAchievementMetricInfo[] {
    return getCommunityAchievementMetrics()
      .map((metric) => ({
        metric,
        requiresEventType:
          achievementMetricRequiresEventType(
            metric,
          ),
      }));
  }

  @Get('levels')
  @ApiOperation({
    summary:
      'List community level definitions',
  })
  getLevels():
    Promise<CommunityLevelDefinition[]> {
    return this.definitions.getLevels();
  }

  @Put('levels')
  @ApiOperation({
    summary:
      'Replace the consecutive community level XP thresholds',
  })
  saveLevels(
    @Body()
    dto: SaveCommunityLevelsDto,
    @Req()
    request: AuthenticatedRequest,
  ): Promise<CommunityLevelDefinition[]> {
    return this.definitions.replaceLevels(
      dto.requiredXp,
      request.user.uuid,
    );
  }

  @Post('levels/restore-default')
  @ApiOperation({
    summary:
      'Restore the versioned default level thresholds',
  })
  restoreLevels(
    @Req()
    request: AuthenticatedRequest,
  ): Promise<CommunityLevelDefinition[]> {
    return this.defaults.restoreLevels(
      request.user.uuid,
    );
  }

  @Get('titles')
  @ApiOperation({
    summary:
      'List community title definitions',
  })
  getTitles():
    Promise<CommunityTitleDefinition[]> {
    return this.definitions.getTitles();
  }

  @Put('titles/:key')
  @ApiOperation({
    summary:
      'Create or update a community title definition',
  })
  saveTitle(
    @Param('key')
    key: string,
    @Body()
    dto: SaveCommunityTitleDto,
    @Req()
    request: AuthenticatedRequest,
  ): Promise<CommunityTitleDefinition> {
    return this.definitions.saveTitle(
      key,
      dto,
      request.user.uuid,
    );
  }

  @Get('achievements')
  @ApiOperation({
    summary:
      'List community achievement definitions',
  })
  getAchievements(): Promise<
    CommunityAchievementDefinition[]
  > {
    return this.definitions
      .getAchievements();
  }

  @Put('achievements/:key')
  @ApiOperation({
    summary:
      'Create or update a community achievement definition',
  })
  saveAchievement(
    @Param('key')
    key: string,
    @Body()
    dto: SaveCommunityAchievementDto,
    @Req()
    request: AuthenticatedRequest,
  ): Promise<
    CommunityAchievementDefinition
  > {
    return this.definitions
      .saveAchievement(
        key,
        dto,
        request.user.uuid,
      );
  }
}
