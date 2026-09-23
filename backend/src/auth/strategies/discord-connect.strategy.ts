import {
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PassportStrategy,
} from '@nestjs/passport';
import { Strategy } from 'passport-dc';

import type { DiscordIdentity } from '../types/discord-identity';

interface DiscordProfile {
  id: string;
  username: string;
}

function getConnectCallbackUrl(
  configService: ConfigService,
): string {
  const configured =
    configService.get<string>(
      'DISCORD_CONNECT_CALLBACK_URL',
    );

  if (configured) {
    return configured;
  }

  const callbackUrl = new URL(
    configService.getOrThrow<string>(
      'DISCORD_CALLBACK_URL',
    ),
  );

  if (
    !callbackUrl.pathname.endsWith(
      '/discord/callback',
    )
  ) {
    throw new Error(
      'DISCORD_CONNECT_CALLBACK_URL is required when DISCORD_CALLBACK_URL does not end with "/discord/callback".',
    );
  }

  callbackUrl.pathname =
    callbackUrl.pathname.replace(
      /\/discord\/callback$/,
      '/discord/connect/callback',
    );

  return callbackUrl.toString();
}

@Injectable()
export class DiscordConnectStrategy
  extends PassportStrategy(
    Strategy,
    'discord-connect',
  )
{
  constructor(
    configService:
      ConfigService,
  ) {
    super({
      clientID:
        configService
          .getOrThrow<string>(
            'DISCORD_CLIENT_ID',
          ),
      clientSecret:
        configService
          .getOrThrow<string>(
            'DISCORD_CLIENT_SECRET',
          ),
      callbackURL:
        getConnectCallbackUrl(
          configService,
        ),
      scope: [
        'identify',
      ],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: DiscordProfile,
  ): DiscordIdentity {
    return {
      id: profile.id,
      username:
        profile.username,
    };
  }
}
