import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { YouTubeController } from './youtube.controller';
import { YouTubeService } from './youtube.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule, EventsModule],
  controllers: [YouTubeController],
  providers: [YouTubeService],
})
export class YouTubeModule {}
