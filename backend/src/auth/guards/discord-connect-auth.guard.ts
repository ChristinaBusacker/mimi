import type { AuthenticatedUser } from '@shared/auth/authenticated-user';

import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import type { SessionRequest } from '../types/authenticated-request';

type DiscordConnectSessionRequest =
  SessionRequest & {
    accountUser?:
      AuthenticatedUser;
  };

@Injectable()
export class DiscordConnectAuthGuard
  extends AuthGuard(
    'discord-connect',
  )
{
  override async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<
        DiscordConnectSessionRequest
      >();

    if (!request.user) {
      throw new UnauthorizedException();
    }

    request.accountUser =
      request.user;

    return Boolean(
      await super.canActivate(
        context,
      ),
    );
  }
}
