import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Newspaper } from 'lucide-react';
import { useInfiniteFeed } from '@/hooks/usePosts';
import { useScrollContainer } from '@/components/layout/ScrollContainerContext';
import { EmptyState } from '@/components/ui/EmptyState';
import PostCard from './PostCard';

export default function FeedList() {
  const { t } = useTranslation('feed');
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteFeed();

  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRoot = useScrollContainer();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !scrollRoot) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: scrollRoot, threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, scrollRoot]);

  const posts = data?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="surface-card rounded-xl shadow-sm border border-border p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-2 bg-muted rounded w-16" />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={CircleAlert}
        title={t('error')}
        variant="compact"
      />
    );
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title={t('empty.title')}
        description={t('empty.subtitle')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-4" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
