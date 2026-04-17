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
  createdAt: string;
}

export interface UserProfileDto extends UserDto {
  postCount: number;
}
