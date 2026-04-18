import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, FileText, Check } from 'lucide-react';
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

  const isMember = space.myMembership !== null;
  const isOwner = space.myMembership?.role === 'owner';

  const handleJoin = () => {
    joinSpace.mutate();
  };

  const handleLeave = () => {
    leaveSpace.mutate(undefined, {
      onSuccess: () => setLeaveConfirmOpen(false),
    });
  };

  return (
    <div>
      {/* Cover image */}
      {space.coverUrl ? (
        <img
          src={space.coverUrl}
          alt={space.name}
          className="h-32 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="h-32 w-full rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5" />
      )}

      {/* Info */}
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

            {/* Stats */}
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" />
                {t('detail.members', { count: space.memberCount })}
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {t('detail.posts', { count: space.postCount })}
              </span>
            </div>
          </div>

          {/* Action button */}
          <div className="shrink-0">
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
              <button
                onClick={handleJoin}
                disabled={joinSpace.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {t('detail.join')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leave confirmation */}
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
