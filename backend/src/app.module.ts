import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AssetsModule } from './assets/assets.module';
import { BlogModule } from './blog/blog.module';
import { CommunityAdminModule } from './community/community-admin.module';
import { CommunityAccountModule } from './community/community-account.module';
import { CommunityModule } from './community/community.module';
import { DatabaseModule } from './database/database.module';
import { DataTransferModule } from './data-transfer/data-transfer.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { LocalizationsModule } from './localizations/localizations.module';
import { MailModule } from './mail/mail.module';
import { MigrationsModule } from './migrations/migrations.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { GamingModule } from './gaming/gaming.module';
import { MusicModule } from './music/music.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PushModule } from './push/push.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    DataTransferModule,
    UsersModule,
    AuthModule,
    AssetsModule,
    BlogModule,
    CommunityModule,
    CommunityAdminModule,
    CommunityAccountModule,
    LocalizationsModule,
    MailModule,
    MigrationsModule,
    IntegrationsModule,
    GamingModule,
    MusicModule,
    NotificationsModule,
    PushModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
