import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-dc';

import { AuthService } from '../auth.service';
import type { AuthenticatedUser } from '@shared/auth/authenticated-user';

interface DiscordProfile {
  id: string;
  username: string;
}

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('DISCORD_CLIENT_ID'),

      clientSecret: configService.getOrThrow<string>('DISCORD_CLIENT_SECRET'),

      callbackURL: configService.getOrThrow<string>('DISCORD_CALLBACK_URL'),

      scope: ['identify'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: DiscordProfile,
  ): Promise<AuthenticatedUser> {
    return this.authService.validateDiscordUser(
      profile.id,
      profile.username,
    );
  }
}
