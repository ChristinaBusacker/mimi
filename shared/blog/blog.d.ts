export type BlogPublicationStatus =
  | 'draft'
  | 'published';

export interface BlogAuthor {
  slug: string;
  displayName: string;
  avatarAssetId: string | null;
}

export interface BlogAuthorProfile
  extends BlogAuthor
{
  bioHtml: string;
}

export interface BlogCategory {
  slug: string;
  name: string;
}

export interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverAssetId: string | null;
  publishedAt: string;
  author: BlogAuthor;
  categories: BlogCategory[];
}

export interface BlogPost
  extends Omit<
    BlogPostSummary,
    'author'
  >
{
  author: BlogAuthorProfile;
  contentHtml: string;
}

export interface BlogAuthorPage {
  author: BlogAuthorProfile;
  posts: BlogPostSummary[];
}
