import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, User, Loader2, Smile, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useCreatePost } from '@/hooks/usePosts';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { uploadPostAudioApi } from '@/api/posts.api';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import MediaUploader from './MediaUploader';
import AudioRecorderPanel from './AudioRecorderPanel';
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
  const submittingRef = useRef(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const createPost = useCreatePost();
  const { items, addFiles, removeItem, readyIds, allUploaded, reset } =
    useMediaUpload();
  const audioRecorder = useAudioRecorder();
  const [isAudioUploading, setIsAudioUploading] = useState(false);

  const hasContent = content.trim().length > 0;
  const hasMedia = items.length > 0;
  const hasMediaReady = hasMedia && allUploaded;
  const hasAudio = !!audioRecorder.audioFile;
  const canSubmit = (hasContent || hasMediaReady || hasAudio) && !createPost.isPending && !isAudioUploading;
  const isDirty = hasContent || hasMedia || hasAudio || !!spaceId;

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

  const handleSubmit = async () => {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;

    const serializedContent = editorRef.current?.getSerializedContent() || content;
    let audioPayload: {
      mediaId: string;
      waveform: number[];
    } | undefined;

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
      await createPost.mutateAsync({
        content: serializedContent.trim() || undefined,
        mediaIds: readyIds,
        spaceId,
        audio: audioPayload,
      });

      setContent('');
      setSpaceId(fixedSpaceId);
      reset();
      audioRecorder.clearRecording();
      setExpanded(false);
    } catch {
      // Error toast handled by the mutation hook.
    } finally {
      submittingRef.current = false;
    }
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

  const handleToggleAudioRecording = useCallback(async () => {
    if (audioRecorder.status === 'recording') {
      audioRecorder.stopRecording();
      return;
    }

    try {
      await audioRecorder.startRecording();
    } catch (error) {
      const message = error instanceof Error && error.message === 'unsupported'
        ? t('composer.audioUnsupported')
        : t('composer.audioPermissionError');
      toast.error(message);
    }
  }, [audioRecorder, t]);

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

          {(audioRecorder.status !== 'idle' || hasAudio) && (
            <div className="mt-3">
              <AudioRecorderPanel
                durationMs={audioRecorder.durationMs}
                previewDurationMs={audioRecorder.previewDurationMs}
                isPreviewPlaying={audioRecorder.isPreviewPlaying}
                isUploading={isAudioUploading || createPost.isPending}
                onClear={audioRecorder.clearRecording}
                onSeek={audioRecorder.seekPreview}
                onStart={handleToggleAudioRecording}
                onStop={audioRecorder.stopRecording}
                onTogglePreview={() => void audioRecorder.togglePreviewPlayback()}
                previewCurrentTimeMs={audioRecorder.previewCurrentTimeMs}
                ready={audioRecorder.status === 'ready'}
                recording={audioRecorder.status === 'recording'}
                waveform={audioRecorder.waveform}
              />
            </div>
          )}

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

            {!fixedSpaceId && (
              <SpaceSelector selectedSpaceId={spaceId} onChange={setSpaceId} />
            )}

            <div className="flex-1" />

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {createPost.isPending || isAudioUploading ? (
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
