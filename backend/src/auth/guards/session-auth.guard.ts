import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { UsersService } from '../../users/users.service';
import { AuthSessionService } from '../auth-session.service';
import { AuthService } from '../auth.service';
import { readSessionCookie } from '../session-cookie';
import type { SessionRequest } from '../types/authenticated-request';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: AuthSessionService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const token = readSessionCookie(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    const userUuid = await this.sessions.resolveUserUuid(token);

    if (!userUuid) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findByUuid(userUuid);

    if (!user) {
      await this.sessions.revoke(token);

      throw new UnauthorizedException();
    }

    request.user = this.authService.toAuthenticatedUser(user);

    return true;
  }
}
