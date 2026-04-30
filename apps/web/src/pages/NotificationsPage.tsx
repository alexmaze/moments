import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellOff, Check } from 'lucide-react';
import { useNotifications, useMarkAllNotificationsRead, useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useScrollContainer } from '@/components/layout/ScrollContainerContext';
import { NotificationListItem } from '@/components/notifications/NotificationListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

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
    <div className="pb-6">
      {unreadCount > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleMarkAllRead}
            disabled={markAllRead.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {t('markAllRead')}
          </button>
        </div>
      )}

      <SegmentedControl
        className="mb-4"
        ariaLabel={t('all')}
        options={[
          { value: 'all', label: t('all') },
          { value: 'unread', label: t('unread') },
        ]}
        value={filter}
        onValueChange={setFilter}
      />

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
        <EmptyState
          icon={BellOff}
          title={filter === 'unread' ? t('emptyRead') : t('empty')}
        />
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
