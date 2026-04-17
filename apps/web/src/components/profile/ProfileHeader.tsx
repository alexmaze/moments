import { useTranslation } from 'react-i18next';
import { User, Camera } from 'lucide-react';
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
      <User className="w-8 h-8 text-muted-foreground" />
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
                <Camera className="w-6 h-6" stroke="white" />
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
