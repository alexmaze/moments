import { useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { renderContentWithTags } from '@moments/shared';

interface HighlightTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean | void;
}

const SHARED_CLASSES = [
  'w-full',
  'p-0',
  'text-sm',
  'leading-relaxed',
  'whitespace-pre-wrap',
  'break-words',
  'font-inherit',
].join(' ');

function mergeRefs<T>(
  ...refs: Array<React.ForwardedRef<T> | React.RefObject<T | null>>
) {
  return (node: T | null) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref && typeof ref === 'object') {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    });
  };
}

export const HighlightTextarea = forwardRef<HTMLTextAreaElement, HighlightTextareaProps>(
  function HighlightTextarea(
    { value, onChange, placeholder, className = '', minRows = 3, onKeyDown },
    forwardedRef,
  ) {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    const segments = useMemo(() => renderContentWithTags(value), [value]);

    const handleScroll = useCallback(() => {
      if (overlayRef.current && internalRef.current) {
        overlayRef.current.scrollTop = internalRef.current.scrollTop;
        overlayRef.current.scrollLeft = internalRef.current.scrollLeft;
      }
    }, []);

    const autoResize = useCallback(() => {
      const el = internalRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    useEffect(() => {
      autoResize();
    }, [value, autoResize]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (onKeyDown) {
        const result = onKeyDown(e);
        if (result === true) return;
      }
    };

    return (
      <div className={`relative ${className}`}>
        <div
          ref={overlayRef}
          className={`absolute inset-0 pointer-events-none overflow-hidden ${SHARED_CLASSES} text-foreground`}
          aria-hidden="true"
        >
          {value ? (
            segments.map((segment, index) =>
              segment.type === 'tag' ? (
                <span key={index} className="text-primary font-medium">
                  #{segment.value}
                </span>
              ) : (
                <span key={index}>{segment.value}</span>
              ),
            )
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>

        <textarea
          ref={mergeRefs(internalRef, forwardedRef)}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          rows={minRows}
          className={`${SHARED_CLASSES} bg-transparent resize-none focus:outline-none caret-primary selection:bg-primary/20`}
          style={{
            color: 'transparent',
            caretColor: 'hsl(var(--primary))',
          }}
        />
      </div>
    );
  },
);
