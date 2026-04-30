import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { useSpacePosts } from '@/hooks/useSpaces';
import { useScrollContainer } from '@/components/layout/ScrollContainerContext';
import PostCard from '@/components/feed/PostCard';
import QuickComposer from '@/components/composer/QuickComposer';
import { EmptyState } from '@/components/ui/EmptyState';

interface SpacePostsTabProps {
  slug: string;
  spaceId: string;
  spaceName: string;
  isMember: boolean;
}

export function SpacePostsTab({ slug, spaceId, spaceName, isMember }: SpacePostsTabProps) {
  const { t } = useTranslation('spaces');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useSpacePosts(slug);

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

  const posts = data?.pages.flatMap((page) => page.data) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-border surface-card"
          />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="space-y-4">
        {isMember && <QuickComposer fixedSpaceId={spaceId} fixedSpaceName={spaceName} />}
        <EmptyState
          icon={FileText}
          title={t('detail.noPosts')}
          description={isMember ? t('detail.noPostsJoined') : undefined}
          variant="compact"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isMember && <QuickComposer fixedSpaceId={spaceId} fixedSpaceName={spaceName} />}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} variant="feed" />
      ))}

      {hasNextPage && <div ref={sentinelRef} className="h-10" />}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
