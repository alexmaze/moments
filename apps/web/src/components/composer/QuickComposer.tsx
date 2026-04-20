import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, User, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useCreatePost } from '@/hooks/usePosts';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useTagSuggestion } from '@/hooks/useTagSuggestion';
import MediaUploader from './MediaUploader';
import { SpaceSelector } from '@/components/spaces/SpaceSelector';
import { TagSuggestionDropdown } from './TagSuggestionDropdown';

interface QuickComposerProps {
  /** When set, locks the composer to this space (hides SpaceSelector) */
  fixedSpaceId?: string;
}

export default function QuickComposer({ fixedSpaceId }: QuickComposerProps) {
  const { t } = useTranslation('feed');
  const currentUser = useAuthStore((s) => s.currentUser);
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [spaceId, setSpaceId] = useState<string | undefined>(fixedSpaceId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const createPost = useCreatePost();
  const { items, addFiles, removeItem, readyIds, allUploaded, reset } =
    useMediaUpload();

  const {
    isOpen: tagSuggestionOpen,
    selectedIndex: tagSelectedIndex,
    suggestions: tagSuggestions,
    query: tagQuery,
    onKeyDown: onTagKeyDown,
    selectTag,
    close: closeTagSuggestion,
    getCaretCoordinates,
  } = useTagSuggestion(content, setContent, textareaRef);

  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (tagSuggestionOpen && expanded) {
      const coords = getCaretCoordinates();
      setDropdownPosition(coords);
    } else {
      setDropdownPosition(null);
    }
  }, [tagSuggestionOpen, expanded, content, getCaretCoordinates]);

  const hasContent = content.trim().length > 0;
  const hasMedia = items.length > 0;
  const hasMediaReady = hasMedia && allUploaded;
  const canSubmit = (hasContent || hasMediaReady) && !createPost.isPending;
  const isDirty = hasContent || hasMedia || !!spaceId;

  // Auto-focus textarea when expanded
  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [expanded]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Click-outside to collapse (only if no content/media)
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

    createPost.mutate(
      {
        content: content.trim() || undefined,
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

  return (
    <div ref={cardRef} className="bg-card rounded-xl shadow-sm border border-border mb-4">
      {!expanded ? (
        /* --- Collapsed state --- */
        <button
          onClick={handleExpand}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          {/* Avatar */}
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

          {/* Placeholder text */}
          <span className="text-sm text-muted-foreground flex-1">
            {t('quickComposer.placeholder')}
          </span>

          {/* Image icon hint */}
          <Image className="w-5 h-5 text-muted-foreground shrink-0" />
        </button>
      ) : (
        /* --- Expanded state --- */
        <div className="p-4 relative">
          {/* Avatar + textarea */}
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

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (onTagKeyDown(e)) return;
              }}
              placeholder={t('quickComposer.placeholder')}
              rows={3}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-sm min-h-[72px]"
            />
          </div>

          <TagSuggestionDropdown
            isOpen={tagSuggestionOpen}
            suggestions={tagSuggestions}
            query={tagQuery}
            selectedIndex={tagSelectedIndex}
            position={dropdownPosition}
            onSelect={selectTag}
            onClose={closeTagSuggestion}
          />

          {/* Media uploader */}
          <div className="mt-3">
            <MediaUploader
              items={items}
              addFiles={addFiles}
              removeItem={removeItem}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <button
              onClick={handleFileSelect}
              type="button"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-accent"
            >
              <Image className="w-5 h-5" />
            </button>

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
