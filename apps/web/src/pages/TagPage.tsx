import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTagPosts } from '@/hooks/useTags';
import PostCard from '@/components/feed/PostCard';
import { ArrowLeft, Hash } from 'lucide-react';
import type { PostDto } from '@/types/dto';

export default function TagPage() {
  const { name } = useParams<{ name: string }>();
  const { t } = useTranslation('tags');
  const [sort, setSort] = useState<'latest' | 'hot'>('latest');

  const decodedName = name ? decodeURIComponent(name) : '';
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTagPosts(decodedName, sort);

  const tag = data?.pages[0]?.tag;
  const posts = data?.pages.flatMap((p) => p.posts.data) ?? [];

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 hover:bg-muted rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Hash className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">{decodedName}</h1>
        </div>
      </div>

      {tag && (
        <p className="text-muted-foreground text-sm ml-9">
          {t('postCount', { count: tag.postCount })}
        </p>
      )}

      <div className="flex gap-2 ml-9">
        <button
          onClick={() => setSort('latest')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            sort === 'latest'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          {t('sort.latest')}
        </button>
        <button
          onClick={() => setSort('hot')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            sort === 'hot'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          {t('sort.hot')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : isError ? (
        <div className="text-center py-8 text-muted-foreground">
          {t('error.loadFailed')}
        </div>
      ) : !tag ? (
        <div className="text-center py-8 text-muted-foreground">
          {t('error.notFound')}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post: PostDto) => (
            <PostCard key={post.id} post={post} />
          ))}

          <div ref={sentinelRef} className="h-4" />

          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}