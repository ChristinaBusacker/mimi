import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContentModule } from '../content/content.module';
import { MusicAlbumTranslationEntry } from './entities/music-album-translation.entry';
import { MusicAlbumEntry } from './entities/music-album.entry';
import { MusicTrackTranslationEntry } from './entities/music-track-translation.entry';
import { MusicTrackEntry } from './entities/music-track.entry';
import { MusicController } from './music.controller';
import { MusicService } from './music.service';

@Module({
  imports: [
    ContentModule,
    TypeOrmModule.forFeature([
      MusicAlbumEntry,
      MusicAlbumTranslationEntry,
      MusicTrackEntry,
      MusicTrackTranslationEntry,
    ]),
  ],
  controllers: [MusicController],
  providers: [MusicService],
  exports: [MusicService],
})
export class MusicModule {}
