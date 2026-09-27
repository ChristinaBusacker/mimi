import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';

import { CommunityBalancingDefaultsService } from './community-balancing-defaults.service';
import { CommunityEventRuleService } from './community-event-rule.service';
import { CommunityEventService } from './community-event.service';
import { CommunityProfileCustomizationService } from './community-profile-customization.service';
import { CommunityProgressionDefinitionService } from './community-progression-definition.service';
import { CommunityProgressionService } from './community-progression.service';
import { CommunityService } from './community.service';
import { DiscordBotService } from './discord/discord-bot.service';
import { DiscordCommunityService } from './discord/discord-community.service';
import { DiscordRoleSyncService } from './discord/discord-role-sync.service';
import { CommunityEventEntry } from './entities/community-event.entry';
import { CommunityAchievementConditionEntry } from './entities/community-achievement-condition.entry';
import { CommunityAchievementEntry } from './entities/community-achievement.entry';
import { CommunityEventRuleEntry } from './entities/community-event-rule.entry';
import { CommunityDiscordAssignedRoleEntry } from './entities/community-discord-assigned-role.entry';
import { CommunityLevelEntry } from './entities/community-level.entry';
import { CommunityPinnedAchievementEntry } from './entities/community-pinned-achievement.entry';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { CommunityTitleEntry } from './entities/community-title.entry';
import { DiscordMembershipPeriodEntry } from './entities/discord-membership-period.entry';
import { UserAchievementEntry } from './entities/user-achievement.entry';
import { UserTitleEntry } from './entities/user-title.entry';
import { XpTransactionEntry } from './entities/xp-transaction.entry';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      CommunityAchievementConditionEntry,
      CommunityAchievementEntry,
      CommunityEventEntry,
      CommunityEventRuleEntry,
      CommunityDiscordAssignedRoleEntry,
      CommunityLevelEntry,
      CommunityPinnedAchievementEntry,
      CommunityProfileEntry,
      CommunityTitleEntry,
      DiscordMembershipPeriodEntry,
      UserAchievementEntry,
      UserTitleEntry,
      XpTransactionEntry,
    ]),
  ],
  providers: [
    CommunityBalancingDefaultsService,
    CommunityEventRuleService,
    CommunityEventService,
    CommunityProfileCustomizationService,
    CommunityProgressionDefinitionService,
    CommunityProgressionService,
    CommunityService,
    DiscordBotService,
    DiscordCommunityService,
    DiscordRoleSyncService,
  ],
  exports: [
    CommunityBalancingDefaultsService,
    CommunityEventRuleService,
    CommunityEventService,
    CommunityProfileCustomizationService,
    CommunityProgressionDefinitionService,
    CommunityProgressionService,
    CommunityService,
    DiscordBotService,
    DiscordCommunityService,
  ],
})
export class CommunityModule {}
