export type UserRole = 'user' | 'admin';

export interface AuthenticatedUser {
  uuid: string;
  name: string;
  email: string;
  discordId: string | null;
  role: UserRole;
}
