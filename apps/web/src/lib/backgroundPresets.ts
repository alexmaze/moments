import type { CSSProperties } from 'react';

/**
 * A texture-based background preset with light and dark mode variants.
 * Each preset bundles a tiling PNG texture, a fill colour, and a fixed intensity.
 */
export interface TexturePreset {
  id: string;
  nameKey: string; // i18n key under profile:edit.bg.*
  textureFile: string; // path under /public, e.g. '/textures/linen.png'
  light: { fillColor: string; intensity: number };
  dark: { fillColor: string; intensity: number };
}

// ── Texture presets ──────────────────────────────────────────────────────
// Source: Transparent Textures (https://www.transparenttextures.com/)
// License: free for personal & commercial use (CC BY-SA 3.0 — attribution via site credit)
//
// Intensity = CSS opacity for the texture overlay (0–1).
// Texture images are transparent PNGs with black/dark pattern content.
// The fillColor shows through transparent areas; intensity controls pattern visibility.

export const TEXTURE_PRESETS: TexturePreset[] = [
  {
    id: 'texture-food',
    nameKey: 'food',
    textureFile: '/textures/food.png',
    light: { fillColor: '#fdf8f0', intensity: 0.15 },
    dark:  { fillColor: '#1a1612', intensity: 0.12 },
  },
  {
    id: 'texture-connected',
    nameKey: 'connected',
    textureFile: '/textures/connected.png',
    light: { fillColor: '#faf5ed', intensity: 0.20 },
    dark:  { fillColor: '#18181b', intensity: 0.15 },
  },
  {
    id: 'texture-gplay',
    nameKey: 'gplay',
    textureFile: '/textures/gplay.png',
    light: { fillColor: '#f8f4ee', intensity: 0.12 },
    dark:  { fillColor: '#161618', intensity: 0.10 },
  },
  {
    id: 'texture-geometry',
    nameKey: 'geometry',
    textureFile: '/textures/inspiration-geometry.png',
    light: { fillColor: '#fefaf4', intensity: 0.18 },
    dark:  { fillColor: '#1c1a1e', intensity: 0.14 },
  },
  {
    id: 'texture-wool',
    nameKey: 'wool',
    textureFile: '/textures/light-wool.png',
    light: { fillColor: '#f5efe5', intensity: 0.15 },
    dark:  { fillColor: '#141e1a', intensity: 0.10 },
  },
  {
    id: 'texture-plaid',
    nameKey: 'plaid',
    textureFile: '/textures/my-little-plaid-dark.png',
    light: { fillColor: '#f2ede5', intensity: 0.10 },
    dark:  { fillColor: '#121214', intensity: 0.18 },
  },
  {
    id: 'texture-grey',
    nameKey: 'grey',
    textureFile: '/textures/random-grey-variations.png',
    light: { fillColor: '#f6f2ec', intensity: 0.15 },
    dark:  { fillColor: '#1a1a1c', intensity: 0.12 },
  },
  {
    id: 'texture-robots',
    nameKey: 'robots',
    textureFile: '/textures/robots.png',
    light: { fillColor: '#faf6f0', intensity: 0.12 },
    dark:  { fillColor: '#18161a', intensity: 0.10 },
  },
  {
    id: 'texture-skulls',
    nameKey: 'skulls',
    textureFile: '/textures/skulls.png',
    light: { fillColor: '#fefcf8', intensity: 0.08 },
    dark:  { fillColor: '#141216', intensity: 0.15 },
  },
  {
    id: 'texture-subtle',
    nameKey: 'subtle',
    textureFile: '/textures/subtle-grey.png',
    light: { fillColor: '#f4f0ea', intensity: 0.10 },
    dark:  { fillColor: '#1c1c1e', intensity: 0.08 },
  },
  {
    id: 'texture-dots',
    nameKey: 'dots',
    textureFile: '/textures/3px-tile.png',
    light: { fillColor: '#fcf8f2', intensity: 0.20 },
    dark:  { fillColor: '#161418', intensity: 0.18 },
  },
];

/** Fast O(1) lookup by preset ID */
export const PRESET_MAP = new Map(TEXTURE_PRESETS.map((p) => [p.id, p]));

/**
 * Converts a stored background value (preset ID or null)
 * into CSSProperties for the given colour mode.
 */
export function resolveBackgroundStyle(
  background: string | null | undefined,
  isDark: boolean,
): CSSProperties {
  if (!background) return {};

  const preset = PRESET_MAP.get(background);
  if (!preset) return {}; // unknown/legacy value → fall back to default

  const variant = isDark ? preset.dark : preset.light;

  return {
    backgroundColor: variant.fillColor,
    backgroundImage: `url(${preset.textureFile})`,
    backgroundRepeat: 'repeat',
  };
}
