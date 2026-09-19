import { Module } from '@nestjs/common';

import { EventsModule } from '../events/events.module';

import { TwitchController } from './twitch.controller';
import { TwitchService } from './twitch.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule, EventsModule],
  controllers: [TwitchController],
  providers: [TwitchService],
})
export class TwitchModule {}
