import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { DiscordStrategy } from './strategies/discord.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({
      session: false,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, DiscordStrategy],
  exports: [AuthService],
})
export class AuthModule {}
