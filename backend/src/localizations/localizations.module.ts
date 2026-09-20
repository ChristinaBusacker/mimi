import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { LocalizationEntry } from './entities/localization.entry';
import { LocalizationsController } from './localizations.controller';
import { LocalizationsService } from './localizations.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([LocalizationEntry]),
  ],
  controllers: [LocalizationsController],
  providers: [LocalizationsService],
  exports: [LocalizationsService],
})
export class LocalizationsModule {}
