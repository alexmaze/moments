import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getTagsApi, getTagPostsApi } from '@/api/tags.api';

export const tagKeys = {
  all: ['tags'] as const,
  list: (q?: string) => [...tagKeys.all, 'list', q] as const,
  posts: (name: string, sort: 'latest' | 'hot') => [...tagKeys.all, 'posts', name, sort] as const,
};

export function useTags(q?: string, limit = 10) {
  return useQuery({
    queryKey: tagKeys.list(q),
    queryFn: () => getTagsApi(q, limit),
    enabled: !!q,
    staleTime: 60 * 1000,
  });
}

export function useTagPosts(name: string, sort: 'latest' | 'hot' = 'latest') {
  return useInfiniteQuery({
    queryKey: tagKeys.posts(name, sort),
    queryFn: ({ pageParam }) => getTagPostsApi(name, pageParam, 20, sort),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.posts.meta.nextCursor ?? undefined,
    enabled: !!name,
    staleTime: 60 * 1000,
  });
}