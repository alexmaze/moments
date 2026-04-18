import { useState, useRef, useEffect } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const selectedSpace = spaces?.find((s) => s.id === selectedSpaceId);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
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

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-card shadow-md">
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
        </div>
      )}
    </div>
  );
}
