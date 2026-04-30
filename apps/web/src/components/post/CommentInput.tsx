import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SendHorizonal } from 'lucide-react';
import { useCreateComment } from '@/hooks/useComments';

interface CommentInputProps {
  postId: string;
}

export default function CommentInput({ postId }: CommentInputProps) {
  const { t } = useTranslation('post');
  const [content, setContent] = useState('');
  const createComment = useCreateComment();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    createComment.mutate(
      { postId, content: trimmed },
      {
        onSuccess: () => {
          setContent('');
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 flex gap-2">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t('comments.inputPlaceholder')}
        className="flex-1 border border-input rounded-lg px-3 h-9 bg-background text-[13px] text-foreground placeholder:text-muted-foreground input-focus"
      />
      <button
        type="submit"
        disabled={!content.trim() || createComment.isPending}
        className="rounded-lg w-9 h-9 flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0"
      >
        {createComment.isPending ? (
          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
        ) : (
          <SendHorizonal className="w-4 h-4" />
        )}
      </button>
    </form>
  );
}
