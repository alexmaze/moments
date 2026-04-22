import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X, Globe, Baby } from 'lucide-react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { useMySpaces } from '@/hooks/useSpaces';

interface SpaceSelectorProps {
  selectedSpaceId?: string;
  onChange: (spaceId: string | undefined) => void;
}

export function SpaceSelector({ selectedSpaceId, onChange }: SpaceSelectorProps) {
  const { t } = useTranslation('spaces');
  const { data: spaces, isLoading } = useMySpaces();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const selectedSpace = spaces?.find((s) => s.id === selectedSpaceId);

  const triggerRect = triggerRef.current?.getBoundingClientRect();
  const dropdownStyle: React.CSSProperties = triggerRect
    ? {
        position: 'fixed',
        top: triggerRect.bottom + 4,
        left: triggerRect.left,
        minWidth: triggerRect.width,
      }
    : {};

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
      >
        <span className="text-muted-foreground">{t('composer.selectSpace')}</span>
        <span className="font-medium">
          {selectedSpace ? selectedSpace.name : t('composer.mainFeed')}
        </span>
        {selectedSpace ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onChange(undefined);
              }
            }}
            className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Dropdown via portal */}
      {isOpen && triggerRect && createPortal(
        <div
          ref={dropdownRef}
          className="z-[9999] w-64 rounded-lg border border-border surface-overlay shadow-md"
          style={dropdownStyle}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isLoading && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              ...
            </div>
          )}

          {!isLoading && (!spaces || spaces.length === 0) && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {t('list.empty')}
            </div>
          )}

          {!isLoading && spaces && spaces.length > 0 && (
            <OverlayScrollbarsComponent
              element="div"
              className="max-h-60 py-1"
              options={{
                scrollbars: {
                  theme: 'os-theme-moments',
                  autoHide: 'scroll',
                  autoHideDelay: 800,
                },
              }}
              defer
            >
              {/* Main feed option */}
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                  !selectedSpaceId ? 'bg-primary/5 text-primary' : 'text-foreground'
                }`}
              >
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{t('composer.mainFeed')}</span>
              </button>

              <div className="mx-3 my-1 border-t border-border" />

              {/* Space options */}
              {spaces.map((space) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => {
                    onChange(space.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    selectedSpaceId === space.id
                      ? 'bg-primary/5 text-primary'
                      : 'text-foreground'
                  }`}
                >
                  {space.type === 'baby' ? (
                    <Baby className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/10">
                      <span className="text-[10px] font-bold text-primary">
                        {space.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="truncate font-medium">{space.name}</span>
                </button>
              ))}
            </OverlayScrollbarsComponent>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
