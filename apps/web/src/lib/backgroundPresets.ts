import type { CSSProperties } from 'react';

export type PresetType = 'solid' | 'gradient' | 'pattern';

export interface BackgroundPreset {
  id: string;
  nameKey: string; // i18n key under profile:edit.bg.*
  type: PresetType;
  style: CSSProperties;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  // ── Solid colours ─────────────────────────────────────────────────────
  { id: 'solid-snow',  nameKey: 'snow',  type: 'solid', style: { background: '#f8fafc' } },
  { id: 'solid-linen', nameKey: 'linen', type: 'solid', style: { background: '#fdf8f0' } },
  { id: 'solid-clay',  nameKey: 'clay',  type: 'solid', style: { background: '#f5ede0' } },
  { id: 'solid-sage',  nameKey: 'sage',  type: 'solid', style: { background: '#e8f0e8' } },
  { id: 'solid-slate', nameKey: 'slate', type: 'solid', style: { background: '#dde3ee' } },
  { id: 'solid-dusk',  nameKey: 'dusk',  type: 'solid', style: { background: '#1e2235' } },

  // ── Gradients ─────────────────────────────────────────────────────────
  { id: 'gradient-sunrise', nameKey: 'sunrise', type: 'gradient',
    style: { background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' } },
  { id: 'gradient-sunset',  nameKey: 'sunset',  type: 'gradient',
    style: { background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' } },
  { id: 'gradient-aurora',  nameKey: 'aurora',  type: 'gradient',
    style: { background: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' } },
  { id: 'gradient-ocean',   nameKey: 'ocean',   type: 'gradient',
    style: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } },
  { id: 'gradient-forest',  nameKey: 'forest',  type: 'gradient',
    style: { background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' } },
  { id: 'gradient-candy',   nameKey: 'candy',   type: 'gradient',
    style: { background: 'linear-gradient(135deg, #ffd89b 0%, #f7797d 100%)' } },

  // ── CSS Patterns (Telegram-style, no image files) ─────────────────────
  { id: 'pattern-dots', nameKey: 'dots', type: 'pattern', style: {
    backgroundColor: '#e5e5f7',
    backgroundImage: 'radial-gradient(#9090cc 1px, #e5e5f7 1px)',
    backgroundSize: '16px 16px',
  }},
  { id: 'pattern-grid', nameKey: 'grid', type: 'pattern', style: {
    backgroundColor: '#f0f0f0',
    backgroundImage:
      'linear-gradient(#d0d0d0 1px, transparent 1px),' +
      'linear-gradient(90deg, #d0d0d0 1px, transparent 1px)',
    backgroundSize: '24px 24px',
  }},
  { id: 'pattern-ruled', nameKey: 'ruled', type: 'pattern', style: {
    backgroundColor: '#f8f8f8',
    backgroundImage:
      'repeating-linear-gradient(0deg, transparent, transparent 23px, #d8d8d8 23px, #d8d8d8 24px)',
  }},
  { id: 'pattern-diagonal', nameKey: 'diagonal', type: 'pattern', style: {
    backgroundColor: '#f4f4f4',
    backgroundImage:
      'repeating-linear-gradient(45deg, #e0e0e0 0, #e0e0e0 1px, #f4f4f4 0, #f4f4f4 50%)',
    backgroundSize: '16px 16px',
  }},
  { id: 'pattern-checker', nameKey: 'checker', type: 'pattern', style: {
    backgroundColor: '#ebebeb',
    backgroundImage:
      'linear-gradient(45deg, #d8d8d8 25%, transparent 25%),' +
      'linear-gradient(-45deg, #d8d8d8 25%, transparent 25%),' +
      'linear-gradient(45deg, transparent 75%, #d8d8d8 75%),' +
      'linear-gradient(-45deg, transparent 75%, #d8d8d8 75%)',
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
  }},
];

/** Fast O(1) lookup by preset ID */
export const PRESET_MAP = new Map(BACKGROUND_PRESETS.map((p) => [p.id, p]));

/**
 * Converts a stored background value (preset ID, image URL, or null)
 * into CSSProperties ready for inline style application.
 */
export function resolveBackgroundStyle(background: string | null | undefined): CSSProperties {
  if (!background) return {};

  // Custom image URL — uploaded via /users/me/background
  if (background.startsWith('http://') || background.startsWith('https://') || background.startsWith('/')) {
    return {
      backgroundImage: `url(${background})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    };
  }

  // Named preset
  return PRESET_MAP.get(background)?.style ?? {};
}

/** Check whether a value is a custom URL (uploaded image) rather than a preset ID */
export function isCustomUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/uploads');
}
