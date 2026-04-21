import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getNotificationsApi,
  getUnreadNotificationCountApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from "@/api/notifications.api";
import type { NotificationItemDto } from "@/types/dto";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (filter: "all" | "unread") =>
    [...notificationKeys.all, "list", filter] as const,
  unreadCount: () => [...notificationKeys.all, "unreadCount"] as const,
};

export function useNotifications(filter: "all" | "unread" = "all") {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(filter),
    queryFn: ({ pageParam }) =>
      getNotificationsApi(pageParam, undefined, filter),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: getUnreadNotificationCountApi,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationReadApi,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });

      const markReadInPages = (
        old: { pages: { data: NotificationItemDto[] }[] } | undefined,
      ) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((n) =>
              n.id === id ? { ...n, isRead: true } : n,
            ),
          })),
        };
      };

      const previousAll = queryClient.getQueryData(notificationKeys.list("all"));
      const previousUnread = queryClient.getQueryData(notificationKeys.list("unread"));
      const previousCount = queryClient.getQueryData(notificationKeys.unreadCount());

      queryClient.setQueryData(notificationKeys.list("all"), markReadInPages);
      queryClient.setQueryData(notificationKeys.list("unread"), markReadInPages);

      const countData = previousCount as { count: number } | undefined;
      if (countData && countData.count > 0) {
        queryClient.setQueryData(notificationKeys.unreadCount(), {
          count: countData.count - 1,
        });
      }

      return { previousAll, previousUnread, previousCount };
    },
    onError: (_err, _id, context) => {
      if (context?.previousAll)
        queryClient.setQueryData(notificationKeys.list("all"), context.previousAll);
      if (context?.previousUnread)
        queryClient.setQueryData(notificationKeys.list("unread"), context.previousUnread);
      if (context?.previousCount)
        queryClient.setQueryData(notificationKeys.unreadCount(), context.previousCount);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
