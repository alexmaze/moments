import { useEffect } from 'react';
import { useThemeStore } from '@/store/theme.store';

/**
 * Mount ONCE at the app root.
 * Applies/removes .dark on <html> and manages the system-preference media listener.
 */
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const apply = (isDark: boolean) =>
      document.documentElement.classList.toggle('dark', isDark);

    if (theme === 'dark') {
      apply(true);
      return;
    }
    if (theme === 'light') {
      apply(false);
      return;
    }

    // theme === null → Follow System
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);

    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);
}
