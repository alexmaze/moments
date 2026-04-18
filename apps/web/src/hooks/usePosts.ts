import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  getFeedApi,
  getPostApi,
  createPostApi,
  deletePostApi,
  toggleLikeApi,
  getUserPostsApi,
} from "@/api/posts.api";
import type { PostDto, PaginatedResponse } from "@/types/dto";

export const postKeys = {
  all: ["posts"] as const,
  feed: () => [...postKeys.all, "feed"] as const,
  detail: (id: string) => [...postKeys.all, "detail", id] as const,
  userPosts: (username: string) =>
    [...postKeys.all, "user", username] as const,
};

export function useInfiniteFeed() {
  return useInfiniteQuery({
    queryKey: postKeys.feed(),
    queryFn: ({ pageParam }) => getFeedApi(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => getPostApi(id),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPostApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.feed() });
      // Also invalidate spaces data in case the post was to a space
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      toast.success(i18n.t("feed:composer.postSuccess"));
    },
    onError: () => {
      toast.error(i18n.t("feed:composer.postError"));
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePostApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.feed() });
      toast.success(i18n.t("feed:postCard.deleteSuccess"));
    },
    onError: () => {
      toast.error(i18n.t("feed:postCard.deleteError"));
    },
  });
}

export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleLikeApi,
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postKeys.feed() });
      // Also cancel any space post queries
      await queryClient.cancelQueries({ queryKey: ["spaces"] });

      // Helper to toggle like in a paginated cache
      const toggleInPages = (
        old: { pages: PaginatedResponse<PostDto>[] } | undefined,
      ) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    isLikedByMe: !post.isLikedByMe,
                    likeCount: post.isLikedByMe
                      ? post.likeCount - 1
                      : post.likeCount + 1,
                  }
                : post,
            ),
          })),
        };
      };

      // Optimistically update main feed
      const previousFeed = queryClient.getQueryData<{
        pages: PaginatedResponse<PostDto>[];
      }>(postKeys.feed());
      queryClient.setQueryData(postKeys.feed(), toggleInPages);

      // Optimistically update all space post caches
      const spacePostQueries = queryClient.getQueriesData<{
        pages: PaginatedResponse<PostDto>[];
      }>({ queryKey: ["spaces"] });
      const previousSpacePosts = new Map<
        readonly unknown[],
        { pages: PaginatedResponse<PostDto>[] } | undefined
      >();
      for (const [key, data] of spacePostQueries) {
        // Only target space post queries (["spaces", "posts", slug])
        if (key[1] === "posts" && data) {
          previousSpacePosts.set(key, data);
          queryClient.setQueryData(key, toggleInPages);
        }
      }

      // Also optimistically update the detail cache if it exists
      const previousDetail = queryClient.getQueryData<PostDto>(
        postKeys.detail(postId),
      );
      if (previousDetail) {
        queryClient.setQueryData<PostDto>(postKeys.detail(postId), {
          ...previousDetail,
          isLikedByMe: !previousDetail.isLikedByMe,
          likeCount: previousDetail.isLikedByMe
            ? previousDetail.likeCount - 1
            : previousDetail.likeCount + 1,
        });
      }

      return { previousFeed, previousDetail, previousSpacePosts };
    },
    onError: (_err, postId, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(postKeys.feed(), context.previousFeed);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          postKeys.detail(postId),
          context.previousDetail,
        );
      }
      if (context?.previousSpacePosts) {
        for (const [key, data] of context.previousSpacePosts) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(i18n.t("feed:postCard.likeError"), { duration: 2000 });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.feed() });
      // Also invalidate space post queries so they refetch
      queryClient.invalidateQueries({
        queryKey: ["spaces"],
        predicate: (query) => query.queryKey[1] === "posts",
      });
    },
  });
}

export function useUserPosts(username: string) {
  return useInfiniteQuery({
    queryKey: postKeys.userPosts(username),
    queryFn: ({ pageParam }) => getUserPostsApi(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: !!username,
  });
}
