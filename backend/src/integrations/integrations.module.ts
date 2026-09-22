import { Module } from '@nestjs/common';

import { CacheModule } from './cache/cache.module';
import { EventsModule } from './events/events.module';
import { SteamModule } from './steam/steam.module';
import { TwitchModule } from './twitch/twitch.module';
import { YouTubeModule } from './youtube/youtube.module';

@Module({
  imports: [
    CacheModule,
    EventsModule,
    YouTubeModule,
    TwitchModule,
    SteamModule,
  ],
  exports: [
    CacheModule,
    TwitchModule,
    SteamModule,
  ],
})
export class IntegrationsModule {}
