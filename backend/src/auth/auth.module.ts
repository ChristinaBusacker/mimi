import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthSessionService } from './auth-session.service';
import { AuthService } from './auth.service';
import { AuthSessionEntry } from './entities/auth-session.entry';
import { AdminGuard } from './guards/admin.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { DiscordStrategy } from './strategies/discord.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([AuthSessionEntry]),
    PassportModule.register({
      session: false,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    LocalStrategy,
    DiscordStrategy,
    SessionAuthGuard,
    AdminGuard,
  ],
  exports: [
    AuthService,
    AuthSessionService,
    SessionAuthGuard,
    AdminGuard,
  ],
})
export class AuthModule {}
