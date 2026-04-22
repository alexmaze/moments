import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, User } from 'lucide-react';
import { useLikedUsers } from '@/hooks/usePosts';
import { useScrollContainer } from '@/components/layout/ScrollContainerContext';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface LikedUsersListProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LikedUsersList({
  postId,
  open,
  onOpenChange,
}: LikedUsersListProps) {
  const { t } = useTranslation('feed');
  const navigate = useNavigate();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useLikedUsers(postId);

  const scrollRoot = useScrollContainer();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !open) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: listRef.current ?? scrollRoot, threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, scrollRoot, open]);

  const users = data?.pages.flatMap((p) => p.data) ?? [];

  const handleUserClick = useCallback(
    (username: string) => {
      onOpenChange(false);
      navigate(`/users/${username}`);
    },
    [navigate, onOpenChange],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/35',
            'data-[state=open]:animate-[overlay-in_150ms_ease-out]',
            'data-[state=closed]:animate-[overlay-out_150ms_ease-in]',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 w-full',
            'surface-overlay rounded-t-[1.75rem] border border-border border-b-0 shadow-lg',
            'data-[state=open]:animate-[sheet-in_220ms_cubic-bezier(0.22,1,0.36,1)]',
            'data-[state=closed]:animate-[sheet-out_180ms_ease-in]',
            'sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2',
            'sm:rounded-xl sm:border sm:p-0',
            'sm:data-[state=open]:animate-[dialog-in_200ms_ease-out]',
            'sm:data-[state=closed]:animate-[dialog-out_150ms_ease-in]',
            'focus:outline-none',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2 sm:p-4 sm:pb-2">
            <DialogPrimitive.Title className="text-base font-semibold text-foreground">
              {t('likedUsersTitle')}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-lg p-1.5 hover:bg-accent transition-colors text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <X className="w-5 h-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div
            ref={listRef}
            className="overflow-y-auto overscroll-y-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-4 sm:max-h-[60vh]"
          >
            {isLoading && (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-muted rounded w-20" />
                      <div className="h-2 bg-muted rounded w-14" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && users.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('likedUsersCount', { count: 0 })}
              </div>
            )}

            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleUserClick(user.username)}
                className="flex items-center gap-3 w-full py-2.5 text-left hover:bg-accent/50 rounded-lg px-1 transition-colors"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    loading="lazy"
                    decoding="async"
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(user.likedAt)}
                  </p>
                </div>
              </button>
            ))}

            <div ref={sentinelRef} className="h-1" />

            {isFetchingNextPage && (
              <div className="flex justify-center py-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
