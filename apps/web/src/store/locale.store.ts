import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SupportedLocale } from '@/types/dto';

/** Detect locale from browser language */
export function detectBrowserLocale(): SupportedLocale {
  if (navigator.language.startsWith('zh')) return 'zh-CN';
  return 'en';
}

interface LocaleState {
  /** null = follow browser language */
  locale: SupportedLocale | null;
  setLocale: (locale: SupportedLocale | null) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: null,
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'moments-locale',
      partialize: (state) => ({ locale: state.locale }),
    },
  ),
);

/** Get the effective locale to use (resolved from store or browser) */
export function getEffectiveLocale(): SupportedLocale {
  const stored = useLocaleStore.getState().locale;
  return stored ?? detectBrowserLocale();
}
