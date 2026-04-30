import type { SupportedTheme } from '@moments/shared';
import { SUPPORTED_THEMES } from '@moments/shared';

/**
 * Reads the OS-level colour scheme preference.
 * Returns 'light' when `window` is unavailable (SSR safety).
 */
export function detectSystemTheme(): SupportedTheme {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

/**
 * Resolves the effective theme from a stored preference.
 * `null` means "follow the system", so we fall through to `detectSystemTheme()`.
 */
export function resolveTheme(stored: SupportedTheme | null): SupportedTheme {
  return stored ?? detectSystemTheme();
}

/**
 * Type-guard for validating a raw value from localStorage or API response.
 * Accepts `null` (= system preference) as a valid stored state.
 */
export function isValidTheme(value: unknown): value is SupportedTheme | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      (SUPPORTED_THEMES as readonly string[]).includes(value))
  );
}
