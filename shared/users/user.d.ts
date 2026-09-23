import type { UserRole } from '../auth/authenticated-user';

export interface ManagedUserProfile {
  slug: string;
  displayName: string;
  bio: string;
  avatarAssetId: string | null;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  discordId: string | null;
  role: UserRole;
  profile: ManagedUserProfile | null;
}

export interface SaveManagedUser {
  role: UserRole;
  slug: string | null;
  displayName: string | null;
}

export interface OwnProfile extends ManagedUserProfile {
  userId: string;
}

export interface SaveOwnProfile {
  bio: string;
  avatarAssetId: string | null;
}
