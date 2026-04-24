import apiClient from './client';
import type { PostDto, PaginatedResponse } from '@moments/shared';

export interface TagDto {
  id: string;
  name: string;
  postCount: number;
  createdAt: string;
}

export interface TagPostsResponse {
  tag: {
    id: string;
    name: string;
    postCount: number;
  } | null;
  posts: PaginatedResponse<PostDto>;
}

export function getTagsApi(q?: string, limit = 10): Promise<{ data: TagDto[] }> {
  const params: Record<string, string | number> = { limit };
  if (q) params.q = q;
  return apiClient.get('/tags', { params });
}

export function getTagPostsApi(
  name: string,
  cursor?: string,
  limit = 20,
  sort: 'latest' | 'hot' = 'latest',
): Promise<TagPostsResponse> {
  const params: Record<string, string | number> = { limit, sort };
  if (cursor) params.cursor = cursor;
  return apiClient.get(`/tags/${encodeURIComponent(name)}/posts`, { params });
}