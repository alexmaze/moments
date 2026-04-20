export interface TagDto {
  id: string;
  name: string;
  postCount: number;
  createdAt: string;
}

export interface TagInfo {
  id: string;
  name: string;
  postCount: number;
}

export interface TagPostsResponse {
  tag: TagInfo | null;
  posts: {
    data: import('./post.types').PostDto[];
    meta: {
      hasMore: boolean;
      nextCursor: string | null;
    };
  };
}