import apiClient from "./client";
import type {
  NotificationListResponseDto,
  UnreadNotificationCountDto,
} from "@/types/dto";

export function getNotificationsApi(
  cursor?: string,
  limit?: number,
  filter?: "all" | "unread",
): Promise<NotificationListResponseDto> {
  return apiClient.get("/notifications", {
    params: { cursor, limit, filter },
  });
}

export function getUnreadNotificationCountApi(): Promise<UnreadNotificationCountDto> {
  return apiClient.get("/notifications/unread-count");
}

export function markNotificationReadApi(id: string): Promise<void> {
  return apiClient.post(`/notifications/${id}/read`);
}

export function markAllNotificationsReadApi(): Promise<void> {
  return apiClient.patch("/notifications/read-all");
}
