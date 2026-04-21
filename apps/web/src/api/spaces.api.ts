import apiClient from "./client";
import type {
  SpaceDto,
  SpaceDetailDto,
  SpaceMemberDto,
  GrowthRecordDto,
  PostDto,
  PaginatedResponse,
} from "@/types/dto";

// Space CRUD

export function listSpacesApi(
  cursor?: string,
  limit?: number,
): Promise<PaginatedResponse<SpaceDto>> {
  return apiClient.get("/spaces", { params: { cursor, limit } });
}

export function listMySpacesApi(): Promise<SpaceDto[]> {
  return apiClient.get("/spaces/my");
}

export function getSpaceApi(slug: string): Promise<SpaceDetailDto> {
  return apiClient.get(`/spaces/${slug}`);
}

export function createSpaceApi(data: {
  name: string;
  slug: string;
  description?: string;
  type?: "general" | "baby";
}): Promise<SpaceDetailDto> {
  return apiClient.post("/spaces", data);
}

export function updateSpaceApi(
  slug: string,
  data: {
    name?: string;
    description?: string;
    coverUrl?: string | null;
    coverPositionY?: number;
  },
): Promise<SpaceDetailDto> {
  return apiClient.patch(`/spaces/${slug}`, data);
}

export function deleteSpaceApi(slug: string): Promise<void> {
  return apiClient.delete(`/spaces/${slug}`);
}

// Membership

export function joinSpaceApi(slug: string): Promise<SpaceMemberDto> {
  return apiClient.post(`/spaces/${slug}/join`);
}

export function leaveSpaceApi(slug: string): Promise<void> {
  return apiClient.delete(`/spaces/${slug}/leave`);
}

export function getSpaceMembersApi(
  slug: string,
  cursor?: string,
): Promise<PaginatedResponse<SpaceMemberDto>> {
  return apiClient.get(`/spaces/${slug}/members`, { params: { cursor } });
}

// Space posts

export function getSpacePostsApi(
  slug: string,
  cursor?: string,
): Promise<PaginatedResponse<PostDto>> {
  return apiClient.get(`/spaces/${slug}/posts`, { params: { cursor } });
}

// Growth records

export function getGrowthRecordsApi(
  slug: string,
): Promise<GrowthRecordDto[]> {
  return apiClient.get(`/spaces/${slug}/growth-records`);
}

export function createGrowthRecordApi(
  slug: string,
  data: {
    date: string;
    heightCm?: number;
    weightKg?: number;
    headCircumferenceCm?: number;
  },
): Promise<GrowthRecordDto> {
  return apiClient.post(`/spaces/${slug}/growth-records`, data);
}

export function deleteGrowthRecordApi(
  slug: string,
  recordId: string,
): Promise<void> {
  return apiClient.delete(`/spaces/${slug}/growth-records/${recordId}`);
}
