import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { NotificationPreferenceEntry } from './entities/notification-preference.entry';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    AuthModule,
    PushModule,
    TypeOrmModule.forFeature([
      NotificationPreferenceEntry,
    ]),
  ],
  controllers: [
    NotificationsController,
  ],
  providers: [
    NotificationDispatchService,
    NotificationPreferencesService,
  ],
  exports: [
    NotificationDispatchService,
    NotificationPreferencesService,
  ],
})
export class NotificationsModule {}
