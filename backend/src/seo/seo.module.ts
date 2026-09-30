import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { AdminSeoController } from './admin-seo.controller';
import { SeoPageOverrideEntry } from './entities/seo-page-override.entry';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  imports: [
    AssetsModule,
    AuthModule,
    TypeOrmModule.forFeature([
      SeoPageOverrideEntry,
    ]),
  ],
  controllers: [
    SeoController,
    AdminSeoController,
  ],
  providers: [SeoService],
})
export class SeoModule {}
