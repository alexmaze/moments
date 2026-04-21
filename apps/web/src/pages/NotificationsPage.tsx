import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { useNotifications, useMarkAllNotificationsRead, useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useScrollContainer } from '@/components/layout/ScrollContainerContext';
import { NotificationListItem } from '@/components/notifications/NotificationListItem';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const { t } = useTranslation('notifications');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useNotifications(filter);

  const { data: unreadData } = useUnreadNotificationCount();
  const markAllRead = useMarkAllNotificationsRead();

  const scrollRoot = useScrollContainer();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !scrollRoot) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        { root: scrollRoot, rootMargin: '200px' },
      );
      observerRef.current.observe(node);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage, scrollRoot],
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  const notifications = data?.pages.flatMap((page) => page.data) ?? [];
  const unreadCount = unreadData?.count ?? 0;

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markAllRead.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {t('markAllRead')}
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          {t('all')}
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            filter === 'unread'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          {t('unread')}
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-border surface-card"
            />
          ))}
        </div>
      )}

      {!isLoading && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            {filter === 'unread' ? t('emptyRead') : t('empty')}
          </p>
        </div>
      )}

      {notifications.length > 0 && (
        <div className="rounded-xl border border-border surface-card overflow-hidden divide-y divide-border">
          {notifications.map((notification) => (
            <NotificationListItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}

      {hasNextPage && <div ref={sentinelRef} className="h-10" />}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
