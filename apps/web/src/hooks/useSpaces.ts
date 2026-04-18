import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  listSpacesApi,
  listMySpacesApi,
  getSpaceApi,
  createSpaceApi,
  updateSpaceApi,
  joinSpaceApi,
  leaveSpaceApi,
  getSpacePostsApi,
  getSpaceMembersApi,
} from "@/api/spaces.api";
import { postKeys } from "./usePosts";

export const spaceKeys = {
  all: ["spaces"] as const,
  list: () => [...spaceKeys.all, "list"] as const,
  my: () => [...spaceKeys.all, "my"] as const,
  detail: (slug: string) => [...spaceKeys.all, "detail", slug] as const,
  members: (slug: string) => [...spaceKeys.all, "members", slug] as const,
  posts: (slug: string) => [...spaceKeys.all, "posts", slug] as const,
  growthRecords: (slug: string) =>
    [...spaceKeys.all, "growth", slug] as const,
};

export function useInfiniteSpaces() {
  return useInfiniteQuery({
    queryKey: spaceKeys.list(),
    queryFn: ({ pageParam }) => listSpacesApi(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });
}

export function useMySpaces() {
  return useQuery({
    queryKey: spaceKeys.my(),
    queryFn: () => listMySpacesApi(),
  });
}

export function useSpace(slug: string) {
  return useQuery({
    queryKey: spaceKeys.detail(slug),
    queryFn: () => getSpaceApi(slug),
    enabled: !!slug,
  });
}

export function useCreateSpace() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createSpaceApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: spaceKeys.list() });
      qc.invalidateQueries({ queryKey: spaceKeys.my() });
      toast.success(i18n.t("spaces:create.success"));
    },
    onError: () => {
      toast.error(i18n.t("spaces:create.error"));
    },
  });
}

export function useUpdateSpace(slug: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name?: string;
      description?: string;
      coverUrl?: string | null;
    }) => updateSpaceApi(slug, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: spaceKeys.detail(slug) });
      qc.invalidateQueries({ queryKey: spaceKeys.list() });
    },
  });
}

export function useJoinSpace(slug: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => joinSpaceApi(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: spaceKeys.detail(slug) });
      qc.invalidateQueries({ queryKey: spaceKeys.members(slug) });
      qc.invalidateQueries({ queryKey: spaceKeys.my() });
      toast.success(i18n.t("spaces:join.success"));
    },
  });
}

export function useLeaveSpace(slug: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => leaveSpaceApi(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: spaceKeys.detail(slug) });
      qc.invalidateQueries({ queryKey: spaceKeys.members(slug) });
      qc.invalidateQueries({ queryKey: spaceKeys.my() });
      toast.success(i18n.t("spaces:leave.success"));
    },
  });
}

export function useSpacePosts(slug: string) {
  return useInfiniteQuery({
    queryKey: spaceKeys.posts(slug),
    queryFn: ({ pageParam }) => getSpacePostsApi(slug, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: !!slug,
  });
}

export function useSpaceMembers(slug: string) {
  return useInfiniteQuery({
    queryKey: spaceKeys.members(slug),
    queryFn: ({ pageParam }) => getSpaceMembersApi(slug, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: !!slug,
  });
}

export function useCreateSpacePost(slug: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createSpaceApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: spaceKeys.posts(slug) });
      qc.invalidateQueries({ queryKey: spaceKeys.detail(slug) });
      qc.invalidateQueries({ queryKey: postKeys.feed() });
      toast.success(i18n.t("feed:composer.postSuccess"));
    },
  });
}
