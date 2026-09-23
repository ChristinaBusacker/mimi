import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AssetsModule } from './assets/assets.module';
import { BlogModule } from './blog/blog.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { LocalizationsModule } from './localizations/localizations.module';
import { MailModule } from './mail/mail.module';
import { MigrationsModule } from './migrations/migrations.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { GamingModule } from './gaming/gaming.module';
import { MusicModule } from './music/music.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    UsersModule,
    AuthModule,
    AssetsModule,
    BlogModule,
    LocalizationsModule,
    MailModule,
    MigrationsModule,
    IntegrationsModule,
    GamingModule,
    MusicModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
