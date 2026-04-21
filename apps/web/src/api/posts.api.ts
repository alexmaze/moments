import apiClient from "./client";
import type {
  PostAudioDto,
  PostDto,
  CommentDto,
  PaginatedResponse,
  PagePaginatedResponse,
} from "@/types/dto";

export function getFeedApi(
  cursor?: string,
  limit?: number,
): Promise<PaginatedResponse<PostDto>> {
  return apiClient.get("/posts", {
    params: { cursor, limit },
  });
}

export function getPostApi(id: string): Promise<PostDto> {
  return apiClient.get(`/posts/${id}`);
}

export interface CreatePostRequest {
  content?: string;
  mediaIds?: string[];
  spaceId?: string;
  audio?: {
    mediaId: string;
    waveform: number[];
  };
}

export function createPostApi(data: CreatePostRequest): Promise<PostDto> {
  return apiClient.post("/posts", data);
}

export interface UpdatePostRequest {
  content?: string | null;
  mediaIds?: string[];
  audio?: {
    mediaId: string;
    waveform: number[];
  } | null;
}

export function updatePostApi(id: string, data: UpdatePostRequest): Promise<PostDto> {
  return apiClient.patch(`/posts/${id}`, data);
}

export interface UploadPostAudioResponse {
  id: string;
  type: "audio";
  publicUrl: string;
  durationMs: number;
  mimeType: string;
  sizeBytes: number;
}

export function uploadPostAudioApi(
  file: File,
  durationMs?: number,
  onProgress?: (pct: number) => void,
): Promise<UploadPostAudioResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (durationMs && Number.isFinite(durationMs)) {
    formData.append("durationMs", String(Math.max(1, Math.round(durationMs))));
  }

  return apiClient.post("/posts/audio-upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
}

export function deletePostApi(id: string): Promise<void> {
  return apiClient.delete(`/posts/${id}`);
}

export function toggleLikeApi(
  postId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  return apiClient.post(`/posts/${postId}/like`);
}

export function getCommentsApi(
  postId: string,
  page?: number,
  limit?: number,
): Promise<PagePaginatedResponse<CommentDto>> {
  return apiClient.get(`/posts/${postId}/comments`, {
    params: { page, limit },
  });
}

export function createCommentApi(
  postId: string,
  content: string,
  replyToId?: string,
): Promise<CommentDto> {
  return apiClient.post(`/posts/${postId}/comments`, { content, replyToId });
}

export function deleteCommentApi(id: string): Promise<void> {
  return apiClient.delete(`/comments/${id}`);
}

export function getUserPostsApi(
  username: string,
  cursor?: string,
): Promise<PaginatedResponse<PostDto>> {
  return apiClient.get(`/users/${username}/posts`, {
    params: { cursor },
  });
}
