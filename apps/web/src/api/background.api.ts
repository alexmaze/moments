import apiClient from "./client";
import type { UserDto } from "@/types/dto";

export function uploadBackgroundApi(file: File): Promise<UserDto> {
  const formData = new FormData();
  formData.append("file", file);

  return apiClient.post("/users/me/background", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
