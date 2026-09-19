import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LocalizationEntry } from './entities/localization.entry';
import { LocalizationsController } from './localizations.controller';
import { LocalizationsService } from './localizations.service';

@Module({
  imports: [TypeOrmModule.forFeature([LocalizationEntry])],
  controllers: [LocalizationsController],
  providers: [LocalizationsService],
  exports: [LocalizationsService],
})
export class LocalizationsModule {}
