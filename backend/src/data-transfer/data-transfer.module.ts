import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { MusicAlbumEntry } from '../music/entities/music-album.entry';
import { MusicModule } from '../music/music.module';
import { SitePageEntry } from '../pages/entities/site-page.entry';
import { SitePagesModule } from '../pages/site-pages.module';
import { AssetEntry } from '../assets/entities/asset.entry';
import { ComposerArchiveController } from './composer-archive.controller';
import { ComposerArchiveService } from './composer-archive.service';
import { ComposerArchiveImportService } from './composer-archive-import.service';
import { DataTransferController } from './data-transfer.controller';
import { DataTransferService } from './data-transfer.service';

@Module({
  controllers: [DataTransferController, ComposerArchiveController],
  providers: [DataTransferService, ComposerArchiveService, ComposerArchiveImportService],
  exports: [DataTransferService],
  imports: [
    AuthModule,
    AssetsModule,
    SitePagesModule,
    MusicModule,
    TypeOrmModule.forFeature([SitePageEntry, MusicAlbumEntry, AssetEntry]),
  ],
})
export class DataTransferModule {}
