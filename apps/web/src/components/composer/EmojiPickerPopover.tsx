import { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker, { type EmojiClickData, Theme, Categories } from 'emoji-picker-react';
import { useTranslation } from 'react-i18next';
import { getEffectiveTheme } from '@/store/theme.store';

interface EmojiPickerPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmojiSelect: (emoji: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

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
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 340));
  const isDark = getEffectiveTheme() === 'dark';

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-[9999] rounded-xl border border-border surface-overlay shadow-lg overflow-hidden"
      style={{ top, left }}
    >
      <EmojiPicker
        onEmojiClick={(emojiData: EmojiClickData) => {
          onEmojiSelect(emojiData.emoji);
          onOpenChange(false);
        }}
        theme={isDark ? Theme.DARK : Theme.LIGHT}
        searchPlaceholder={t('quickComposer.emojiSearch')}
        searchClearButtonLabel={t('quickComposer.emojiClear')}
        previewConfig={{
          showPreview: true,
          defaultCaption: t('quickComposer.emojiPreview'),
        }}
        categories={categories}
        width={320}
        height={400}
        lazyLoadEmojis={true}
      />
    </div>,
    document.body,
  );
}
