import { useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker, { type EmojiClickData, Theme, Categories } from 'emoji-picker-react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/store/theme.store';
import { resolveTheme } from '@/lib/theme';

interface EmojiPickerPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmojiSelect: (emoji: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const PICKER_WIDTH = 280;
const PICKER_HEIGHT = 340;

const pickerStyle = {
  '--epr-horizontal-padding': '8px',
  '--epr-header-padding': '10px var(--epr-horizontal-padding)',
  '--epr-search-input-height': '34px',
  '--epr-search-input-padding': '0 26px',
  '--epr-category-navigation-button-size': '26px',
  '--epr-preview-height': '52px',
  '--epr-preview-text-size': '12px',
  '--epr-category-label-height': '26px',
  '--epr-emoji-size': '24px',
  '--epr-emoji-padding': '4px',
} as CSSProperties;

const pickerScopedCss = `
  [data-emoji-picker-popover] .epr-emoji-category-label {
    font-size: 12px !important;
    font-weight: 500 !important;
    letter-spacing: 0 !important;
  }

  [data-emoji-picker-popover] .EmojiPickerReact input {
    font-size: 12px !important;
    font-weight: 400 !important;
  }

  [data-emoji-picker-popover] .EmojiPickerReact [class*="preview"] {
    font-size: 11px !important;
    font-weight: 400 !important;
  }
`;

export function EmojiPickerPopover({
  open,
  onOpenChange,
  onEmojiSelect,
  anchorRef,
}: EmojiPickerPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('feed');

  const categories = useMemo(
    () => [
      { category: Categories.SUGGESTED, name: t('quickComposer.emojiCategoryRecent') },
      { category: Categories.SMILEYS_PEOPLE, name: t('quickComposer.emojiCategorySmileys') },
      { category: Categories.ANIMALS_NATURE, name: t('quickComposer.emojiCategoryAnimals') },
      { category: Categories.FOOD_DRINK, name: t('quickComposer.emojiCategoryFood') },
      { category: Categories.TRAVEL_PLACES, name: t('quickComposer.emojiCategoryTravel') },
      { category: Categories.ACTIVITIES, name: t('quickComposer.emojiCategoryActivities') },
      { category: Categories.OBJECTS, name: t('quickComposer.emojiCategoryObjects') },
      { category: Categories.SYMBOLS, name: t('quickComposer.emojiCategorySymbols') },
      { category: Categories.FLAGS, name: t('quickComposer.emojiCategoryFlags') },
    ],
    [t],
  );

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (anchorRef?.current && anchorRef.current.contains(e.target as Node)) return;
        onOpenChange(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onOpenChange, anchorRef]);

  if (!open || !anchorRef?.current) return null;

  const anchorRect = anchorRef.current.getBoundingClientRect();
  const top = anchorRect.bottom + 8;
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - PICKER_WIDTH - 8));
  const isDark = resolveTheme(useThemeStore.getState().theme) === 'dark';

  return createPortal(
    <div
      ref={containerRef}
      data-emoji-picker-popover
      className="fixed z-[9999] rounded-xl border border-border surface-overlay shadow-lg overflow-hidden"
      style={{ top, left }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{pickerScopedCss}</style>
      <EmojiPicker
        onEmojiClick={(emojiData: EmojiClickData) => {
          onEmojiSelect(emojiData.emoji);
          onOpenChange(false);
        }}
        theme={isDark ? Theme.DARK : Theme.LIGHT}
        style={pickerStyle}
        searchPlaceholder={t('quickComposer.emojiSearch')}
        searchClearButtonLabel={t('quickComposer.emojiClear')}
        previewConfig={{
          showPreview: true,
          defaultCaption: t('quickComposer.emojiPreview'),
        }}
        categories={categories}
        width={PICKER_WIDTH}
        height={PICKER_HEIGHT}
        lazyLoadEmojis={true}
      />
    </div>,
    document.body,
  );
}
