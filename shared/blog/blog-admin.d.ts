import type { UserRole } from '../auth/authenticated-user';
import type { BlogPublicationStatus } from './blog';

export type BlogContributorRole =
  | 'author'
  | 'editor';

export interface BlogAdminTranslation {
  title: string;
  excerpt: string;
  contentMarkdown: string;
}

export interface BlogAdminTranslations {
  de: BlogAdminTranslation;
  en: BlogAdminTranslation | null;
}

export interface BlogAdminPost {
  id: string;
  slug: string;
  authorId: string;
  coverAssetId: string | null;
  status: BlogPublicationStatus;
  publishedAt: string | null;
  translations: BlogAdminTranslations;
  createdAt: string;
  updatedAt: string;
}

export interface SaveBlogAdminPost {
  slug: string;
  authorId: string;
  coverAssetId: string | null;
  status: BlogPublicationStatus;
  translations: BlogAdminTranslations;
}

export interface BlogAdminAuthor {
  userId: string;
  slug: string;
  displayName: string;
  bio: string;
  avatarAssetId: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface SaveBlogAdminAuthor {
  slug: string;
  displayName: string;
  bio: string;
  avatarAssetId: string | null;
  role: BlogContributorRole;
}

export interface BlogAdminAuthorCandidate {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  profile: BlogAdminAuthor | null;
}
