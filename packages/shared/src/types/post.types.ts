import type { PostAuthorDto, PostMediaDto, MentionUserDto } from './index';
import type { PostSpaceDto } from './space.types';

export interface LikedUserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  spaceNickname: string | null;
  likedAt: string;
}

export interface PostAudioDto {
  id: string;
  url: string;
  durationMs: number;
  waveform: number[];
  status: 'ready' | 'uploading' | 'failed';
  mimeType: string | null;
  sizeBytes: number | null;
}

export interface PostDto {
  id: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  author: PostAuthorDto;
  media: PostMediaDto[];
  audio: PostAudioDto | null;
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  /** Compact space info when the post belongs to a space, null for standalone posts */
  space: PostSpaceDto | null;
  /** First ≤10 non-deleted comments, oldest-first. Always present ([] when none). */
  comments: CommentDto[];
  /** true when commentCount > preview comments length, i.e., there are more to load. */
  hasMoreComments: boolean;
  /** Hashtags extracted from content, e.g. ['JavaScript', '前端开发'] */
  tags: string[];
  /** Users mentioned in the post content via @{displayName|userId} */
  mentions: MentionUserDto[];
  /** First 3 likers' displayNames, only populated for detail view */
  likePreview?: string[];
}

export interface PostDetailDto extends PostDto {}

export interface ReplyToCommentDto {
  id: string;
  author: PostAuthorDto;
  contentPreview: string;
}

export interface CommentDto {
  id: string;
  content: string;
  createdAt: string;
  isDeleted: boolean;
  author: PostAuthorDto;
  /** The comment this is replying to, null for top-level comments */
  replyTo: ReplyToCommentDto | null;
  /** Users mentioned in the comment content via @{displayName|userId} */
  mentions: MentionUserDto[];
}
