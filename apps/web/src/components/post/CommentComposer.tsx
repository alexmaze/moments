import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateComment } from '@/hooks/useComments';
import { RichTextEditor, type RichTextEditorRef } from '@/components/composer/rich-editor';
import type { CommentDto } from '@/types/dto';

interface CommentComposerProps {
  postId: string;
  replyTo?: CommentDto | null;
  onCancelReply?: () => void;
}

export default function CommentComposer({ postId, replyTo, onCancelReply }: CommentComposerProps) {
  const { t } = useTranslation('post');
  const [content, setContent] = useState('');
  const createComment = useCreateComment();
  const editorRef = useRef<RichTextEditorRef>(null);

  useEffect(() => {
    if (replyTo && editorRef.current) {
      editorRef.current.insertMention(replyTo.author.displayName, replyTo.author.id);
      editorRef.current.focus();
    }
  }, [replyTo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    createComment.mutate(
      { postId, content: trimmed, replyToId: replyTo?.id },
      {
        onSuccess: () => {
          setContent('');
          editorRef.current?.clear();
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = content.trim();
      if (trimmed) {
        createComment.mutate(
          { postId, content: trimmed, replyToId: replyTo?.id },
          {
            onSuccess: () => {
              setContent('');
              editorRef.current?.clear();
            },
          },
        );
      }
      return true;
    }
    return false;
  };

  return (
    <div className="p-4">
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          <span>
            {t('comments.replyTo')} <span className="text-primary">@{replyTo.author.displayName}</span>
          </span>
          {onCancelReply && (
            <button
              onClick={onCancelReply}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ×
            </button>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <div className="flex-1">
           <RichTextEditor
             ref={editorRef}
             value={content}
             onChange={setContent}
             placeholder={replyTo ? t('comments.replyPlaceholder', { name: replyTo.author.displayName }) : t('comments.inputPlaceholder')}
             minRows={1}
             onKeyDown={handleKeyDown}
             className="border border-input rounded-lg bg-background"
           />
        </div>
        <button
          type="submit"
          disabled={!content.trim() || createComment.isPending}
          className="rounded-lg px-4 py-2 leading-6 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0"
        >
          {createComment.isPending ? (
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            t('comments.submit')
          )}
        </button>
      </form>
    </div>
  );
}
