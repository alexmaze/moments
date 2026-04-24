import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SupportedTheme } from '@moments/shared';

/** Detect theme from OS preference */
export function detectSystemTheme(): SupportedTheme {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

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
      name: 'moments-theme',
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);

/** Get the effective theme to use (resolved from store or system) */
export function getEffectiveTheme(): SupportedTheme {
  const stored = useThemeStore.getState().theme;
  return stored ?? detectSystemTheme();
}
