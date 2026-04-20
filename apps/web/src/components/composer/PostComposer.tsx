import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreatePost } from '@/hooks/usePosts';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useTagSuggestion } from '@/hooks/useTagSuggestion';
import MediaUploader from './MediaUploader';
import { SpaceSelector } from '@/components/spaces/SpaceSelector';
import { TagSuggestionDropdown } from './TagSuggestionDropdown';

interface PostComposerProps {
  onClose: () => void;
  spaceId?: string;
}

export default function PostComposer({ onClose, spaceId: initialSpaceId }: PostComposerProps) {
  const { t } = useTranslation('feed');
  const [content, setContent] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | undefined>(initialSpaceId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const createPost = useCreatePost();
  const { items, addFiles, removeItem, readyIds, allUploaded } = useMediaUpload();

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
    if (tagSuggestionOpen) {
      const coords = getCaretCoordinates();
      setDropdownPosition(coords);
    } else {
      setDropdownPosition(null);
    }
  }, [tagSuggestionOpen, content, getCaretCoordinates]);

  const hasContent = content.trim().length > 0;
  const hasMedia = items.length > 0 && allUploaded;
  const canSubmit = (hasContent || hasMedia) && !createPost.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;

    createPost.mutate(
      {
        content: content.trim() || undefined,
        mediaIds: readyIds,
        spaceId: selectedSpaceId,
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('composer.cancel')}
        </button>
        <h2 className="text-sm font-medium text-foreground">{t('composer.title')}</h2>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="text-sm font-medium text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
        >
          {createPost.isPending ? (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            t('composer.submit')
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-4 relative">
        {/* Space selector — only show if no fixed spaceId prop */}
        {!initialSpaceId && (
          <div className="mb-3">
            <SpaceSelector
              selectedSpaceId={selectedSpaceId}
              onChange={setSelectedSpaceId}
            />
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (onTagKeyDown(e)) return;
          }}
          placeholder={t('composer.placeholder')}
          rows={4}
          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-sm"
          autoFocus
        />

        <TagSuggestionDropdown
          isOpen={tagSuggestionOpen}
          suggestions={tagSuggestions}
          query={tagQuery}
          selectedIndex={tagSelectedIndex}
          position={dropdownPosition}
          onSelect={selectTag}
          onClose={closeTagSuggestion}
        />

        <MediaUploader
          items={items}
          addFiles={addFiles}
          removeItem={removeItem}
        />
      </div>
    </>
  );
}
