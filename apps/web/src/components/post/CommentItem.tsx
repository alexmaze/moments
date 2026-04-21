import { useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Trash2, MessageSquare } from 'lucide-react';
import type { CommentDto, MentionUserDto } from '@/types/dto';
import { useAuthStore } from '@/store/auth.store';
import { useDeleteComment } from '@/hooks/useComments';
import { formatRelativeTime } from '@/lib/utils';
import { renderContentWithTagsAndMentions } from '@moments/shared';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface CommentItemProps {
  comment: CommentDto;
  postId: string;
  onReply?: (comment: CommentDto) => void;
  isHighlighted?: boolean;
  highlightRef?: RefObject<HTMLDivElement | null>;
}

function renderContent(content: string, mentions: MentionUserDto[]) {
  const parts = renderContentWithTagsAndMentions(content);
  return parts.map((part, i) => {
    if (part.type === 'tag') {
      return (
        <Link
          key={i}
          to={`/tags/${encodeURIComponent(part.value)}`}
          className="text-primary hover:underline font-medium"
        >
          #{part.value}
        </Link>
      );
    }
    if (part.type === 'mention') {
      const username = mentions.find(m => m.id === part.userId)?.username;
      return (
        <Link
          key={i}
          to={`/users/${username ?? part.userId}`}
          className="text-primary hover:underline font-medium"
        >
          @{part.displayName}
        </Link>
      );
    }
    return <span key={i}>{part.value}</span>;
  });
}

export default function CommentItem({ comment, postId, onReply, isHighlighted, highlightRef }: CommentItemProps) {
  const { t } = useTranslation('post');
  const currentUser = useAuthStore((s) => s.currentUser);
  const deleteComment = useDeleteComment();
  const isOwner = currentUser?.id === comment.author.id;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDeleteConfirm = () => {
    deleteComment.mutate({ commentId: comment.id, postId });
    setDeleteOpen(false);
  };

  return (
    <div
      ref={highlightRef}
      className={cn(
        'p-4 flex gap-3',
        isHighlighted && 'bg-primary/10 -mx-1 px-5 rounded-lg',
      )}
    >
      <Link to={`/users/${comment.author.username}`} className="shrink-0">
        {comment.author.avatarUrl ? (
          <img
            src={comment.author.avatarUrl}
            alt={comment.author.displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            to={`/users/${comment.author.username}`}
            className="text-sm font-medium text-foreground hover:underline"
          >
            {comment.author.displayName}
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
          </span>

          {isOwner && (
            <button
              onClick={() => setDeleteOpen(true)}
              className="ml-auto rounded p-1 hover:bg-accent transition-colors text-muted-foreground hover:text-destructive"
              title={t('comments.deleteTitle')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {comment.replyTo && (
          <div className="text-xs text-muted-foreground mb-1">
            {t('comments.replyTo')}{' '}
            <Link
              to={`/users/${comment.replyTo.author.username}`}
              className="text-primary hover:underline"
            >
              @{comment.replyTo.author.displayName}
            </Link>
          </div>
        )}

        <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
          {renderContent(comment.content, comment.mentions)}
        </p>

        {onReply && (
          <button
            onClick={() => onReply(comment)}
            className="mt-1 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <MessageSquare className="w-3 h-3" />
            {t('comments.reply')}
          </button>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('comments.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('comments.deleteConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('comments.deleteConfirmCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t('comments.deleteConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
