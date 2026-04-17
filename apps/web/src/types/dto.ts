export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

export interface UserProfileDto extends UserDto {
  postCount: number;
}

export interface PostMediaDto {
  id: string;
  type: 'image' | 'video';
  publicUrl: string;
  coverUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSecs: number | null;
  sortOrder: number;
}

export interface PostDto {
  id: string;
  content: string | null;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  media: PostMediaDto[];
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
}

export interface CommentDto {
  id: string;
  content: string;
  createdAt: string;
  isDeleted: boolean;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export interface PagePaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}
