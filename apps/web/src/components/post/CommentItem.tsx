import { Link } from 'react-router-dom';
import type { CommentDto } from '@/types/dto';
import { useAuthStore } from '@/store/auth.store';
import { useDeleteComment } from '@/hooks/useComments';
import { formatRelativeTime } from '@/lib/utils';

interface CommentItemProps {
  comment: CommentDto;
  postId: string;
  onDelete?: () => void;
}

export default function CommentItem({ comment, postId }: CommentItemProps) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const deleteComment = useDeleteComment();
  const isOwner = currentUser?.id === comment.author.id;

  const handleDelete = () => {
    if (confirm('Delete this comment?')) {
      deleteComment.mutate({ commentId: comment.id, postId });
    }
  };

  return (
    <div className="p-4 flex gap-3">
      <Link to={`/users/${comment.author.username}`} className="shrink-0">
        {comment.author.avatarUrl ? (
          <img
            src={comment.author.avatarUrl}
            alt={comment.author.displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-muted-foreground">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
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
              onClick={handleDelete}
              className="ml-auto rounded p-1 hover:bg-accent transition-colors text-muted-foreground hover:text-destructive"
              title="Delete comment"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>
    </div>
  );
}
