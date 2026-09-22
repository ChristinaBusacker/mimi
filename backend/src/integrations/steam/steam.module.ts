import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { SteamService } from './steam.service';

@Module({
  imports: [CacheModule],
  providers: [SteamService],
  exports: [SteamService],
})
export class SteamModule {}
