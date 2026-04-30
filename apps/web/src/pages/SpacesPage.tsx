import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Plus } from 'lucide-react';
import { useInfiniteSpaces } from '@/hooks/useSpaces';
import { useScrollContainer } from '@/components/layout/ScrollContainerContext';
import { SpaceCard } from '@/components/spaces/SpaceCard';
import { CreateSpaceDialog } from '@/components/spaces/CreateSpaceDialog';
import { EmptyState } from '@/components/ui/EmptyState';

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
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-border surface-card p-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/15 bg-primary/10 text-primary shadow-sm">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t('list.description')}</p>
          </div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
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
        <EmptyState
          icon={Layers}
          title={t('list.empty')}
          description={t('list.emptySubtitle')}
          action={
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t('create.submit')}
            </button>
          }
        />
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
