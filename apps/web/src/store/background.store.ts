import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BackgroundState {
  /** Preset ID (e.g. 'gradient-sunset'), image URL, or null (default theme bg) */
  background: string | null;
  setBackground: (background: string | null) => void;
}

export const useBackgroundStore = create<BackgroundState>()(
  persist(
    (set) => ({
      background: null,
      setBackground: (background) => set({ background }),
    }),
    {
      name: 'moments-background',
      partialize: (state) => ({ background: state.background }),
    },
  ),
);
