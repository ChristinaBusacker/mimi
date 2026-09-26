import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommunityEventRuleService } from './community-event-rule.service';
import { CommunityEventService } from './community-event.service';
import { CommunityProgressionDefinitionService } from './community-progression-definition.service';
import { CommunityProgressionService } from './community-progression.service';
import { CommunityService } from './community.service';
import { CommunityEventEntry } from './entities/community-event.entry';
import { CommunityAchievementConditionEntry } from './entities/community-achievement-condition.entry';
import { CommunityAchievementEntry } from './entities/community-achievement.entry';
import { CommunityEventRuleEntry } from './entities/community-event-rule.entry';
import { CommunityLevelEntry } from './entities/community-level.entry';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { CommunityTitleEntry } from './entities/community-title.entry';
import { DiscordMembershipPeriodEntry } from './entities/discord-membership-period.entry';
import { UserAchievementEntry } from './entities/user-achievement.entry';
import { UserTitleEntry } from './entities/user-title.entry';
import { XpTransactionEntry } from './entities/xp-transaction.entry';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunityAchievementConditionEntry,
      CommunityAchievementEntry,
      CommunityEventEntry,
      CommunityEventRuleEntry,
      CommunityLevelEntry,
      CommunityProfileEntry,
      CommunityTitleEntry,
      DiscordMembershipPeriodEntry,
      UserAchievementEntry,
      UserTitleEntry,
      XpTransactionEntry,
    ]),
  ],
  providers: [
    CommunityEventRuleService,
    CommunityEventService,
    CommunityProgressionDefinitionService,
    CommunityProgressionService,
    CommunityService,
  ],
  exports: [
    CommunityEventRuleService,
    CommunityEventService,
    CommunityProgressionDefinitionService,
    CommunityProgressionService,
    CommunityService,
  ],
})
export class CommunityModule {}
