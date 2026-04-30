import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
  size?: 'sm' | 'md';
  stopPropagation?: boolean;
}

interface SliderMeasurement {
  transform: CSSProperties['transform'];
  width: string;
}

const DEFAULT_SLIDER_MEASUREMENT: SliderMeasurement = {
  transform: 'translate3d(0px, 0, 0)',
  width: '0px',
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  ariaLabel,
  className,
  buttonClassName,
  size = 'md',
  stopPropagation = false,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const pendingFrameRef = useRef<number | null>(null);
  const [visualValue, setVisualValue] = useState(value);
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === visualValue));
  const [sliderMeasurements, setSliderMeasurements] = useState<SliderMeasurement[]>([]);

  const measureButtons = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const nextMeasurements = options.map((_, index) => {
      const button = buttonsRef.current[index];
      if (!button) return DEFAULT_SLIDER_MEASUREMENT;

      const buttonRect = button.getBoundingClientRect();
      return {
        transform: `translate3d(${buttonRect.left - containerRect.left}px, 0, 0)`,
        width: `${buttonRect.width}px`,
      };
    });

    setSliderMeasurements((currentMeasurements) => {
      const isSame =
        currentMeasurements.length === nextMeasurements.length &&
        currentMeasurements.every(
          (measurement, index) =>
            measurement.transform === nextMeasurements[index].transform &&
            measurement.width === nextMeasurements[index].width,
        );

      return isSame ? currentMeasurements : nextMeasurements;
    });
  }, [options]);

  useLayoutEffect(() => {
    measureButtons();
  }, [measureButtons]);

  useLayoutEffect(() => {
    window.addEventListener('resize', measureButtons);
    return () => window.removeEventListener('resize', measureButtons);
  }, [measureButtons]);

  useEffect(() => {
    setVisualValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
      }
    };
  }, []);

  const sliderStyle = sliderMeasurements[activeIndex] ?? DEFAULT_SLIDER_MEASUREMENT;

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex items-center rounded-full border border-border surface-card p-1 shadow-sm',
        className,
      )}
    >
      <span
        aria-hidden
        className="segmented-control-slider absolute top-1 left-0 h-[calc(100%-8px)] rounded-full border border-border/70 surface-overlay shadow-md ring-1 ring-primary/10"
        style={sliderStyle}
      />

      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            buttonsRef.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === visualValue}
          onClick={(event) => {
            if (stopPropagation) {
              event.preventDefault();
              event.stopPropagation();
            }
            if (option.value === visualValue) return;

            setVisualValue(option.value);
            if (pendingFrameRef.current !== null) {
              cancelAnimationFrame(pendingFrameRef.current);
            }
            pendingFrameRef.current = requestAnimationFrame(() => {
              pendingFrameRef.current = null;
              onValueChange(option.value);
            });
          }}
          className={cn(
            'relative z-10 rounded-full font-medium transition-colors duration-150 cursor-pointer select-none',
            size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
            option.value === visualValue
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/80',
            buttonClassName,
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
