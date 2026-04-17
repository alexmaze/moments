// User types
export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

export interface UserProfileDto extends UserDto {
  postCount: number;
}
