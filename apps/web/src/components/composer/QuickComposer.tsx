import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, User, Loader2, Smile } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useCreatePost } from '@/hooks/usePosts';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import MediaUploader from './MediaUploader';
import { SpaceSelector } from '@/components/spaces/SpaceSelector';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { RichTextEditor, type RichTextEditorRef } from './rich-editor';

interface QuickComposerProps {
  fixedSpaceId?: string;
}

export default function QuickComposer({ fixedSpaceId }: QuickComposerProps) {
  const { t } = useTranslation('feed');
  const currentUser = useAuthStore((s) => s.currentUser);
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [spaceId, setSpaceId] = useState<string | undefined>(fixedSpaceId);
  const editorRef = useRef<RichTextEditorRef>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const createPost = useCreatePost();
  const { items, addFiles, removeItem, readyIds, allUploaded, reset } =
    useMediaUpload();

  const hasContent = content.trim().length > 0;
  const hasMedia = items.length > 0;
  const hasMediaReady = hasMedia && allUploaded;
  const canSubmit = (hasContent || hasMediaReady) && !createPost.isPending;
  const isDirty = hasContent || hasMedia || !!spaceId;

  useEffect(() => {
    if (expanded && editorRef.current) {
      editorRef.current.focus();
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        if (!isDirty) {
          setExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded, isDirty]);

  const handleExpand = () => {
    if (!expanded) setExpanded(true);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;

    const serializedContent = editorRef.current?.getSerializedContent() || content;

    createPost.mutate(
      {
        content: serializedContent.trim() || undefined,
        mediaIds: readyIds,
        spaceId,
      },
      {
        onSuccess: () => {
          setContent('');
          setSpaceId(fixedSpaceId);
          reset();
          setExpanded(false);
        },
      },
    );
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        addFiles(Array.from(input.files));
      }
    };
    input.click();
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    editorRef.current?.insertText(emoji);
  }, []);

  return (
    <div ref={cardRef} className="surface-card rounded-xl shadow-sm border border-border mb-4">
      {!expanded ? (
        <button
          onClick={handleExpand}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.displayName}
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          )}

          <span className="text-sm text-muted-foreground flex-1">
            {t('quickComposer.placeholder')}
          </span>

          <Image className="w-5 h-5 text-muted-foreground shrink-0" />
        </button>
      ) : (
        <div className="p-4 relative">
          <div className="flex gap-3">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.displayName}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
            )}

            <RichTextEditor
              ref={editorRef}
              value={content}
              onChange={setContent}
              placeholder={t('quickComposer.placeholder')}
              className="flex-1 min-h-[72px]"
            />
          </div>

          <div className="mt-3">
            <MediaUploader
              items={items}
              addFiles={addFiles}
              removeItem={removeItem}
            />
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <button
              onClick={handleFileSelect}
              type="button"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-accent"
              title={t('quickComposer.insertImage')}
            >
              <Image className="w-5 h-5" />
            </button>

            <button
              ref={emojiButtonRef}
              onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
              type="button"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-accent"
              title={t('quickComposer.insertEmoji')}
            >
              <Smile className="w-5 h-5" />
            </button>

            <EmojiPickerPopover
              open={emojiPickerOpen}
              onOpenChange={setEmojiPickerOpen}
              onEmojiSelect={handleEmojiSelect}
              anchorRef={emojiButtonRef}
            />

            {!fixedSpaceId && (
              <SpaceSelector selectedSpaceId={spaceId} onChange={setSpaceId} />
            )}

            <div className="flex-1" />

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {createPost.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('quickComposer.submit')
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
