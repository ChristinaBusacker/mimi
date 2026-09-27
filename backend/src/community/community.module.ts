import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TwitchModule } from '../integrations/twitch/twitch.module';
import { UsersModule } from '../users/users.module';

import { CommunityBalancingDefaultsService } from './community-balancing-defaults.service';
import { CommunityDiscordRoleDefinitionService } from './community-discord-role-definition.service';
import { CommunityDiscordUserRoleResolverService } from './community-discord-user-role-resolver.service';
import { CommunityEventRuleService } from './community-event-rule.service';
import { CommunityEventService } from './community-event.service';
import { CommunityProfileCustomizationService } from './community-profile-customization.service';
import { CommunityProgressionDefinitionService } from './community-progression-definition.service';
import { CommunityProgressionService } from './community-progression.service';
import { CommunityRewardSyncService } from './community-reward-sync.service';
import { CommunityService } from './community.service';
import { DiscordBotService } from './discord/discord-bot.service';
import { DiscordCommunityService } from './discord/discord-community.service';
import { DiscordPublicCommunityService } from './discord/discord-public-community.service';
import { DiscordRoleProvisioningService } from './discord/discord-role-provisioning.service';
import { DiscordRoleSyncService } from './discord/discord-role-sync.service';
import { CommunityEventEntry } from './entities/community-event.entry';
import { CommunityAchievementConditionEntry } from './entities/community-achievement-condition.entry';
import { CommunityAchievementEntry } from './entities/community-achievement.entry';
import { CommunityEventRuleEntry } from './entities/community-event-rule.entry';
import { CommunityDiscordAssignedRoleEntry } from './entities/community-discord-assigned-role.entry';
import { CommunityDiscordRoleEntry } from './entities/community-discord-role.entry';
import { CommunityLevelEntry } from './entities/community-level.entry';
import { CommunityPinnedAchievementEntry } from './entities/community-pinned-achievement.entry';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { CommunityTitleEntry } from './entities/community-title.entry';
import { CommunityTwitchIdentityEntry } from './twitch/community-twitch-identity.entry';
import { CommunityTwitchLinkStateEntry } from './twitch/community-twitch-link-state.entry';
import { CommunityTwitchEventSubService } from './twitch/community-twitch-eventsub.service';
import { CommunityTwitchIdentityService } from './twitch/community-twitch-identity.service';
import { DiscordMembershipPeriodEntry } from './entities/discord-membership-period.entry';
import { UserAchievementEntry } from './entities/user-achievement.entry';
import { UserTitleEntry } from './entities/user-title.entry';
import { XpTransactionEntry } from './entities/xp-transaction.entry';

@Module({
  imports: [
    TwitchModule,
    UsersModule,
    TypeOrmModule.forFeature([
      CommunityAchievementConditionEntry,
      CommunityAchievementEntry,
      CommunityEventEntry,
      CommunityEventRuleEntry,
      CommunityDiscordAssignedRoleEntry,
      CommunityDiscordRoleEntry,
      CommunityLevelEntry,
      CommunityPinnedAchievementEntry,
      CommunityProfileEntry,
      CommunityTitleEntry,
      CommunityTwitchIdentityEntry,
      CommunityTwitchLinkStateEntry,
      DiscordMembershipPeriodEntry,
      UserAchievementEntry,
      UserTitleEntry,
      XpTransactionEntry,
    ]),
  ],
  providers: [
    CommunityBalancingDefaultsService,
    CommunityDiscordRoleDefinitionService,
    CommunityDiscordUserRoleResolverService,
    CommunityEventRuleService,
    CommunityEventService,
    CommunityProfileCustomizationService,
    CommunityProgressionDefinitionService,
    CommunityProgressionService,
    CommunityRewardSyncService,
    CommunityService,
    CommunityTwitchEventSubService,
    CommunityTwitchIdentityService,
    DiscordBotService,
    DiscordCommunityService,
    DiscordPublicCommunityService,
    DiscordRoleProvisioningService,
    DiscordRoleSyncService,
  ],
  exports: [
    CommunityBalancingDefaultsService,
    CommunityDiscordRoleDefinitionService,
    CommunityEventRuleService,
    CommunityEventService,
    CommunityProfileCustomizationService,
    CommunityProgressionDefinitionService,
    CommunityProgressionService,
    CommunityService,
    CommunityTwitchEventSubService,
    CommunityTwitchIdentityService,
    DiscordBotService,
    DiscordCommunityService,
    DiscordRoleProvisioningService,
  ],
})
export class CommunityModule {}
