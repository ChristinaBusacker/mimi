import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommunityService } from './community.service';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { DiscordMembershipPeriodEntry } from './entities/discord-membership-period.entry';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunityProfileEntry,
      DiscordMembershipPeriodEntry,
    ]),
  ],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
