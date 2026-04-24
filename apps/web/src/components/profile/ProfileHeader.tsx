import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import type { UserProfileDto } from '@moments/shared';
import { formatDate } from '@/lib/utils';

interface ProfileHeaderProps {
  profile: UserProfileDto;
  isOwner?: boolean;
  onEdit?: () => void;
}

export default function ProfileHeader({
  profile,
  isOwner,
  onEdit,
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
    <div className="surface-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          {avatarContent}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {profile.displayName}
              </h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>

            {isOwner && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="shrink-0 rounded-lg px-3 py-1.5 border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t('edit.button')}
              </button>
            )}
          </div>

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
