export type UserRole =
  | 'user'
  | 'author'
  | 'editor'
  | 'admin';

export interface AuthenticatedUser {
  uuid: string;
  name: string;
  email: string | null;
  discordId: string | null;
  role: UserRole;
}
