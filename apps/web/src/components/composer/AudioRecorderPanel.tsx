import { Loader2, Mic, Pause, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatAudioDurationMs } from "@/lib/audio";
import AudioWaveformPlayer from "@/components/audio/AudioWaveformPlayer";

interface AudioRecorderPanelProps {
  durationMs: number;
  previewDurationMs: number;
  isPreviewPlaying: boolean;
  isUploading: boolean;
  onClear: () => void;
  onSeek: (timeMs: number) => void;
  onStart: () => void;
  onStop: () => void;
  onTogglePreview: () => void;
  previewCurrentTimeMs: number;
  ready: boolean;
  recording: boolean;
  waveform: number[];
}

export default function AudioRecorderPanel({
  durationMs,
  previewDurationMs,
  isPreviewPlaying,
  isUploading,
  onClear,
  onSeek,
  onStart,
  onStop,
  onTogglePreview,
  previewCurrentTimeMs,
  ready,
  recording,
  waveform,
}: AudioRecorderPanelProps) {
  const { t } = useTranslation("feed");
  const displayDurationMs = Math.max(previewDurationMs, durationMs, 1);

  return (
    <div className="rounded-xl border border-border/70 bg-background/35 p-3">
      {!ready ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {recording ? t("quickComposer.stopRecording") : t("quickComposer.recordAudio")}
            </p>
            <p className="text-xs text-muted-foreground">
              {recording
                ? formatAudioDurationMs(durationMs)
                : t("quickComposer.recordingLimit")}
            </p>
          </div>

          <button
            type="button"
            onClick={recording ? onStop : onStart}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-white ${recording ? "bg-destructive" : "bg-primary"}`}
          >
            {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onTogglePreview}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
            >
              {isPreviewPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>

            <div className="min-w-0 flex-1">
              <AudioWaveformPlayer
                currentTimeMs={previewCurrentTimeMs}
                durationMs={displayDurationMs}
                waveform={waveform}
                onSeek={onSeek}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t("quickComposer.audioReady")}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onStart}
                disabled={isUploading}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                {t("quickComposer.reRecordAudio")}
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={isUploading}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t("quickComposer.deleteAudio")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
