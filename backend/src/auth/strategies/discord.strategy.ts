import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-dc';

import { AuthService } from '../auth.service';
import type { AuthenticatedUser } from '@shared/auth/authenticated-user';

interface DiscordProfile {
  id: string;
  username: string;
  email?: string;
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

      scope: ['identify', 'email'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: DiscordProfile,
  ): Promise<AuthenticatedUser> {
    if (!profile.email) {
      throw new UnauthorizedException('Discord did not provide an email address.');
    }

    return this.authService.validateDiscordUser(profile.id, profile.username, profile.email);
  }
}
