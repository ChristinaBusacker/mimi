import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { DataTransferModule } from '../data-transfer/data-transfer.module';
import { LocalizationEntry } from './entities/localization.entry';
import { LocalizationDataTransferProvider } from './localization-data-transfer.provider';
import { LocalizationsController } from './localizations.controller';
import { LocalizationsService } from './localizations.service';

@Module({
  imports: [
    AuthModule,
    DataTransferModule,
    TypeOrmModule.forFeature([LocalizationEntry]),
  ],
  controllers: [LocalizationsController],
  providers: [
    LocalizationDataTransferProvider,
    LocalizationsService,
  ],
  exports: [LocalizationsService],
})
export class LocalizationsModule {}
