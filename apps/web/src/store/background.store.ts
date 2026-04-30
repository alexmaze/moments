import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PRESET_MAP } from '@/lib/backgroundPresets';

interface BackgroundState {
  /** Texture preset ID (e.g. 'texture-food'), or null for the default theme background */
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
      onRehydrateStorage: () => (state, error) => {
        // Unknown/legacy preset ID → reset to default (null).
        // Uses setState so the correction flows through persist's write-back,
        // cleaning the dirty value from localStorage on the first startup.
        if (!error && state && state.background !== null && !PRESET_MAP.has(state.background)) {
          useBackgroundStore.setState({ background: null });
        }
      },
    },
  ),
);
