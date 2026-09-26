import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommunityEventRuleService } from './community-event-rule.service';
import { CommunityEventService } from './community-event.service';
import { CommunityService } from './community.service';
import { CommunityEventEntry } from './entities/community-event.entry';
import { CommunityEventRuleEntry } from './entities/community-event-rule.entry';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { DiscordMembershipPeriodEntry } from './entities/discord-membership-period.entry';
import { XpTransactionEntry } from './entities/xp-transaction.entry';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunityEventEntry,
      CommunityEventRuleEntry,
      CommunityProfileEntry,
      DiscordMembershipPeriodEntry,
      XpTransactionEntry,
    ]),
  ],
  providers: [
    CommunityEventRuleService,
    CommunityEventService,
    CommunityService,
  ],
  exports: [
    CommunityEventRuleService,
    CommunityEventService,
    CommunityService,
  ],
})
export class CommunityModule {}
