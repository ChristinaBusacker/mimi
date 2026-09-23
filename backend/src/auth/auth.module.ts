import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthSessionService } from './auth-session.service';
import { AuthService } from './auth.service';
import { AuthSessionEntry } from './entities/auth-session.entry';
import { PasswordResetTokenEntry } from './entities/password-reset-token.entry';
import { AdminGuard } from './guards/admin.guard';
import { ContributorGuard } from './guards/contributor.guard';
import { PasswordResetService } from './password-reset.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { DiscordStrategy } from './strategies/discord.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    UsersModule,
    MailModule,
    TypeOrmModule.forFeature([
      AuthSessionEntry,
      PasswordResetTokenEntry,
    ]),
    PassportModule.register({
      session: false,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    PasswordResetService,
    LocalStrategy,
    DiscordStrategy,
    SessionAuthGuard,
    AdminGuard,
    ContributorGuard,
  ],
  exports: [
    AuthService,
    AuthSessionService,
    SessionAuthGuard,
    AdminGuard,
    ContributorGuard,
  ],
})
export class AuthModule {}
