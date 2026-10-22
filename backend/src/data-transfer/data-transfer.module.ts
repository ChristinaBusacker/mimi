import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { MusicAlbumEntry } from '../music/entities/music-album.entry';
import { SitePageEntry } from '../pages/entities/site-page.entry';
import { ComposerArchiveController } from './composer-archive.controller';
import { ComposerArchiveService } from './composer-archive.service';
import { DataTransferController } from './data-transfer.controller';
import { DataTransferService } from './data-transfer.service';

@Module({
  controllers: [DataTransferController, ComposerArchiveController],
  providers: [DataTransferService, ComposerArchiveService],
  exports: [DataTransferService],
  imports: [
    AuthModule,
    AssetsModule,
    TypeOrmModule.forFeature([SitePageEntry, MusicAlbumEntry]),
  ],
})
export class DataTransferModule {}
