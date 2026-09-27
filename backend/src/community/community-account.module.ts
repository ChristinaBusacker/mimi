import {
  Module,
} from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommunityAccountController } from './community-account.controller';
import { CommunityDashboardService } from './community-dashboard.service';
import { CommunityModule } from './community.module';

@Module({
  imports: [
    AuthModule,
    CommunityModule,
  ],
  controllers: [
    CommunityAccountController,
  ],
  providers: [
    CommunityDashboardService,
  ],
})
export class CommunityAccountModule {}
