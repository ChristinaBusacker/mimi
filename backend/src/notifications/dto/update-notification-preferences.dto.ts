import type {
  NotificationLocale,
  UpdateNotificationPreferences,
} from '@shared/notifications/notifications';

import {
  IsBoolean,
  IsIn,
} from 'class-validator';

export class UpdateNotificationPreferencesDto
  implements UpdateNotificationPreferences
{
  @IsBoolean()
  streams!: boolean;

  @IsBoolean()
  music!: boolean;

  @IsBoolean()
  blog!: boolean;

  @IsBoolean()
  personal!: boolean;

  @IsIn([
    'de',
    'en',
  ] satisfies NotificationLocale[])
  locale!: NotificationLocale;
}
