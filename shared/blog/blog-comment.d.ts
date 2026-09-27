export interface BlogCommentAuthor {
  displayName: string;
  profileColor: string | null;
}

export interface BlogComment {
  id: string;
  postId: string;
  content: string;
  author: BlogCommentAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogComment {
  content: string;
}
