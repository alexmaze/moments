import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCommentsApi,
  createCommentApi,
  deleteCommentApi,
} from "@/api/posts.api";
import { postKeys } from "./usePosts";

export const commentKeys = {
  all: ["comments"] as const,
  list: (postId: string) => [...commentKeys.all, postId] as const,
  page: (postId: string, page: number) =>
    [...commentKeys.list(postId), page] as const,
};

export function useComments(postId: string, page = 1) {
  return useQuery({
    queryKey: commentKeys.page(postId, page),
    queryFn: () => getCommentsApi(postId, page),
    enabled: !!postId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      createCommentApi(postId, content),
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) });
      queryClient.invalidateQueries({ queryKey: postKeys.feed() });
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
    }: {
      commentId: string;
      postId: string;
    }) => deleteCommentApi(commentId),
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) });
      queryClient.invalidateQueries({ queryKey: postKeys.feed() });
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });
}
