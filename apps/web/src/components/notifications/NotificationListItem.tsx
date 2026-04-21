import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { User, Music } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { markNotificationReadApi } from '@/api/notifications.api';
import { useScrollContainer } from '@/components/layout/ScrollContainerContext';
import type { NotificationItemDto } from '@/types/dto';
import { cn } from '@/lib/utils';

interface NotificationListItemProps {
  notification: NotificationItemDto;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function PostPreview({ post }: { post: NonNullable<NotificationItemDto['post']> }) {
  if (post.firstMedia) {
    return (
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        {post.firstMedia.type === 'video' && post.firstMedia.coverUrl ? (
          <img
            src={post.firstMedia.coverUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : post.firstMedia.type === 'image' ? (
          <img
            src={post.firstMedia.publicUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>
    );
  }

  if (post.content) {
    return (
      <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 p-1.5 overflow-hidden">
        <p className="text-[10px] text-muted-foreground leading-tight line-clamp-3">
          {post.content}
        </p>
      </div>
    );
  }

  if (post.audio) {
    return (
      <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
        <Music className="w-5 h-5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">
          {formatDuration(post.audio.durationMs)}
        </span>
      </div>
    );
  }

  return (
    <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0" />
  );
}

export function NotificationListItem({ notification }: NotificationListItemProps) {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const scrollRoot = useScrollContainer();
  const itemRef = useRef<HTMLButtonElement>(null);
  const hasMarkedRef = useRef(false);

  useEffect(() => {
    if (notification.isRead || hasMarkedRef.current) return;
    if (!itemRef.current || !scrollRoot) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasMarkedRef.current) {
          hasMarkedRef.current = true;
          markNotificationReadApi(notification.id);
          observer.disconnect();
        }
      },
      { root: scrollRoot, threshold: 0.5 },
    );

    observer.observe(itemRef.current);
    return () => observer.disconnect();
  }, [notification.id, notification.isRead, scrollRoot]);

  const handleClick = () => {
    if (!notification.navigationTarget) {
      toast.error(t('contentUnavailable'));
      return;
    }

    const { postId, commentId } = notification.navigationTarget;
    const url = commentId ? `/posts/${postId}?commentId=${commentId}` : `/posts/${postId}`;
    navigate(url);
  };

  const getNotificationText = () => {
    const actor = notification.latestActor?.displayName ?? t('types.someone');
    const count = notification.actorCount;

    switch (notification.type) {
      case 'mention_in_post':
        return t('types.mention_in_post', { actor });
      case 'mention_in_comment':
        return t('types.mention_in_comment', { actor });
      case 'comment_on_post':
        return t('types.comment_on_post', { actor });
      case 'reply_to_comment':
        return t('types.reply_to_comment', { actor });
      case 'like_on_post':
        if (count > 1) {
          return t('types.like_on_post_many', { actor, count });
        }
        return t('types.like_on_post_one', { actor });
      default:
        return '';
    }
  };

  const renderAvatars = () => {
    if (notification.type === 'like_on_post' && notification.actorsPreview.length > 1) {
      const avatars = notification.actorsPreview.slice(0, 3);
      return (
        <div className="flex -space-x-2">
          {avatars.map((actor, idx) => (
            <div
              key={actor.id}
              className="relative w-8 h-8 rounded-full border-2 border-card overflow-hidden"
              style={{ zIndex: 3 - idx }}
            >
              {actor.avatarUrl ? (
                <img
                  src={actor.avatarUrl}
                  alt={actor.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    const actor = notification.latestActor;
    if (!actor) return null;

    return (
      <div className="w-10 h-10 rounded-full overflow-hidden">
        {actor.avatarUrl ? (
          <img
            src={actor.avatarUrl}
            alt={actor.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>
    );
  };

  return (
    <button
      ref={itemRef}
      onClick={handleClick}
      className={cn(
        'w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-accent/50',
        !notification.isRead && 'bg-primary/5',
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{renderAvatars()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">{getNotificationText()}</p>
        {notification.contentPreview && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {notification.contentPreview}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {formatRelativeTime(notification.lastEventAt)}
        </p>
      </div>
      {notification.post && <PostPreview post={notification.post} />}
      {!notification.isRead && (
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
      )}
    </button>
  );
}
