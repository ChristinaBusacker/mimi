import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { SitePageEntry } from './entities/site-page.entry';
import { SitePagesAdminController } from './site-pages-admin.controller';
import { SitePagesController } from './site-pages.controller';
import { SitePagesService } from './site-pages.service';

@Module({
  imports: [
    AuthModule,
    AssetsModule,
    TypeOrmModule.forFeature([SitePageEntry]),
  ],
  controllers: [SitePagesController, SitePagesAdminController],
  providers: [SitePagesService],
  exports: [SitePagesService],
})
export class SitePagesModule {}
