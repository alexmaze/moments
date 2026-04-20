import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommentDto } from '@/types/dto';
import { usePostComments } from '@/hooks/useComments';
import CommentItem from './CommentItem';
import CommentComposer from './CommentComposer';

interface CommentSectionProps {
  postId: string;
  initialComments?: CommentDto[];
  initialHasMore?: boolean;
  variant?: 'card' | 'inline';
}

export default function CommentSection({
  postId,
  initialComments,
  initialHasMore,
  variant = 'card',
}: CommentSectionProps) {
  const { t } = useTranslation('post');
  const { comments, hasMore, loadMore, isLoadingMore, isInitialLoad } =
    usePostComments(postId, { initialComments, initialHasMore });

  const [replyTo, setReplyTo] = useState<CommentDto | null>(null);

  const isCard = variant === 'card';

  if (isInitialLoad) {
    return (
      <div className={isCard ? 'bg-card rounded-xl shadow-sm border border-border' : ''}>
        {isCard && (
          <div className="p-4 border-b border-border">
            <h3 className="font-medium text-foreground text-sm">{t('comments.title')}</h3>
          </div>
        )}
        <div className="p-4 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-20" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={isCard ? 'bg-card rounded-xl shadow-sm border border-border' : ''}>
      {isCard && (
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground text-sm">{t('comments.title')}</h3>
        </div>
      )}

      <div className={isCard ? 'divide-y divide-border' : 'divide-y divide-border/50'}>
        {comments.length > 0 ? (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              onReply={setReplyTo}
            />
          ))
        ) : isCard ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            {t('comments.empty')}
          </div>
        ) : null}
      </div>

      {hasMore && (
        <div className="px-4 pb-2">
          <button
            onClick={() => loadMore()}
            disabled={isLoadingMore}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
          >
            {isLoadingMore ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                {t('comments.loading')}
              </>
            ) : (
              t('comments.loadMore')
            )}
          </button>
        </div>
      )}

      <div className={isCard ? 'border-t border-border' : 'border-t border-border/50'}>
        <CommentComposer
          postId={postId}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>
    </div>
  );
}