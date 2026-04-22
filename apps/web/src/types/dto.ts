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
  spaceNickname: string | null;
}

export interface PostMediaDto {
  id: string;
  type: 'image' | 'video';
  publicUrl: string;
  coverUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sortOrder: number;
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
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    spaceNickname: string | null;
  };
  media: PostMediaDto[];
  audio: PostAudioDto | null;
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  /** Compact space info when the post belongs to a space, null for standalone posts */
  space: {
    id: string;
    name: string;
    slug: string;
    type: SpaceType;
    babyBirthday: string | null;
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
    spaceNickname: string | null;
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
    spaceNickname: string | null;
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
  coverMediaId?: string | null;
  coverUrl: string | null;
  coverPositionY: number;
  type: SpaceType;
  babyBirthday: string | null;
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
    spaceNickname: string | null;
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
  spaceNickname: string | null;
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

// Notification types

export type NotificationType = 'mention_in_post' | 'mention_in_comment' | 'comment_on_post' | 'reply_to_comment' | 'like_on_post';

export interface NotificationActorDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface NotificationPostPreviewDto {
  id: string;
  content: string | null;
  firstMedia: {
    type: 'image' | 'video';
    publicUrl: string;
    coverUrl: string | null;
  } | null;
  audio: {
    durationMs: number;
  } | null;
}

export interface NotificationItemDto {
  id: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  lastEventAt: string;
  actorCount: number;
  latestActor: NotificationActorDto | null;
  actorsPreview: NotificationActorDto[];
  post: NotificationPostPreviewDto | null;
  comment: { id: string; contentPreview: string | null } | null;
  replyToComment: { id: string; contentPreview: string | null } | null;
  contentPreview: string | null;
  navigationTarget: { postId: string; commentId?: string } | null;
}

export interface NotificationListResponseDto {
  data: NotificationItemDto[];
  meta: {
    hasMore: boolean;
    nextCursor: string | null;
    unreadCount: number;
  };
}

export interface UnreadNotificationCountDto {
  count: number;
}
