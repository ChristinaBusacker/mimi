import { Module } from '@nestjs/common';

import { NotificationEventsService } from './notification-events.service';

@Module({
  providers: [
    NotificationEventsService,
  ],
  exports: [
    NotificationEventsService,
  ],
})
export class NotificationEventsModule {}
