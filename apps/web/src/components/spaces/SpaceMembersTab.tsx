import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Pencil, X, Check } from 'lucide-react';
import { useSpaceMembers, useUpdateSpaceNickname } from '@/hooks/useSpaces';
import { useAuthStore } from '@/store/auth.store';
import { useScrollContainer } from '@/components/layout/ScrollContainerContext';
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

function NicknameEditor({
  currentNickname,
  onSave,
  onCancel,
  isPending,
}: {
  currentNickname: string | null;
  onSave: (nickname: string | null) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation('spaces');
  const [value, setValue] = useState(currentNickname ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (value.includes(' ')) {
      setError(t('nicknameHint'));
      return;
    }
    if (value.length > 10) {
      setError(t('nicknameHint'));
      return;
    }
    onSave(value.trim() || null);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        placeholder={t('nicknamePlaceholder')}
        maxLength={10}
        className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        disabled={isPending}
      />
      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={onCancel}
        disabled={isPending}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-muted/80"
      >
        <X className="h-4 w-4" />
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function SpaceMembersTab({ slug }: SpaceMembersTabProps) {
  const { t } = useTranslation('spaces');
  const currentUserId = useAuthStore((s) => s.currentUser?.id);
  const updateNickname = useUpdateSpaceNickname(slug);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useSpaceMembers(slug);

  const scrollRoot = useScrollContainer();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !scrollRoot) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        { root: scrollRoot, rootMargin: '200px' },
      );
      observerRef.current.observe(node);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage, scrollRoot],
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

  const handleSaveNickname = (nickname: string | null) => {
    updateNickname.mutate(nickname, {
      onSuccess: () => setEditingMemberId(null),
    });
  };

  return (
    <div className="space-y-1">
      {members.map((member) => {
        const isCurrentUser = member.user.id === currentUserId;
        const isEditing = editingMemberId === member.id;
        const displayName = member.spaceNickname ?? member.user.displayName;
        const hasNickname = member.spaceNickname !== null;

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <Link
              to={`/users/${member.user.username}`}
              className="shrink-0"
            >
              {member.user.avatarUrl ? (
                <img
                  src={member.user.avatarUrl}
                  alt={member.user.displayName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </Link>

            <div className="min-w-0 flex-1">
              {isEditing ? (
                <NicknameEditor
                  currentNickname={member.spaceNickname}
                  onSave={(nickname) => handleSaveNickname(nickname)}
                  onCancel={() => setEditingMemberId(null)}
                  isPending={updateNickname.isPending}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to={`/users/${member.user.username}`}
                    className="truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {displayName}
                  </Link>
                  <RoleBadge role={member.role} />
                  {isCurrentUser && !isEditing && (
                    <button
                      onClick={() => setEditingMemberId(member.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={hasNickname ? t('editNickname') : t('setNickname')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              {hasNickname && !isEditing && (
                <div className="text-xs text-muted-foreground">
                  {member.user.displayName} · @{member.user.username}
                </div>
              )}
              {!hasNickname && !isEditing && (
                <span className="text-xs text-muted-foreground">
                  @{member.user.username}
                </span>
              )}
            </div>

            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(member.joinedAt)}
            </span>
          </div>
        );
      })}

      {hasNextPage && <div ref={sentinelRef} className="h-10" />}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
