export type NotificationType =
  | 'mention_in_post'
  | 'mention_in_comment'
  | 'comment_on_post'
  | 'reply_to_comment'
  | 'like_on_post';

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
