import {
  Module,
} from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommunityAccountController } from './community-account.controller';
import { CommunityDashboardService } from './community-dashboard.service';
import { CommunityPublicController } from './community-public.controller';
import { CommunityModule } from './community.module';
import { CommunityTwitchController } from './twitch/community-twitch.controller';
import { CommunityTwitchEventSubController } from './twitch/community-twitch-eventsub.controller';

@Module({
  imports: [
    AuthModule,
    CommunityModule,
  ],
  controllers: [
    CommunityAccountController,
    CommunityPublicController,
    CommunityTwitchController,
    CommunityTwitchEventSubController,
  ],
  providers: [
    CommunityDashboardService,
  ],
})
export class CommunityAccountModule {}
