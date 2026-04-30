import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useBackgroundStore } from '@/store/background.store';
import { useThemeStore } from '@/store/theme.store';
import { resolveTheme } from '@/lib/theme';
import { resolveBackgroundStyle } from '@/lib/backgroundPresets';

interface UseBackgroundReturn {
  backgroundStyle: CSSProperties;
  hasCustomBackground: boolean;
}

export function useBackground(): UseBackgroundReturn {
  const background = useBackgroundStore((s) => s.background);
  const theme = useThemeStore((s) => s.theme);

  const backgroundStyle = useMemo(() => {
    const isDark = resolveTheme(theme) === 'dark';
    return resolveBackgroundStyle(background, isDark);
  }, [background, theme]);

  return {
    backgroundStyle,
    hasCustomBackground: !!background,
  };
}
