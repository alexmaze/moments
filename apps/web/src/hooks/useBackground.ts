import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useBackgroundStore } from '@/store/background.store';
import { useThemeStore, getEffectiveTheme } from '@/store/theme.store';
import { resolveBackgroundStyle } from '@/lib/backgroundPresets';

interface UseBackgroundReturn {
  backgroundStyle: CSSProperties;
  hasCustomBackground: boolean;
}

export function useBackground(): UseBackgroundReturn {
  const background = useBackgroundStore((s) => s.background);
  const theme = useThemeStore((s) => s.theme);

  const backgroundStyle = useMemo(() => {
    const effectiveTheme = theme ?? getEffectiveTheme();
    const isDark = effectiveTheme === 'dark';
    return resolveBackgroundStyle(background, isDark);
  }, [background, theme]);

  return {
    backgroundStyle,
    hasCustomBackground: !!background,
  };
}
