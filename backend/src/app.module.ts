import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { LocalizationsModule } from './localizations/localizations.module';
import { MigrationsModule } from './migrations/migrations.module';
import { IntegrationsModule } from './integrations/integrations.module';
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
    LocalizationsModule,
    MigrationsModule,
    IntegrationsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
