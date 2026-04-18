import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useBackgroundStore } from '@/store/background.store';
import { resolveBackgroundStyle } from '@/lib/backgroundPresets';

interface UseBackgroundReturn {
  /** Inline style to apply to the root container */
  backgroundStyle: CSSProperties;
  /** Whether a custom background (preset or uploaded) is active */
  hasCustomBackground: boolean;
}

export function useBackground(): UseBackgroundReturn {
  const background = useBackgroundStore((s) => s.background);

  const backgroundStyle = useMemo(
    () => resolveBackgroundStyle(background),
    [background],
  );

  return {
    backgroundStyle,
    hasCustomBackground: !!background,
  };
}
