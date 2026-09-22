import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { EventsModule } from '../events/events.module';

import { TwitchController } from './twitch.controller';
import { TwitchService } from './twitch.service';

@Module({
  imports: [CacheModule, EventsModule],
  controllers: [TwitchController],
  providers: [TwitchService],
  exports: [TwitchService],
})
export class TwitchModule {}
