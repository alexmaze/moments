import { create } from "zustand";

type PlayerStatus = "idle" | "playing" | "paused";

interface PostAudioPlayerState {
  currentPostId?: string;
  currentUrl?: string;
  status: PlayerStatus;
  currentTimeMs: number;
  durationMs: number;
  play: (postId: string, url: string, durationMs?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (timeMs: number) => void;
}

let sharedAudio: HTMLAudioElement | null = null;
let rafId: number | null = null;

function stopProgressLoop() {
  if (rafId == null || typeof window === "undefined") return;
  window.cancelAnimationFrame(rafId);
  rafId = null;
}

function startProgressLoop(
  audio: HTMLAudioElement,
  set: (updater: Partial<PostAudioPlayerState>) => void,
) {
  if (typeof window === "undefined") return;

  stopProgressLoop();

  const tick = () => {
    set({ currentTimeMs: Math.max(0, Math.round(audio.currentTime * 1000)) });
    if (!audio.paused && !audio.ended) {
      rafId = window.requestAnimationFrame(tick);
      return;
    }
    rafId = null;
  };

  rafId = window.requestAnimationFrame(tick);
}

function ensureAudio(set: (updater: Partial<PostAudioPlayerState>) => void) {
  if (sharedAudio || typeof window === "undefined") return sharedAudio;

  const audio = new Audio();
  audio.preload = "metadata";
  audio.addEventListener("loadedmetadata", () => {
    set({ durationMs: Number.isFinite(audio.duration) ? Math.max(0, Math.round(audio.duration * 1000)) : 0 });
  });
  audio.addEventListener("timeupdate", () => {
    if (rafId == null) {
      set({ currentTimeMs: Math.max(0, Math.round(audio.currentTime * 1000)) });
    }
  });
  audio.addEventListener("play", () => {
    set({ status: "playing" });
    startProgressLoop(audio, set);
  });
  audio.addEventListener("pause", () => {
    stopProgressLoop();
    set((audio.ended || audio.currentTime === 0) ? { status: "idle" } : { status: "paused" });
  });
  audio.addEventListener("ended", () => {
    stopProgressLoop();
    audio.currentTime = 0;
    set({
      currentPostId: undefined,
      currentUrl: undefined,
      currentTimeMs: 0,
      status: "idle",
    });
  });
  audio.addEventListener("error", () => {
    stopProgressLoop();
    audio.pause();
    audio.currentTime = 0;
    set({
      currentPostId: undefined,
      currentUrl: undefined,
      currentTimeMs: 0,
      status: "idle",
    });
  });

  sharedAudio = audio;
  return sharedAudio;
}

export const usePostAudioPlayerStore = create<PostAudioPlayerState>((set, get) => ({
  currentPostId: undefined,
  currentUrl: undefined,
  status: "idle",
  currentTimeMs: 0,
  durationMs: 0,
  play: async (postId, url, durationMs) => {
    const audio = ensureAudio((next) => set(next));
    if (!audio) return;

    const isSameTrack = get().currentPostId === postId && get().currentUrl === url;

    if (!isSameTrack) {
      stopProgressLoop();
      audio.pause();
      audio.currentTime = 0;
      audio.src = url;
      set({
        currentPostId: postId,
        currentUrl: url,
        currentTimeMs: 0,
        durationMs: durationMs ?? 0,
        status: "paused",
      });
    }

    await audio.play();
  },
  pause: () => {
    sharedAudio?.pause();
  },
  stop: () => {
    if (!sharedAudio) {
      set({
        currentPostId: undefined,
        currentUrl: undefined,
        currentTimeMs: 0,
        durationMs: 0,
        status: "idle",
      });
      return;
    }

    stopProgressLoop();
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
    set({
      currentPostId: undefined,
      currentUrl: undefined,
      currentTimeMs: 0,
      durationMs: 0,
      status: "idle",
    });
  },
  seek: (timeMs) => {
    if (!sharedAudio) return;
    sharedAudio.currentTime = timeMs / 1000;
    set({ currentTimeMs: timeMs });
  },
}));
