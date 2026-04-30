import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SupportedTheme } from '@moments/shared';
import { isValidTheme } from '@/lib/theme';

interface ThemeState {
  /** null = follow system preference */
  theme: SupportedTheme | null;
  setTheme: (theme: SupportedTheme | null) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: null,
      setTheme: (theme) => set({ theme }),
    }),
    {
      // COUPLING: This storage key and the { state: { theme } } envelope shape
      // are mirrored in the FOUT prevention inline script in index.html.
      // Change both together if you rename this or restructure partialize().
      name: 'moments-theme',
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state, error) => {
        // Guard against corrupt/legacy stored values.
        // Uses setState so the correction flows through persist's write-back,
        // cleaning the dirty value from localStorage on the first startup.
        if (!error && state && !isValidTheme(state.theme)) {
          useThemeStore.setState({ theme: null });
        }
      },
    },
  ),
);
