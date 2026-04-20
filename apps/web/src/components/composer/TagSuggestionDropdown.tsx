import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Hash } from 'lucide-react';
import type { TagDto } from '@/api/tags.api';

interface TagSuggestionDropdownProps {
  isOpen: boolean;
  suggestions: TagDto[];
  query: string;
  selectedIndex: number;
  position: { top: number; left: number } | null;
  onSelect: (tag: TagDto) => void;
  onClose: () => void;
}

export function TagSuggestionDropdown({
  isOpen,
  suggestions,
  query,
  selectedIndex,
  position,
  onSelect,
  onClose,
}: TagSuggestionDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (containerRef.current && suggestions.length > 0) {
      const selectedEl = containerRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, suggestions.length]);

  if (!isOpen || suggestions.length === 0 || !position) {
    return null;
  }

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-[9999] min-w-[180px] max-w-[280px] rounded-lg border border-border bg-card shadow-lg"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="max-h-48 overflow-y-auto py-1">
        {suggestions.map((tag, index) => (
          <button
            key={tag.id}
            type="button"
            data-index={index}
            onClick={() => onSelect(tag)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <Hash className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate font-medium">
              <span className="text-primary">{tag.name.slice(0, query.length)}</span>
              <span>{tag.name.slice(query.length)}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {tag.postCount}
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}