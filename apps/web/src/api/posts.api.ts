import apiClient from "./client";
import type {
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

interface CreatePostRequest {
  content?: string;
  mediaIds?: string[];
}

export function createPostApi(data: CreatePostRequest): Promise<PostDto> {
  return apiClient.post("/posts", data);
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
): Promise<PagePaginatedResponse<CommentDto>> {
  return apiClient.get(`/posts/${postId}/comments`, {
    params: { page },
  });
}

export function createCommentApi(
  postId: string,
  content: string,
): Promise<CommentDto> {
  return apiClient.post(`/posts/${postId}/comments`, { content });
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
