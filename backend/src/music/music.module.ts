import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { MusicAlbumTranslationEntry } from './entities/music-album-translation.entry';
import { MusicAlbumEntry } from './entities/music-album.entry';
import { MusicTrackTranslationEntry } from './entities/music-track-translation.entry';
import { MusicTrackEntry } from './entities/music-track.entry';
import { MusicAdminController } from './music-admin.controller';
import { MusicAdminService } from './music-admin.service';
import { MusicController } from './music.controller';
import { MusicService } from './music.service';

@Module({
  imports: [
    AssetsModule,
    AuthModule,
    ContentModule,
    TypeOrmModule.forFeature([
      MusicAlbumEntry,
      MusicAlbumTranslationEntry,
      MusicTrackEntry,
      MusicTrackTranslationEntry,
    ]),
  ],
  controllers: [
    MusicController,
    MusicAdminController,
  ],
  providers: [
    MusicService,
    MusicAdminService,
  ],
  exports: [MusicService],
})
export class MusicModule {}
