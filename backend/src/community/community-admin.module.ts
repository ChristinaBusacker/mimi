import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DataTransferModule } from '../data-transfer/data-transfer.module';
import { CommunityAdminController } from './community-admin.controller';
import { CommunitySettingsDataTransferProvider } from './community-settings-data-transfer.provider';
import { CommunityModule } from './community.module';

@Module({
  imports: [
    AuthModule,
    CommunityModule,
    DataTransferModule,
  ],
  controllers: [
    CommunityAdminController,
  ],
  providers: [
    CommunitySettingsDataTransferProvider,
  ],
})
export class CommunityAdminModule {}
