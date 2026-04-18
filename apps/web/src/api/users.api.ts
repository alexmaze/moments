import apiClient from "./client";
import type { UserDto, UserProfileDto, SupportedLocale, SupportedTheme } from "@/types/dto";

export function getUserProfileApi(username: string): Promise<UserProfileDto> {
  return apiClient.get(`/users/${username}`);
}

interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  locale?: SupportedLocale | null;
  theme?: SupportedTheme | null;
  background?: string | null;
}

export function updateProfileApi(data: UpdateProfileRequest): Promise<UserDto> {
  return apiClient.patch("/users/me", data);
}

export function uploadAvatarApi(file: File): Promise<UserDto> {
  const formData = new FormData();
  formData.append("file", file);

  return apiClient.post("/users/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
