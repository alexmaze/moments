import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/store/theme.store';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type ThemeOption = 'light' | 'dark' | 'system';

export default function ThemeSegmentedControl() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const options: { value: ThemeOption; label: string }[] = [
    { value: 'light', label: t('theme.light') },
    { value: 'dark', label: t('theme.dark') },
    { value: 'system', label: t('theme.systemShort') },
  ];

  const activeValue: ThemeOption = theme === null ? 'system' : theme;

  const handleSelect = (value: ThemeOption) => {
    if (value === 'system') {
      setTheme(null);
    } else {
      setTheme(value);
    }
  };

  return (
    <SegmentedControl
      options={options}
      value={activeValue}
      onValueChange={handleSelect}
      ariaLabel={t('theme.light')}
      size="sm"
      stopPropagation
    />
  );
}
