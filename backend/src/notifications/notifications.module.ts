import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { TwitchModule } from '../integrations/twitch/twitch.module';
import { PushModule } from '../push/push.module';
import { NotificationDeliveryEntry } from './entities/notification-delivery.entry';
import { NotificationEventEntry } from './entities/notification-event.entry';
import { NotificationPreferenceEntry } from './entities/notification-preference.entry';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationEventHandlerService } from './notification-event-handler.service';
import { NotificationEventsModule } from './notification-events.module';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsController } from './notifications.controller';
import { StreamNotificationService } from './stream-notification.service';

@Module({
  imports: [
    AuthModule,
    NotificationEventsModule,
    PushModule,
    TwitchModule,
    TypeOrmModule.forFeature([
      NotificationDeliveryEntry,
      NotificationEventEntry,
      NotificationPreferenceEntry,
    ]),
  ],
  controllers: [
    NotificationsController,
  ],
  providers: [
    NotificationDeliveryService,
    NotificationDispatchService,
    NotificationEventHandlerService,
    NotificationPreferencesService,
    StreamNotificationService,
  ],
  exports: [
    NotificationDispatchService,
    NotificationPreferencesService,
  ],
})
export class NotificationsModule {}
