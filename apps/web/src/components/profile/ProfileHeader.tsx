import type { UserProfileDto } from '@/types/dto';
import { formatDate } from '@/lib/utils';

interface ProfileHeaderProps {
  profile: UserProfileDto;
}

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-start gap-4">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-muted-foreground">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">
            {profile.displayName}
          </h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>

          {profile.bio && (
            <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
              {profile.bio}
            </p>
          )}

          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{profile.postCount}</strong> posts
            </span>
            <span>
              Joined {formatDate(profile.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
