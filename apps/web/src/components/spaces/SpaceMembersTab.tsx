import { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { useSpaceMembers } from '@/hooks/useSpaces';
import { formatRelativeTime } from '@/lib/utils';
import type { SpaceMemberRole } from '@/types/dto';

interface SpaceMembersTabProps {
  slug: string;
}

function RoleBadge({ role }: { role: SpaceMemberRole }) {
  const { t } = useTranslation('spaces');

  if (role === 'member') return null;

  const styles =
    role === 'owner'
      ? 'bg-primary/10 text-primary'
      : 'bg-muted text-muted-foreground';

  const label = role === 'owner' ? t('detail.owner') : t('detail.admin');

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}

export function SpaceMembersTab({ slug }: SpaceMembersTabProps) {
  const { t } = useTranslation('spaces');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useSpaceMembers(slug);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        { rootMargin: '200px' },
      );
      observerRef.current.observe(node);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  const members = data?.pages.flatMap((page) => page.data) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex h-14 animate-pulse items-center gap-3 rounded-lg bg-muted/50 px-3"
          />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">{t('detail.noMembers')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {members.map((member) => (
        <Link
          key={member.id}
          to={`/users/${member.user.username}`}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
        >
          {/* Avatar */}
          {member.user.avatarUrl ? (
            <img
              src={member.user.avatarUrl}
              alt={member.user.displayName}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {member.user.displayName}
              </span>
              <RoleBadge role={member.role} />
            </div>
            <span className="text-xs text-muted-foreground">
              @{member.user.username}
            </span>
          </div>

          {/* Joined date */}
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(member.joinedAt)}
          </span>
        </Link>
      ))}

      {hasNextPage && <div ref={sentinelRef} className="h-10" />}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
