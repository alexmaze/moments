export type SupportedLocale = 'en' | 'zh-CN';

export type SupportedTheme = 'light' | 'dark';

export type SpaceType = 'general' | 'baby';
export type SpaceMemberRole = 'owner' | 'admin' | 'member';

export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  locale: SupportedLocale | null;
  theme: SupportedTheme | null;
  background: string | null;
  createdAt: string;
}

export interface UserProfileDto extends UserDto {
  postCount: number;
}

export interface MentionUserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
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
  /** Compact space info when the post belongs to a space, null for standalone posts */
  space: {
    id: string;
    name: string;
    slug: string;
    type: SpaceType;
    isMember: boolean;
  } | null;
  /** First ≤10 non-deleted comments, oldest-first. */
  comments: CommentDto[];
  /** true when there are more comments beyond the preview. */
  hasMoreComments: boolean;
  tags: string[];
  /** Users mentioned in the post content */
  mentions: MentionUserDto[];
}

export interface ReplyToCommentDto {
  id: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  contentPreview: string;
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
  /** The comment this is replying to, null for top-level comments */
  replyTo: ReplyToCommentDto | null;
  /** Users mentioned in the comment content */
  mentions: MentionUserDto[];
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

// Space types

export interface SpaceDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  coverPositionY: number;
  type: SpaceType;
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  memberCount: number;
  postCount: number;
  createdAt: string;
}

export interface SpaceDetailDto extends SpaceDto {
  /** Current user's membership info, null if not a member */
  myMembership: {
    role: SpaceMemberRole;
    joinedAt: string;
  } | null;
}

export interface SpaceMemberDto {
  id: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  role: SpaceMemberRole;
  joinedAt: string;
}

export interface GrowthRecordDto {
  id: string;
  date: string;
  heightCm: number | null;
  weightKg: number | null;
  headCircumferenceCm: number | null;
  recordedBy: {
    id: string;
    displayName: string;
  };
  createdAt: string;
}
