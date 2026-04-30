import { useRef, useLayoutEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/store/theme.store';
import { cn } from '@/lib/utils';

type ThemeOption = 'light' | 'dark' | 'system';

export default function ThemeSegmentedControl() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const [sliderStyle, setSliderStyle] = useState<{ transform: string; width: string }>({
    transform: 'translateX(0px)',
    width: '0px',
  });

  const options: { value: ThemeOption; label: string }[] = [
    { value: 'light', label: t('theme.light') },
    { value: 'dark', label: t('theme.dark') },
    { value: 'system', label: t('theme.systemShort') },
  ];

  const activeValue: ThemeOption = theme === null ? 'system' : theme;
  const activeIndex = options.findIndex((o) => o.value === activeValue);

  const updateSlider = useCallback(() => {
    const btn = buttonsRef.current[activeIndex];
    if (!btn || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const offsetX = btnRect.left - containerRect.left;

    setSliderStyle({
      transform: `translateX(${offsetX}px)`,
      width: `${btnRect.width}px`,
    });
  }, [activeIndex]);

  useLayoutEffect(() => {
    updateSlider();
  }, [updateSlider]);

  // Re-measure on window resize (font loading, zoom, etc.)
  useLayoutEffect(() => {
    window.addEventListener('resize', updateSlider);
    return () => window.removeEventListener('resize', updateSlider);
  }, [updateSlider]);

  const handleSelect = (value: ThemeOption) => {
    if (value === 'system') {
      setTheme(null);
    } else {
      setTheme(value);
    }
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={t('theme.light')}
      className="relative inline-flex items-center rounded-full bg-muted/60 p-1"
    >
      {/* Sliding highlight pill */}
      <div
        aria-hidden
        className="absolute top-1 left-0 h-[calc(100%-8px)] rounded-full bg-background shadow-sm transition-[transform,width] duration-200 ease-out"
        style={sliderStyle}
      />

      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(el) => { buttonsRef.current[index] = el; }}
          role="radio"
          aria-checked={option.value === activeValue}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSelect(option.value);
          }}
          className={cn(
            'relative z-10 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer select-none',
            option.value === activeValue
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/80',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
