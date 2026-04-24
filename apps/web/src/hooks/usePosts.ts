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
  updatePostApi,
  deletePostApi,
  toggleLikeApi,
  getUserPostsApi,
  getLikedUsersApi,
} from "@/api/posts.api";
import type { PostDto, PaginatedResponse } from "@moments/shared";

export const postKeys = {
  all: ["posts"] as const,
  feed: () => [...postKeys.all, "feed"] as const,
  detail: (id: string) => [...postKeys.all, "detail", id] as const,
  userPosts: (username: string) =>
    [...postKeys.all, "user", username] as const,
  likedUsers: (postId: string) =>
    [...postKeys.all, "likedUsers", postId] as const,
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

export function useUpdatePost(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      content?: string | null;
      mediaIds?: string[];
      audio?: {
        mediaId: string;
        waveform: number[];
      } | null;
    }) => updatePostApi(postId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.all });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success(i18n.t("feed:composer.editSuccess"));
    },
    onError: () => {
      toast.error(i18n.t("feed:composer.editError"));
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
      await queryClient.cancelQueries({ queryKey: ["spaces"] });
      await queryClient.cancelQueries({ queryKey: ["tags"] });

      // Helper to toggle like in a paginated cache
      const toggleInPages = (
        old: { pages: { data: PostDto[] }[] } | undefined,
      ) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((page) => {
            if (!page?.data) return page;
            return {
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
            };
          }),
        };
      };

      // Optimistically update main feed
      const previousFeed = queryClient.getQueryData<{
        pages: PaginatedResponse<PostDto>[];
      }>(postKeys.feed());
      queryClient.setQueryData(postKeys.feed(), toggleInPages);

      // Optimistically update all space post caches
      const spacePostQueries = queryClient.getQueriesData<{
        pages: { data: PostDto[] }[];
      }>({ queryKey: ["spaces"] });
      const previousSpacePosts = new Map<
        readonly unknown[],
        { pages: { data: PostDto[] }[] } | undefined
      >();
      for (const [key, data] of spacePostQueries) {
        if (key[1] === "posts" && data?.pages?.length) {
          previousSpacePosts.set(key, data);
          queryClient.setQueryData(key, toggleInPages);
        }
      }

      // Optimistically update all tag post caches
      const tagPostQueries = queryClient.getQueriesData<{
        pages: { posts: { data: PostDto[] } }[];
      }>({ queryKey: ["tags"] });
      const previousTagPosts = new Map<
        readonly unknown[],
        { pages: { posts: { data: PostDto[] } }[] } | undefined
      >();
      for (const [key, data] of tagPostQueries) {
        if (key[1] === "posts" && data?.pages?.length) {
          previousTagPosts.set(key, data);
          queryClient.setQueryData(key, {
            ...data,
            pages: data.pages.map((page) => {
              if (!page?.posts?.data) return page;
              return {
                ...page,
                posts: {
                  ...page.posts,
                  data: page.posts.data.map((post) =>
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
                },
              };
            }),
          });
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

      return { previousFeed, previousDetail, previousSpacePosts, previousTagPosts };
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
      if (context?.previousTagPosts) {
        for (const [key, data] of context.previousTagPosts) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(i18n.t("feed:postCard.likeError"), { duration: 2000 });
    },
    onSettled: (_data, _error, postId) => {
      queryClient.invalidateQueries({ queryKey: postKeys.feed() });
      queryClient.invalidateQueries({
        queryKey: ["spaces"],
        predicate: (query) => query.queryKey[1] === "posts",
      });
      queryClient.invalidateQueries({ queryKey: ["tags", "posts"] });
      queryClient.invalidateQueries({ queryKey: postKeys.likedUsers(postId) });
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
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

export function useLikedUsers(postId: string) {
  return useInfiniteQuery({
    queryKey: postKeys.likedUsers(postId),
    queryFn: ({ pageParam }) => getLikedUsersApi(postId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: !!postId,
  });
}
