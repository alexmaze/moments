// User types
export type SupportedLocale = 'en' | 'zh-CN';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'zh-CN'] as const;

export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  locale: SupportedLocale | null;
  createdAt: string;
}

export interface UserProfileDto extends UserDto {
  postCount: number;
}
