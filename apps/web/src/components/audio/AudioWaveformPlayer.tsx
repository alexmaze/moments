import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { clampAudioProgressMs, formatAudioDurationMs } from "@/lib/audio";

interface AudioWaveformPlayerProps {
  currentTimeMs: number;
  durationMs: number;
  waveform: number[];
  onSeek: (timeMs: number) => void | Promise<void>;
}

function buildWaveformBars(values: number[]) {
  const targetCount = 64;
  const source = values.length > 0
    ? values
    : Array.from({ length: targetCount }, (_, index) => 20 + ((index * 17) % 45));

  if (source.length >= targetCount) return source;

  return Array.from({ length: targetCount }, (_, index) => {
    const position = (index / (targetCount - 1)) * (source.length - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(source.length - 1, Math.ceil(position));
    const ratio = position - leftIndex;
    const left = source[leftIndex] ?? 0;
    const right = source[rightIndex] ?? left;
    return Math.round(left + (right - left) * ratio);
  });
}

export default function AudioWaveformPlayer({
  currentTimeMs,
  durationMs,
  waveform,
  onSeek,
}: AudioWaveformPlayerProps) {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const resolvedDurationMs = Math.max(durationMs, 1);
  const progressValue = clampAudioProgressMs(currentTimeMs, resolvedDurationMs);
  const progressRatio = resolvedDurationMs > 0 ? progressValue / resolvedDurationMs : 0;
  const bars = useMemo(() => buildWaveformBars(waveform), [waveform]);
  const themeStyle = {
    backgroundColor: "var(--audio-waveform-surface)",
  } as const;
  const progressStyle = {
    width: `${progressRatio * 100}%`,
    backgroundColor: "var(--audio-waveform-progress)",
  } as const;
  const barStyle = (value: number) => ({
    height: `${Math.max(10, Math.min(100, value))}%`,
    backgroundColor: "var(--audio-waveform-bar)",
  });
  const cursorStyle = {
    left: `${progressRatio * 100}%`,
    backgroundColor: "var(--audio-waveform-cursor)",
  } as const;
  const tagStyle = {
    backgroundColor: "var(--audio-waveform-tag-surface)",
    color: "var(--audio-waveform-tag-foreground)",
    borderColor: "var(--audio-waveform-tag-border)",
  } as const;

  const seekFromClientX = async (clientX: number) => {
    const element = waveformRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) return;

    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    await onSeek(Math.round(resolvedDurationMs * ratio));
  };

  const handlePointerDown = async (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsScrubbing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    await seekFromClientX(event.clientX);
  };

  const handlePointerMove = async (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    await seekFromClientX(event.clientX);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    setIsScrubbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={waveformRef}
      onPointerDown={(event) => void handlePointerDown(event)}
      onPointerMove={(event) => void handlePointerMove(event)}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className="relative h-10 cursor-pointer overflow-hidden rounded-lg touch-none"
      style={themeStyle}
    >
      <span
        className="absolute right-1 top-1 z-20 rounded-full border px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm"
        style={tagStyle}
      >
        {formatAudioDurationMs(progressValue)} / {formatAudioDurationMs(resolvedDurationMs)}
      </span>
      <span className="pointer-events-none absolute inset-y-0 left-0 z-0" style={progressStyle} />
      <div className="flex h-10 items-end gap-0.5">
        {bars.map((value, index) => (
          <span
            key={`audio-wave-${index}`}
            className="relative z-10 flex-1 rounded-full"
            style={barStyle(value)}
          />
        ))}
      </div>
      <span className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 -translate-x-1/2 rounded-full" style={cursorStyle} />
    </div>
  );
}
