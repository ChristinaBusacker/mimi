export interface BlogCommentAuthor {
  displayName: string;
  profileColor: string | null;
}

export interface BlogComment {
  id: string;
  postId: string;
  content: string;
  author: BlogCommentAuthor;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogComment {
  content: string;
}

export interface BlogAdminComment extends BlogComment {
  postSlug: string;
  hidden: boolean;
}

export interface SetBlogCommentFlag {
  value: boolean;
}
