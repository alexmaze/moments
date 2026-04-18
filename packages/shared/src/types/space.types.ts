// Space types

export type SpaceType = 'general' | 'baby';
export type SpaceMemberRole = 'owner' | 'admin' | 'member';

export interface SpaceDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  type: SpaceType;
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  memberCount: number;
  postCount: number;
  createdAt: string;
}

export interface SpaceDetailDto extends SpaceDto {
  /** Current user's membership info, null if not a member */
  myMembership: {
    role: SpaceMemberRole;
    joinedAt: string;
  } | null;
}

export interface SpaceMemberDto {
  id: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  role: SpaceMemberRole;
  joinedAt: string;
}

export interface GrowthRecordDto {
  id: string;
  date: string;
  heightCm: number | null;
  weightKg: number | null;
  headCircumferenceCm: number | null;
  recordedBy: {
    id: string;
    displayName: string;
  };
  createdAt: string;
}

/** Compact space info embedded in PostDto for badge display */
export interface PostSpaceDto {
  id: string;
  name: string;
  slug: string;
  type: SpaceType;
  isMember: boolean;
}
