import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MAX_DURATION_SEC = 120;
const MAX_DURATION_MS = MAX_DURATION_SEC * 1000;
const WAVEFORM_SAMPLE_COUNT = 64;

type RecorderStatus = "idle" | "recording" | "ready" | "error";

let previewProgressRafId: number | null = null;

function stopPreviewProgressLoop() {
  if (previewProgressRafId == null || typeof window === "undefined") return;
  window.cancelAnimationFrame(previewProgressRafId);
  previewProgressRafId = null;
}

function pickMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg")) return "mp3";
  return "bin";
}

function createFakeWaveform(size = WAVEFORM_SAMPLE_COUNT) {
  return Array.from({ length: size }, (_, index) => {
    const position = index / Math.max(1, size - 1);
    const shape = Math.sin(position * Math.PI);
    const noise = Math.random() * 18;
    return Math.max(12, Math.min(100, Math.round(24 + shape * 54 + noise)));
  });
}

async function createRealWaveform(blob: Blob, size = WAVEFORM_SAMPLE_COUNT) {
  const AudioContextClass = window.AudioContext || (window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;

  if (!AudioContextClass) {
    return {
      waveform: createFakeWaveform(size),
      durationMs: 0,
    };
  }

  const audioContext = new AudioContextClass();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);

    if (channelData.length === 0) {
      return {
        waveform: createFakeWaveform(size),
        durationMs: Math.max(0, Math.round(audioBuffer.duration * 1000)),
      };
    }

    const bucketSize = Math.max(1, Math.floor(channelData.length / size));
    const samples: number[] = [];

    for (let bucketIndex = 0; bucketIndex < size; bucketIndex += 1) {
      const start = bucketIndex * bucketSize;
      const end = Math.min(channelData.length, start + bucketSize);

      let sumSquares = 0;
      let count = 0;
      for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
        const value = channelData[sampleIndex] ?? 0;
        sumSquares += value * value;
        count += 1;
      }

      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      samples.push(rms);
    }

    const peak = Math.max(...samples, 0);
    if (peak <= 0) {
      return {
        waveform: createFakeWaveform(size),
        durationMs: Math.max(0, Math.round(audioBuffer.duration * 1000)),
      };
    }

    return {
      waveform: samples.map((value) => {
        const normalized = value / peak;
        return Math.max(10, Math.min(100, Math.round(normalized * 100)));
      }),
      durationMs: Math.max(0, Math.round(audioBuffer.duration * 1000)),
    };
  } catch {
    return {
      waveform: createFakeWaveform(size),
      durationMs: 0,
    };
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

export function useAudioRecorder() {
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [previewDurationMs, setPreviewDurationMs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCurrentTimeMs, setPreviewCurrentTimeMs] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasFinalizedRef = useRef(false);

  const cleanupPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsPreviewPlaying(false);
    setPreviewCurrentTimeMs(0);
  }, []);

  const clearRecording = useCallback(() => {
    cleanupPreview();
    setAudioFile(null);
    setDurationMs(0);
    setPreviewDurationMs(0);
    setWaveform([]);
    setStatus("idle");
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, [cleanupPreview]);

  const stopStream = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recordingStartedAtRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      if (mediaRecorderRef.current.state === "recording") {
        try {
          mediaRecorderRef.current.requestData();
        } catch {
          // Ignore browsers that reject requestData during stop.
        }
      }
      mediaRecorderRef.current.stop();
    } else {
      stopStream();
    }
  }, [stopStream]);

  const startRecording = useCallback(async () => {
    if (!supported) {
      throw new Error("unsupported");
    }

    clearRecording();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    streamRef.current = stream;
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];
    hasFinalizedRef.current = false;
    recordingStartedAtRef.current = Date.now();
    setDurationMs(0);
    setPreviewDurationMs(0);
    setStatus("recording");

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onerror = () => {
      stopStream();
      setStatus("error");
    };

    const finalizeRecording = () => {
      if (hasFinalizedRef.current) return;
      hasFinalizedRef.current = true;

      stopStream();
      const finalMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: finalMimeType });

      if (blob.size === 0) {
        setStatus("error");
        return;
      }

      const nextUrl = URL.createObjectURL(blob);
      const nextFile = new File([blob], `recording.${extensionForMimeType(finalMimeType)}`, {
        type: finalMimeType,
      });

      setPreviewUrl(nextUrl);
      setAudioFile(nextFile);
      setStatus("ready");

      void createRealWaveform(blob).then(({ waveform: nextWaveform, durationMs: nextDurationMs }) => {
        setWaveform(nextWaveform);
        if (nextDurationMs > 0) {
          setPreviewDurationMs(nextDurationMs);
        }
      });
    };

    mediaRecorder.onstop = () => {
      window.setTimeout(finalizeRecording, 0);
    };

    mediaRecorder.start(250);
    timerRef.current = window.setInterval(() => {
      const startedAt = recordingStartedAtRef.current ?? Date.now();
      const next = Math.min(MAX_DURATION_MS, Date.now() - startedAt);
      setDurationMs(next);
      if (next >= MAX_DURATION_MS) {
        stopRecording();
      }
    }, 100);
  }, [clearRecording, stopRecording, stopStream, supported]);

  const ensurePreviewAudio = useCallback(() => {
    if (!previewUrl) return null;

    if (!audioRef.current) {
      const audio = new Audio(previewUrl);
      audio.preload = "metadata";
      audio.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setPreviewDurationMs(Math.round(audio.duration * 1000));
        }
      });
      audio.addEventListener("timeupdate", () => {
        if (previewProgressRafId == null) {
          setPreviewCurrentTimeMs(Math.round(audio.currentTime * 1000));
        }
      });
      audio.addEventListener("play", () => {
        setIsPreviewPlaying(true);
        stopPreviewProgressLoop();

        const tick = () => {
          setPreviewCurrentTimeMs(Math.round(audio.currentTime * 1000));
          if (!audio.paused && !audio.ended) {
            previewProgressRafId = window.requestAnimationFrame(tick);
            return;
          }
          previewProgressRafId = null;
        };

        previewProgressRafId = window.requestAnimationFrame(tick);
      });
      audio.addEventListener("pause", () => {
        stopPreviewProgressLoop();
        setIsPreviewPlaying(false);
      });
      audio.addEventListener("ended", () => {
        stopPreviewProgressLoop();
        audio.currentTime = 0;
        setPreviewCurrentTimeMs(0);
        setIsPreviewPlaying(false);
      });
      audioRef.current = audio;
    }

    return audioRef.current;
  }, [previewUrl]);

  const togglePreviewPlayback = useCallback(async () => {
    const audio = ensurePreviewAudio();
    if (!audio) return;

    if (audio.paused) {
      await audio.play();
      return;
    }

    audio.pause();
  }, [ensurePreviewAudio]);

  const seekPreview = useCallback((timeMs: number) => {
    const audio = ensurePreviewAudio();
    if (!audio) return;

    const maxDurationMs = previewDurationMs || Math.round((audio.duration || 0) * 1000) || durationMs || 0;
    const nextTimeMs = Math.max(0, Math.min(timeMs, maxDurationMs));
    audio.currentTime = nextTimeMs / 1000;
    setPreviewCurrentTimeMs(nextTimeMs);
  }, [durationMs, ensurePreviewAudio, previewDurationMs]);

  useEffect(() => {
    return () => {
      stopPreviewProgressLoop();
      stopRecording();
      stopStream();
      clearRecording();
    };
  }, [clearRecording, stopRecording, stopStream]);

  return useMemo(() => ({
    audioFile,
    clearRecording,
    durationMs,
    isPreviewPlaying,
    previewCurrentTimeMs,
    previewDurationMs,
    previewUrl,
    seekPreview,
    startRecording,
    status,
    stopRecording,
    supported,
    togglePreviewPlayback,
    waveform,
  }), [
    audioFile,
    clearRecording,
    durationMs,
    isPreviewPlaying,
    previewCurrentTimeMs,
    previewDurationMs,
    previewUrl,
    seekPreview,
    startRecording,
    status,
    stopRecording,
    supported,
    togglePreviewPlayback,
    waveform,
  ]);
}
