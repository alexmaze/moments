import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  getCommentsApi,
  createCommentApi,
  deleteCommentApi,
} from "@/api/posts.api";
import { postKeys } from "./usePosts";
import { useAuthStore } from "@/store/auth.store";
import type {
  CommentDto,
  PostDto,
  PaginatedResponse,
  PagePaginatedResponse,
} from "@/types/dto";

const COMMENTS_PAGE_SIZE = 10;

export const commentKeys = {
  all: ["comments"] as const,
  list: (postId: string) => [...commentKeys.all, postId] as const,
  pages: (postId: string) => [...commentKeys.all, postId, "pages"] as const,
};

// ── usePostComments ─────────────────────────────────────────────────────────
// Replaces the old useComments hook. Uses useInfiniteQuery for "load more".
// Accepts optional initialComments from PostDto (embedded in feed response)
// to seed the cache and avoid an initial network request.

interface UsePostCommentsOptions {
  initialComments?: CommentDto[];
  initialHasMore?: boolean;
}

export function usePostComments(
  postId: string,
  { initialComments, initialHasMore = false }: UsePostCommentsOptions = {},
) {
  const hasEmbedded = initialComments !== undefined;

  const query = useInfiniteQuery<
    PagePaginatedResponse<CommentDto>,
    Error,
    InfiniteData<PagePaginatedResponse<CommentDto>>,
    ReturnType<typeof commentKeys.pages>,
    number
  >({
    queryKey: commentKeys.pages(postId),
    queryFn: ({ pageParam }) =>
      getCommentsApi(postId, pageParam, COMMENTS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.page + 1 : undefined,

    // Seed from embedded feed data — no network request on first render
    initialData: hasEmbedded
      ? {
          pages: [
            {
              data: initialComments!,
              meta: {
                total: initialComments!.length,
                page: 1,
                pageSize: COMMENTS_PAGE_SIZE,
                hasMore: initialHasMore,
              },
            },
          ],
          pageParams: [1],
        }
      : undefined,
    initialDataUpdatedAt: hasEmbedded ? Date.now() : undefined,

    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!postId,
  });

  const allComments = useMemo(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  return {
    comments: allComments,
    hasMore: query.hasNextPage ?? false,
    loadMore: query.fetchNextPage,
    isLoadingMore: query.isFetchingNextPage,
    isInitialLoad: query.isLoading,
    error: query.error,
  };
}

// ── useCreateComment ────────────────────────────────────────────────────────
// Optimistic update: append temp comment to cache, increment commentCount in feed.

export function useCreateComment() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);

  return useMutation({
    mutationFn: ({ postId, content, replyToId }: { postId: string; content: string; replyToId?: string }) =>
      createCommentApi(postId, content, replyToId),

    onMutate: async ({ postId, content }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: commentKeys.pages(postId) }),
        queryClient.cancelQueries({ queryKey: postKeys.feed() }),
      ]);

      const prevComments = queryClient.getQueryData<
        InfiniteData<PagePaginatedResponse<CommentDto>>
      >(commentKeys.pages(postId));

      const prevFeed = queryClient.getQueryData<{
        pages: PaginatedResponse<PostDto>[];
        pageParams: (string | undefined)[];
      }>(postKeys.feed());

      // Build optimistic temp comment
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tempComment: CommentDto = {
        id: tempId,
        content,
        createdAt: new Date().toISOString(),
        isDeleted: false,
        author: {
          id: currentUser?.id ?? "",
          username: currentUser?.username ?? "",
          displayName: currentUser?.displayName ?? "",
          avatarUrl: currentUser?.avatarUrl ?? null,
          spaceNickname: null,
        },
        replyTo: null,
        mentions: [],
      };

      // Append to comments cache (last page)
      queryClient.setQueryData<
        InfiniteData<PagePaginatedResponse<CommentDto>>
      >(commentKeys.pages(postId), (old) => {
        if (!old) return old;
        const pages = old.pages.map((page, i) =>
          i === old.pages.length - 1
            ? { ...page, data: [...page.data, tempComment] }
            : page,
        );
        return { ...old, pages };
      });

      // Increment commentCount in feed cache
      queryClient.setQueryData<{
        pages: PaginatedResponse<PostDto>[];
        pageParams: (string | undefined)[];
      }>(postKeys.feed(), (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((post) =>
              post.id === postId
                ? { ...post, commentCount: post.commentCount + 1 }
                : post,
            ),
          })),
        };
      });

      // Also update detail cache if it exists
      const prevDetail = queryClient.getQueryData<PostDto>(
        postKeys.detail(postId),
      );
      if (prevDetail) {
        queryClient.setQueryData<PostDto>(postKeys.detail(postId), {
          ...prevDetail,
          commentCount: prevDetail.commentCount + 1,
        });
      }

      return { prevComments, prevFeed, prevDetail, tempId };
    },

    onSuccess: (serverComment, { postId }, context) => {
      // Replace temp comment with server-returned canonical data
      queryClient.setQueryData<
        InfiniteData<PagePaginatedResponse<CommentDto>>
      >(commentKeys.pages(postId), (old) => {
        if (!old) return old;
        const pages = old.pages.map((page) => ({
          ...page,
          data: page.data.map((c) =>
            c.id === context?.tempId ? serverComment : c,
          ),
        }));
        return { ...old, pages };
      });
    },

    onError: (_err, { postId }, context) => {
      if (context?.prevComments !== undefined) {
        queryClient.setQueryData(
          commentKeys.pages(postId),
          context.prevComments,
        );
      }
      if (context?.prevFeed !== undefined) {
        queryClient.setQueryData(postKeys.feed(), context.prevFeed);
      }
      if (context?.prevDetail !== undefined) {
        queryClient.setQueryData(
          postKeys.detail(postId),
          context.prevDetail,
        );
      }
      toast.error(i18n.t("post:comments.createError"));
    },

    onSettled: (_data, _err, { postId }) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });
}

