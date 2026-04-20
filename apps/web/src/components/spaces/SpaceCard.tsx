import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, FileText } from 'lucide-react';
import type { SpaceDto } from '@/types/dto';

interface SpaceCardProps {
  space: SpaceDto;
}

export function SpaceCard({ space }: SpaceCardProps) {
  const { t } = useTranslation('spaces');

  return (
    <Link
      to={`/spaces/${space.slug}`}
      className="group block overflow-hidden rounded-xl border border-border surface-card shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Cover */}
      {space.coverUrl ? (
        <img
          src={space.coverUrl}
          alt={space.name}
          className="h-24 w-full object-cover"
        />
      ) : (
        <div className="h-24 w-full bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5" />
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
            {space.name}
          </h3>
          {space.type === 'baby' && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              🍼
            </span>
          )}
        </div>

        {space.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
            {space.description}
          </p>
        )}

        {/* Stats */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {t('detail.members', { count: space.memberCount })}
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {t('detail.posts', { count: space.postCount })}
          </span>
        </div>
      </div>
    </Link>
  );
}
