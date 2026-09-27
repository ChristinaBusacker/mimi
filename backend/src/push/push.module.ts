import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { PushSubscriptionEntry } from './entities/push-subscription.entry';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushTransportService } from './push-transport.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      PushSubscriptionEntry,
    ]),
  ],
  controllers: [PushController],
  providers: [
    PushService,
    PushTransportService,
  ],
  exports: [PushService],
})
export class PushModule {}
