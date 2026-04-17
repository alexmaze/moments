import { useTranslation } from 'react-i18next';
import type { UserProfileDto } from '@/types/dto';
import { formatDate } from '@/lib/utils';

interface ProfileHeaderProps {
  profile: UserProfileDto;
  isOwner?: boolean;
  onAvatarEdit?: () => void;
  isAvatarUploading?: boolean;
}

export default function ProfileHeader({
  profile,
  isOwner,
  onAvatarEdit,
  isAvatarUploading,
}: ProfileHeaderProps) {
  const { t } = useTranslation('profile');

  const avatarContent = profile.avatarUrl ? (
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
  );

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-start gap-4">
        {isOwner && onAvatarEdit ? (
          <button
            type="button"
            onClick={onAvatarEdit}
            className="relative group shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label={t('edit.avatarChange')}
          >
            {avatarContent}
            {/* Hover / uploading overlay */}
            <div className={`absolute inset-0 rounded-full flex items-center justify-center bg-black/50 transition-opacity ${
              isAvatarUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              {isAvatarUploading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-6 h-6">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>
          </button>
        ) : (
          <div className="shrink-0">
            {avatarContent}
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
              {t('stats.posts', { count: profile.postCount })}
            </span>
            <span>
              {t('stats.joined', { date: formatDate(profile.createdAt) })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
