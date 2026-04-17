import type { UserDto, PostMediaDto } from './index';

// Post types
export interface PostDto {
  id: string;
  content: string | null;
  createdAt: string;
  author: UserDto;
  media: PostMediaDto[];
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  /** First ≤10 non-deleted comments, oldest-first. Always present ([] when none). */
  comments: CommentDto[];
  /** true when commentCount > preview comments length, i.e., there are more to load. */
  hasMoreComments: boolean;
}

export interface PostDetailDto extends PostDto {}

// Comment types
export interface CommentDto {
  id: string;
  content: string;
  createdAt: string;
  isDeleted: boolean;
  author: UserDto;
}
