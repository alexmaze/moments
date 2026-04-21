import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEXTURE_PRESETS, PRESET_MAP } from '@/lib/backgroundPresets';
import { useThemeStore, getEffectiveTheme } from '@/store/theme.store';
import type { CSSProperties } from 'react';

function Swatch({
  style,
  label,
  selected,
  onClick,
}: {
  style: CSSProperties;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        'relative w-12 h-12 rounded-lg shrink-0 border-2 transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        selected
          ? 'border-primary shadow-md scale-110'
          : 'border-transparent hover:border-muted-foreground/40 hover:scale-105',
      )}
      style={style}
    >
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Check className="h-5 w-5 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.8))' }} />
        </span>
      )}
    </button>
  );
}

interface BackgroundPickerProps {
  value: string | null;
  onChange: (bg: string | null) => void;
}

export default function BackgroundPicker({ value, onChange }: BackgroundPickerProps) {
  const { t } = useTranslation('profile');
  const theme = useThemeStore((s) => s.theme);

  const effectiveTheme = theme ?? getEffectiveTheme();
  const isDark = effectiveTheme === 'dark';

  const getSwatchStyle = (presetId: string): CSSProperties => {
    const preset = PRESET_MAP.get(presetId);
    if (!preset) return {};
    const variant = isDark ? preset.dark : preset.light;
    return {
      backgroundColor: variant.fillColor,
      backgroundImage: `url(${preset.textureFile})`,
      backgroundRepeat: 'repeat',
    };
  };

  const selectedPreset = PRESET_MAP.get(value ?? '');
  const previewStyle = selectedPreset ? getSwatchStyle(value!) : null;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground mb-1">
        {t('edit.backgroundLabel')}
      </label>

      <div className="flex flex-wrap gap-3 py-1">
        <Swatch
          style={{
            background:
              'repeating-linear-gradient(45deg, #e0e0e0 0, #e0e0e0 4px, #f8f8f8 0, #f8f8f8 8px)',
          }}
          label={t('edit.backgroundDefault')}
          selected={!value}
          onClick={() => onChange(null)}
        />

        {TEXTURE_PRESETS.map((preset) => (
          <Swatch
            key={preset.id}
            style={getSwatchStyle(preset.id)}
            label={t(`edit.bg.${preset.nameKey}` as any)}
            selected={value === preset.id}
            onClick={() => onChange(preset.id)}
          />
        ))}
      </div>

      {value && previewStyle && (
        <div
          aria-label="Background preview"
          className="w-full h-20 rounded-lg border transition-all duration-300"
          style={previewStyle}
        />
      )}
    </div>
  );
}
