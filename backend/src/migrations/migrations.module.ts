import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocalizationEntry } from '../localizations/entities/localization.entry';
import { MigrationEntry } from './entities/migration.entry';
import { MigrationService } from './migrations.service';

@Module({
  imports: [TypeOrmModule.forFeature([MigrationEntry, LocalizationEntry])],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationsModule {}
