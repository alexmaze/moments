import type { UserDto, PostMediaDto } from './index';
import type { PostSpaceDto } from './space.types';

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
  /** Compact space info when the post belongs to a space, null for standalone posts */
  space: PostSpaceDto | null;
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
