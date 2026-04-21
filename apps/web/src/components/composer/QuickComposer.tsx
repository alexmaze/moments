import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, User, Loader2, Smile, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useCreatePost, useUpdatePost } from '@/hooks/usePosts';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { uploadPostAudioApi } from '@/api/posts.api';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import type { PostDto } from '@/types/dto';
import MediaUploader from './MediaUploader';
import AudioRecorderPanel from './AudioRecorderPanel';
import { SpaceSelector } from '@/components/spaces/SpaceSelector';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { RichTextEditor, type RichTextEditorRef } from './rich-editor';

interface QuickComposerProps {
  fixedSpaceId?: string;
  mode?: 'create' | 'edit';
  initialPost?: PostDto;
  onCancel?: () => void;
  onSuccess?: (post: PostDto) => void;
}

type ExistingAudioState = Pick<PostDto['audio'], 'id' | 'durationMs' | 'waveform' | 'url'> & {
  id: string;
  durationMs: number;
  waveform: number[];
  url: string;
};

function toExistingAudio(audio: PostDto['audio']): ExistingAudioState | null {
  if (!audio) return null;
  return {
    id: audio.id,
    durationMs: audio.durationMs,
    waveform: audio.waveform,
    url: audio.url,
  };
}

export default function QuickComposer({
  fixedSpaceId,
  mode = 'create',
  initialPost,
  onCancel,
  onSuccess,
}: QuickComposerProps) {
  const { t } = useTranslation('feed');
  const currentUser = useAuthStore((s) => s.currentUser);
  const isEditMode = mode === 'edit';

  const [expanded, setExpanded] = useState(isEditMode);
  const [content, setContent] = useState(initialPost?.content ?? '');
  const [spaceId, setSpaceId] = useState<string | undefined>(fixedSpaceId);
  const [existingAudio, setExistingAudio] = useState<ExistingAudioState | null>(
    toExistingAudio(initialPost?.audio ?? null),
  );
  const editorRef = useRef<RichTextEditorRef>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const didInitEditStateRef = useRef(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const createPost = useCreatePost();
  const updatePost = useUpdatePost(initialPost?.id ?? '');
  const { items, addFiles, removeItem, reorderItems, readyIds, allUploaded, reset, setExistingItems } =
    useMediaUpload();
  const audioRecorder = useAudioRecorder();
  const [isAudioUploading, setIsAudioUploading] = useState(false);

  const isSubmitting = createPost.isPending || updatePost.isPending || isAudioUploading;
  const hasContent = content.trim().length > 0;
  const hasMedia = items.length > 0;
  const hasMediaReady = hasMedia && allUploaded;
  const hasLoadedAudio = !!existingAudio || audioRecorder.status === 'ready' || !!audioRecorder.previewUrl;
  const hasAudio = !!audioRecorder.audioFile || hasLoadedAudio;
  const audioWaveform = audioRecorder.waveform.length > 0
    ? audioRecorder.waveform
    : existingAudio?.waveform ?? [];
  const audioDurationMs = Math.max(audioRecorder.durationMs, existingAudio?.durationMs ?? 0);
  const audioPreviewDurationMs = Math.max(audioRecorder.previewDurationMs, existingAudio?.durationMs ?? 0);
  const canSubmit = (hasContent || hasMediaReady || hasAudio) && !isSubmitting;
  const isDirty = hasContent || hasMedia || hasAudio || (!!spaceId && !fixedSpaceId);

  useEffect(() => {
    if (!expanded) return;
    editorRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (!isEditMode || !initialPost || didInitEditStateRef.current) return;

    didInitEditStateRef.current = true;
    const serializedContent = initialPost.content ?? '';
    setContent(serializedContent);
    editorRef.current?.setSerializedContent(serializedContent);
    setExistingItems(
      initialPost.media.map((media) => ({
        assetId: media.id,
        type: media.type,
        preview: media.publicUrl,
        coverUrl: media.coverUrl,
      })),
    );

    const nextExistingAudio = toExistingAudio(initialPost.audio);
    setExistingAudio(nextExistingAudio);
    if (nextExistingAudio) {
      audioRecorder.loadPreview(nextExistingAudio);
    } else {
      audioRecorder.clearRecording();
    }
  }, [audioRecorder, initialPost, isEditMode, setExistingItems]);

  useEffect(() => {
    if (!expanded || isEditMode) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        if (!isDirty) {
          setExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded, isDirty, isEditMode]);

  const resetCreateState = useCallback(() => {
    setContent('');
    editorRef.current?.clear();
    setSpaceId(fixedSpaceId);
    reset();
    setExistingAudio(null);
    audioRecorder.clearRecording();
    setExpanded(false);
  }, [audioRecorder, fixedSpaceId, reset]);

  const handleExpand = () => {
    if (!expanded) setExpanded(true);
  };

  const handleClearAudio = useCallback(() => {
    setExistingAudio(null);
    audioRecorder.clearRecording();
  }, [audioRecorder]);

  const handleSubmit = async () => {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;

    const serializedContent = editorRef.current?.getSerializedContent() || content;
    const trimmedContent = serializedContent.trim();
    let audioPayload: {
      mediaId: string;
      waveform: number[];
    } | null | undefined = existingAudio
      ? { mediaId: existingAudio.id, waveform: existingAudio.waveform }
      : isEditMode
        ? null
        : undefined;

    try {
      if (audioRecorder.audioFile) {
        setIsAudioUploading(true);
        const uploaded = await uploadPostAudioApi(
          audioRecorder.audioFile,
          audioRecorder.previewDurationMs || audioRecorder.durationMs,
        );
        audioPayload = {
          mediaId: uploaded.id,
          waveform: audioRecorder.waveform,
        };
      }
    } catch {
      toast.error(t('composer.audioUploadError'));
      submittingRef.current = false;
      return;
    } finally {
      setIsAudioUploading(false);
    }

    try {
      const result = isEditMode && initialPost
        ? await updatePost.mutateAsync({
            content: trimmedContent || null,
            mediaIds: readyIds,
            audio: audioPayload ?? null,
          })
        : await createPost.mutateAsync({
            content: trimmedContent || undefined,
            mediaIds: readyIds,
            spaceId,
            audio: audioPayload ?? undefined,
          });

      if (isEditMode) {
        onSuccess?.(result);
      } else {
        resetCreateState();
      }
    } catch {
      // Error toast handled by the mutation hook.
    } finally {
      submittingRef.current = false;
    }
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    editorRef.current?.insertText(emoji);
  }, []);

  const handleToggleAudioRecording = useCallback(async () => {
    if (audioRecorder.status === 'recording') {
      audioRecorder.stopRecording();
      return;
    }

    setExistingAudio(null);

    try {
      await audioRecorder.startRecording();
    } catch (error) {
      const message = error instanceof Error && error.message === 'unsupported'
        ? t('composer.audioUnsupported')
        : t('composer.audioPermissionError');
      toast.error(message);
    }
  }, [audioRecorder, t]);

  const renderComposer = () => (
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
          placeholder={t(isEditMode ? 'quickComposer.editPlaceholder' : 'quickComposer.placeholder')}
          className="flex-1 min-h-[72px]"
        />
      </div>

      <div className="mt-3">
        <MediaUploader
          items={items}
          addFiles={addFiles}
          removeItem={removeItem}
          reorderItems={reorderItems}
        />
      </div>

      {(audioRecorder.status !== 'idle' || hasLoadedAudio) && (
        <div className="mt-3">
          <AudioRecorderPanel
            durationMs={audioDurationMs}
            previewDurationMs={audioPreviewDurationMs}
            isPreviewPlaying={audioRecorder.isPreviewPlaying}
            isUploading={isSubmitting}
            onClear={handleClearAudio}
            onSeek={audioRecorder.seekPreview}
            onStart={handleToggleAudioRecording}
            onStop={audioRecorder.stopRecording}
            onTogglePreview={() => void audioRecorder.togglePreviewPlayback()}
            previewCurrentTimeMs={audioRecorder.previewCurrentTimeMs}
            ready={hasLoadedAudio}
            recording={audioRecorder.status === 'recording'}
            waveform={audioWaveform}
          />
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        <label
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-accent cursor-pointer"
          title={t('quickComposer.insertImage')}
        >
          <Image className="w-5 h-5" />
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                addFiles(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
            className="hidden"
          />
        </label>

        <button
          onClick={() => void handleToggleAudioRecording()}
          type="button"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-accent"
          title={audioRecorder.status === 'recording' ? t('quickComposer.stopRecording') : t('quickComposer.recordAudio')}
        >
          <Mic className="w-5 h-5" />
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

        {!fixedSpaceId && !isEditMode && (
          <SpaceSelector selectedSpaceId={spaceId} onChange={setSpaceId} />
        )}

        <div className="flex-1" />

        {isEditMode && (
          <button
            onClick={onCancel}
            type="button"
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {t('composer.cancel')}
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t(isEditMode ? 'quickComposer.save' : 'quickComposer.submit')
          )}
        </button>
      </div>
    </div>
  );

  if (isEditMode) {
    return (
      <div className="surface-card rounded-xl shadow-sm border border-border">
        {renderComposer()}
      </div>
    );
  }

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
        renderComposer()
      )}
    </div>
  );
}
