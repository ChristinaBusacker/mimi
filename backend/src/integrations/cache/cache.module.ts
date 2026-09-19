import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheEntry } from './entities/cache.entry';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([CacheEntry])],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
