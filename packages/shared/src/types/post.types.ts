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
}

export interface PostDetailDto extends PostDto {
  comments: CommentDto[];
}

// Comment types
export interface CommentDto {
  id: string;
  content: string;
  createdAt: string;
  isDeleted: boolean;
  author: UserDto;
}
