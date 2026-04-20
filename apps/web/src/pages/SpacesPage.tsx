import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useInfiniteSpaces } from '@/hooks/useSpaces';
import { useScrollContainer } from '@/components/layout/ScrollContainerContext';
import { SpaceCard } from '@/components/spaces/SpaceCard';
import { CreateSpaceDialog } from '@/components/spaces/CreateSpaceDialog';

export default function SpacesPage() {
  const { t } = useTranslation('spaces');
  const [createOpen, setCreateOpen] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteSpaces();

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

  const spaces = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t('create.submit')}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-xl border border-border surface-card"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && spaces.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            {t('list.empty')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('list.emptySubtitle')}
          </p>
        </div>
      )}

      {/* Space grid */}
      {spaces.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {spaces.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasNextPage && <div ref={sentinelRef} className="h-10" />}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Create dialog */}
      <CreateSpaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
