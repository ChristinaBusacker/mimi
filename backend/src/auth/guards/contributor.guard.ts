import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { SessionRequest } from '../types/authenticated-request';

@Injectable()
export class ContributorGuard
  implements CanActivate
{
  canActivate(
    context: ExecutionContext,
  ): boolean {
    const request = context
      .switchToHttp()
      .getRequest<SessionRequest>();
    const role = request.user?.role;

    if (
      role !== 'author' &&
      role !== 'editor' &&
      role !== 'admin'
    ) {
      throw new ForbiddenException();
    }

    return true;
  }
}
