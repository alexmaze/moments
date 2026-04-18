import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreatePost } from '@/hooks/usePosts';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import MediaUploader from './MediaUploader';
import { SpaceSelector } from '@/components/spaces/SpaceSelector';

interface PostComposerProps {
  onClose: () => void;
  spaceId?: string;
}

export default function PostComposer({ onClose, spaceId: initialSpaceId }: PostComposerProps) {
  const { t } = useTranslation('feed');
  const [content, setContent] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | undefined>(initialSpaceId);
  const createPost = useCreatePost();
  const { items, addFiles, removeItem, readyIds, allUploaded } = useMediaUpload();

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
      <div className="p-4">
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
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('composer.placeholder')}
          rows={4}
          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-sm"
          autoFocus
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
