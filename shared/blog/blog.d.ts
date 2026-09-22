export type BlogPublicationStatus =
  | 'draft'
  | 'published';

export interface BlogAuthor {
  slug: string;
  displayName: string;
  bio: string;
  avatarAssetId: string | null;
}

export interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverAssetId: string | null;
  publishedAt: string;
  author: BlogAuthor;
}

export interface BlogPost extends BlogPostSummary {
  contentHtml: string;
}