// ── useDeleteComment ────────────────────────────────────────────────────────
// Optimistic update: remove comment from cache, decrement commentCount.

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
    }: {
      commentId: string;
      postId: string;
    }) => deleteCommentApi(commentId),

    onMutate: async ({ commentId, postId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: commentKeys.pages(postId) }),
        queryClient.cancelQueries({ queryKey: postKeys.feed() }),
      ]);

      const prevComments = queryClient.getQueryData<
        InfiniteData<PagePaginatedResponse<CommentDto>>
      >(commentKeys.pages(postId));

      const prevFeed = queryClient.getQueryData<{
        pages: PaginatedResponse<PostDto>[];
        pageParams: (string | undefined)[];
      }>(postKeys.feed());

      // Remove comment from cache
      queryClient.setQueryData<
        InfiniteData<PagePaginatedResponse<CommentDto>>
      >(commentKeys.pages(postId), (old) => {
        if (!old) return old;
        const pages = old.pages.map((page) => ({
          ...page,
          data: page.data.filter((c) => c.id !== commentId),
        }));
        return { ...old, pages };
      });

      // Decrement commentCount in feed cache
      queryClient.setQueryData<{
        pages: PaginatedResponse<PostDto>[];
        pageParams: (string | undefined)[];
      }>(postKeys.feed(), (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    commentCount: Math.max(0, post.commentCount - 1),
                  }
                : post,
            ),
          })),
        };
      });

      // Also update detail cache if it exists
      const prevDetail = queryClient.getQueryData<PostDto>(
        postKeys.detail(postId),
      );
      if (prevDetail) {
        queryClient.setQueryData<PostDto>(postKeys.detail(postId), {
          ...prevDetail,
          commentCount: Math.max(0, prevDetail.commentCount - 1),
        });
      }

      return { prevComments, prevFeed, prevDetail };
    },

    onError: (_err, { postId }, context) => {
      if (context?.prevComments !== undefined) {
        queryClient.setQueryData(
          commentKeys.pages(postId),
          context.prevComments,
        );
      }
      if (context?.prevFeed !== undefined) {
        queryClient.setQueryData(postKeys.feed(), context.prevFeed);
      }
      if (context?.prevDetail !== undefined) {
        queryClient.setQueryData(
          postKeys.detail(postId),
          context.prevDetail,
        );
      }
      toast.error(i18n.t("post:comments.deleteError"));
    },

    onSuccess: () => {
      toast.success(i18n.t("post:comments.deleteSuccess"));
    },

    onSettled: (_data, _err, { postId }) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });
}
