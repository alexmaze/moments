// User types
export type SupportedLocale = 'en' | 'zh-CN';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'zh-CN'] as const;

export type SupportedTheme = 'light' | 'dark';

export const SUPPORTED_THEMES: readonly SupportedTheme[] = ['light', 'dark'] as const;

export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  locale: SupportedLocale | null;
  theme: SupportedTheme | null;
  background: string | null;
  isAdmin: boolean;
  createdAt: string;
}

export interface UserProfileDto extends UserDto {
  postCount: number;
}

export interface PostAuthorDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  spaceNickname: string | null;
}

export interface MentionUserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  spaceNickname: string | null;
}
