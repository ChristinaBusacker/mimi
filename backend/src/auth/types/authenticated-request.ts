import type { AuthenticatedUser } from '@shared/auth/authenticated-user';

import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

export type SessionRequest = Request & {
  user?: AuthenticatedUser;
};
