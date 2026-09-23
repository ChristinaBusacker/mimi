import type { AuthenticatedUser } from '@shared/auth/authenticated-user';

import type { Request } from 'express';

import type { DiscordIdentity } from './discord-identity';

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

export type SessionRequest = Request & {
  user?: AuthenticatedUser;
};

export type DiscordConnectRequest = Request & {
  accountUser: AuthenticatedUser;
  user: DiscordIdentity;
};
