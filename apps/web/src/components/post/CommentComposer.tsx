import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Smile } from 'lucide-react';
import { useCreateComment } from '@/hooks/useComments';
import { EmojiPickerPopover } from '@/components/composer/EmojiPickerPopover';
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
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const createComment = useCreateComment();
  const editorRef = useRef<RichTextEditorRef>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (replyTo && editorRef.current) {
      editorRef.current.insertMention(replyTo.author.displayName, replyTo.author.id);
      editorRef.current.focus();
    }
  }, [replyTo]);

  const resetComposer = useCallback(() => {
    setContent('');
    setEmojiPickerOpen(false);
    editorRef.current?.clear();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    createComment.mutate(
      { postId, content: trimmed, replyToId: replyTo?.id },
      {
        onSuccess: () => {
          resetComposer();
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
              resetComposer();
            },
          },
        );
      }
      return true;
    }
    return false;
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    editorRef.current?.insertText(emoji);
  }, []);

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
        <div className="flex-1 relative">
           <RichTextEditor
             ref={editorRef}
             value={content}
             onChange={setContent}
             placeholder={replyTo ? t('comments.replyPlaceholder', { name: replyTo.author.displayName }) : t('comments.inputPlaceholder')}
             minRows={1}
             onKeyDown={handleKeyDown}
             className="border border-input rounded-lg bg-background"
             contentClassName="pr-11"
             placeholderClassName="pr-11"
           />
          <button
            ref={emojiButtonRef}
            type="button"
            onClick={() => setEmojiPickerOpen((open) => !open)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-accent shrink-0"
            title={t('comments.insertEmoji')}
          >
            <Smile className="w-4.5 h-4.5" />
          </button>
        </div>
        <EmojiPickerPopover
          open={emojiPickerOpen}
          onOpenChange={setEmojiPickerOpen}
          onEmojiSelect={handleEmojiSelect}
          anchorRef={emojiButtonRef}
        />
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
