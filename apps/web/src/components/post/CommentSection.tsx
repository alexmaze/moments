import { useComments } from '@/hooks/useComments';
import CommentItem from './CommentItem';
import CommentInput from './CommentInput';

interface CommentSectionProps {
  postId: string;
}

export default function CommentSection({ postId }: CommentSectionProps) {
  const { data, isLoading } = useComments(postId);
  const comments = data?.data ?? [];

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border">
      <div className="p-4 border-b border-border">
        <h3 className="font-medium text-foreground text-sm">Comments</h3>
      </div>

      <div className="divide-y divide-border">
        {isLoading ? (
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
        ) : comments && comments.length > 0 ? (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} postId={postId} />
          ))
        ) : (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No comments yet. Be the first to comment!
          </div>
        )}
      </div>

      <div className="border-t border-border">
        <CommentInput postId={postId} />
      </div>
    </div>
  );
}
