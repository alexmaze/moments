import apiClient from './client';
import type { PostDto } from '@moments/shared';

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AdminPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminStats {
  users: { total: number; today: number };
  posts: { total: number; today: number };
  comments: { total: number };
  likes: { total: number };
  storage: { totalBytes: number };
  database: { totalBytes: number };
}

export const adminApi = {
  getUsers: async (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<AdminPaginatedResponse<AdminUser>> => {
    return apiClient.get('/admin/users', { params });
  },

  banUser: async (userId: string): Promise<void> => {
    await apiClient.post(`/admin/users/${userId}/ban`);
  },

  unbanUser: async (userId: string): Promise<void> => {
    await apiClient.post(`/admin/users/${userId}/unban`);
  },

  getPosts: async (params: {
    page?: number;
    pageSize?: number;
    authorId?: string;
    search?: string;
  }): Promise<AdminPaginatedResponse<PostDto>> => {
    return apiClient.get('/admin/posts', { params });
  },

  deletePost: async (postId: string): Promise<void> => {
    await apiClient.delete(`/admin/posts/${postId}`);
  },

  getStats: async (): Promise<AdminStats> => {
    return apiClient.get('/admin/stats');
  },

  getSettings: async (): Promise<Record<string, string>> => {
    return apiClient.get('/admin/settings');
  },

  setRegistrationOpen: async (open: boolean): Promise<void> => {
    await apiClient.post('/admin/settings/registration', { value: open ? 'true' : 'false' });
  },
};
