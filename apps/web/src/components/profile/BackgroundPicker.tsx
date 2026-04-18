import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ImagePlus, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BACKGROUND_PRESETS,
  PRESET_MAP,
  resolveBackgroundStyle,
  isCustomUrl,
} from '@/lib/backgroundPresets';
import type { CSSProperties } from 'react';

// ── Swatch button ────────────────────────────────────────────────────────
function Swatch({
  style,
  label,
  selected,
  onClick,
  children,
}: {
  style?: CSSProperties;
  label: string;
  selected: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        'relative w-10 h-10 rounded-lg shrink-0 border-2 transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        selected
          ? 'border-primary shadow-md scale-110'
          : 'border-transparent hover:border-muted-foreground/40 hover:scale-105',
      )}
      style={style}
    >
      {selected && !children && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Check className="h-4 w-4 text-white" style={{ filter: 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.8))' }} />
        </span>
      )}
      {children}
    </button>
  );
}

// ── Vertical divider between groups ─────────────────────────────────────
function Divider() {
  return <div className="h-8 w-px bg-border shrink-0 mx-1" />;
}

// ── Public component ─────────────────────────────────────────────────────
interface BackgroundPickerProps {
  value: string | null;
  onChange: (bg: string | null) => void;
  isUploading?: boolean;
  onUploadFile: (file: File) => void;
}

export default function BackgroundPicker({
  value,
  onChange,
  isUploading,
  onUploadFile,
}: BackgroundPickerProps) {
  const { t } = useTranslation('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isCustom = isCustomUrl(value);

  // Convert vertical mouse wheel → horizontal scroll for the swatch row
  // Must use addEventListener with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      if (!el || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const solids = BACKGROUND_PRESETS.filter((p) => p.type === 'solid');
  const gradients = BACKGROUND_PRESETS.filter((p) => p.type === 'gradient');
  const patterns = BACKGROUND_PRESETS.filter((p) => p.type === 'pattern');

  // Preview style for the strip at the bottom
  const previewStyle = isCustom
    ? resolveBackgroundStyle(value)
    : PRESET_MAP.get(value ?? '')?.style;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground mb-1">
        {t('edit.backgroundLabel')}
      </label>

      {/* Horizontal scrollable swatch row */}
      <div ref={scrollRef} className="overflow-x-auto rounded-md scrollbar-none">
        <div className="flex gap-2 py-1 px-0.5 items-center min-w-min">
          {/* Default (reset to theme background) */}
          <Swatch
            label={t('edit.backgroundDefault')}
            selected={!value}
            onClick={() => onChange(null)}
            style={{
              background:
                'repeating-linear-gradient(45deg, #e0e0e0 0, #e0e0e0 4px, #f8f8f8 0, #f8f8f8 8px)',
            }}
          />
          <Divider />

          {/* Solid colours */}
          {solids.map((p) => (
            <Swatch
              key={p.id}
              style={p.style}
              label={p.nameKey}
              selected={value === p.id}
              onClick={() => onChange(p.id)}
            />
          ))}
          <Divider />

          {/* Gradients */}
          {gradients.map((p) => (
            <Swatch
              key={p.id}
              style={p.style}
              label={p.nameKey}
              selected={value === p.id}
              onClick={() => onChange(p.id)}
            />
          ))}
          <Divider />

          {/* Patterns */}
          {patterns.map((p) => (
            <Swatch
              key={p.id}
              style={p.style}
              label={p.nameKey}
              selected={value === p.id}
              onClick={() => onChange(p.id)}
            />
          ))}
          <Divider />

          {/* Custom upload button */}
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            title={t('edit.backgroundUpload')}
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'relative w-10 h-10 rounded-lg shrink-0 border-2 transition-all duration-150',
              'flex items-center justify-center',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isCustom
                ? 'border-primary scale-110'
                : 'border-dashed border-muted-foreground/40 hover:border-muted-foreground/70 hover:bg-muted/50',
            )}
            style={isCustom ? { ...resolveBackgroundStyle(value), backgroundAttachment: 'scroll' } : undefined}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : isCustom ? (
              <Check className="h-4 w-4 text-white" style={{ filter: 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.8))' }} />
            ) : (
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Clear custom — only shown when a URL is selected */}
          {isCustom && (
            <button
              type="button"
              title={t('edit.backgroundRemove')}
              onClick={() => onChange(null)}
              className="w-6 h-6 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center shrink-0 transition-colors"
            >
              <X className="h-3 w-3 text-destructive" />
            </button>
          )}
        </div>
      </div>

      {/* Full-width preview strip */}
      {value && previewStyle && (
        <div
          aria-label="Background preview"
          className="w-full h-16 rounded-lg border transition-all duration-300"
          style={previewStyle}
        />
      )}
    </div>
  );
}
