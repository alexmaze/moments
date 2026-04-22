import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, FileText, Check, Settings, ChevronDown, Cake } from 'lucide-react';
import { formatBabyAge, formatBabyAgeEn } from '@moments/shared';
import i18n from '@/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useJoinSpace, useLeaveSpace } from '@/hooks/useSpaces';
import type { SpaceDetailDto } from '@/types/dto';

interface SpaceHeaderProps {
  space: SpaceDetailDto;
}

export function SpaceHeader({ space }: SpaceHeaderProps) {
  const { t } = useTranslation('spaces');
  const joinSpace = useJoinSpace(space.slug);
  const leaveSpace = useLeaveSpace(space.slug);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [joinDropdownOpen, setJoinDropdownOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isMember = space.myMembership !== null;
  const isOwner = space.myMembership?.role === 'owner';
  const canEdit = space.myMembership?.role === 'owner' || space.myMembership?.role === 'admin';

  const handleJoin = () => {
    const trimmed = nickname.trim();
    if (trimmed.includes(' ')) return;
    joinSpace.mutate(trimmed || undefined, {
      onSuccess: () => {
        setJoinDropdownOpen(false);
        setNickname('');
      },
    });
  };

  const handleLeave = () => {
    leaveSpace.mutate(undefined, {
      onSuccess: () => setLeaveConfirmOpen(false),
    });
  };

  return (
    <div>
      {space.coverUrl ? (
        <img
          src={space.coverUrl}
          alt={space.name}
          className="h-32 w-full rounded-xl object-cover"
          style={{ objectPosition: `center ${space.coverPositionY}%` }}
        />
      ) : (
        <div className="h-32 w-full rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5" />
      )}

      <div className="mt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold text-foreground">
                {space.name}
              </h1>
              {space.type === 'baby' && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {t('create.typeBaby')} 🍼
                </span>
              )}
            </div>

            {space.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {space.description}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Users className="h-4 w-4" />
                {t('detail.members', { count: space.memberCount })}
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <FileText className="h-4 w-4" />
                {t('detail.posts', { count: space.postCount })}
              </span>
              {space.type === 'baby' && space.babyBirthday && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <Cake className="h-4 w-4" />
                  {t('detail.babyAge', { age: i18n.language === 'zh-CN' ? formatBabyAge(space.babyBirthday, new Date().toISOString()) : formatBabyAgeEn(space.babyBirthday, new Date().toISOString()) })}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <div className="flex items-center gap-2">
              {isMember ? (
                <button
                  onClick={() => {
                    if (!isOwner) setLeaveConfirmOpen(true);
                  }}
                  disabled={isOwner}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {t('detail.joined')}
                </button>
              ) : (
                <div ref={dropdownRef} className="relative">
                  <div className="flex">
                    <button
                      onClick={() => joinSpace.mutate(undefined, { onSuccess: () => setJoinDropdownOpen(false) })}
                      disabled={joinSpace.isPending}
                      className="rounded-l-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {t('detail.join')}
                    </button>
                    <button
                      onClick={() => setJoinDropdownOpen((v) => !v)}
                      disabled={joinSpace.isPending}
                      className="rounded-r-lg border-l border-primary-foreground/20 bg-primary px-2 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {joinDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setJoinDropdownOpen(false)}
                      />
                      <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-surface-overlay p-3 shadow-lg backdrop-blur-xl">
                        <label className="mb-1 block text-xs font-medium text-foreground">
                          {t('nickname')}
                        </label>
                        <input
                          type="text"
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          placeholder={t('nicknamePlaceholder')}
                          maxLength={10}
                          className="mb-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleJoin();
                          }}
                        />
                        <p className="mb-3 text-xs text-muted-foreground">
                          {t('nicknameHint')}
                        </p>
                        <button
                          onClick={handleJoin}
                          disabled={joinSpace.isPending || nickname.includes(' ')}
                          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          {t('detail.join')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {canEdit && (
                <Link
                  to={`/spaces/${space.slug}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/70 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <Settings className="h-4 w-4" />
                  {t('detail.edit')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leave.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('leave.confirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('leave.confirmCancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('leave.confirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
