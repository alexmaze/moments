export function clampAudioProgressMs(timeMs: number, durationMs: number) {
  const safeDuration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const safeTime = Number.isFinite(timeMs) ? Math.max(0, timeMs) : 0;

  if (safeDuration <= 0) return 0;
  return Math.min(safeTime, safeDuration);
}

export function formatAudioDurationMs(totalMs: number) {
  const safe = Number.isFinite(totalMs) ? Math.max(0, totalMs) : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
