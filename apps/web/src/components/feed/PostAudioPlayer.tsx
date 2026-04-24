import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PostAudioDto } from "@moments/shared";
import { usePostAudioPlayerStore } from "@/store/post-audio-player.store";
import AudioWaveformPlayer from "@/components/audio/AudioWaveformPlayer";

interface PostAudioPlayerProps {
  audio: PostAudioDto;
  postId: string;
}

export default function PostAudioPlayer({ audio, postId }: PostAudioPlayerProps) {
  const { t } = useTranslation("feed");
  const currentPostId = usePostAudioPlayerStore((state) => state.currentPostId);
  const status = usePostAudioPlayerStore((state) => state.status);
  const currentTimeMs = usePostAudioPlayerStore((state) => state.currentTimeMs);
  const actualDurationMs = usePostAudioPlayerStore((state) => state.durationMs);
  const seek = usePostAudioPlayerStore((state) => state.seek);
  const play = usePostAudioPlayerStore((state) => state.play);
  const pause = usePostAudioPlayerStore((state) => state.pause);
  const [measuredDurationMs, setMeasuredDurationMs] = useState(0);
  const isCurrent = currentPostId === postId;
  const isPlaying = isCurrent && status === "playing";
  const resolvedDurationMs = isCurrent
    ? actualDurationMs || measuredDurationMs || audio.durationMs
    : measuredDurationMs || audio.durationMs;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const probe = new Audio();
    probe.preload = "metadata";

    const handleLoadedMetadata = () => {
      setMeasuredDurationMs(
        Number.isFinite(probe.duration) && probe.duration > 0
          ? Math.round(probe.duration * 1000)
          : 0,
      );
    };

    probe.addEventListener("loadedmetadata", handleLoadedMetadata);
    probe.src = audio.url;

    return () => {
      probe.removeEventListener("loadedmetadata", handleLoadedMetadata);
      probe.src = "";
    };
  }, [audio.url]);

  const handleToggle = async () => {
    if (isPlaying) {
      pause();
      return;
    }

    await play(postId, audio.url, audio.durationMs);
  };

  const handleSeek = async (timeMs: number) => {
    if (!isCurrent) {
      await play(postId, audio.url, audio.durationMs);
    }
    seek(timeMs);
  };

  return (
    <div
      className="mt-3 rounded-xl border border-border/70 bg-background/35 p-3"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void handleToggle();
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
          title={isPlaying ? t("postCard.pauseAudio") : t("postCard.playAudio")}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <AudioWaveformPlayer
            currentTimeMs={isCurrent ? currentTimeMs : 0}
            durationMs={resolvedDurationMs}
            waveform={audio.waveform}
            onSeek={handleSeek}
          />
        </div>
      </div>
    </div>
  );
}
