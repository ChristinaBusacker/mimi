import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommunityAdminController } from './community-admin.controller';
import { CommunityModule } from './community.module';

@Module({
  imports: [
    AuthModule,
    CommunityModule,
  ],
  controllers: [
    CommunityAdminController,
  ],
})
export class CommunityAdminModule {}
