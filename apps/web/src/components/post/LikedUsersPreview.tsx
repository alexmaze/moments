import { Trans, useTranslation } from 'react-i18next';

interface LikedUsersPreviewProps {
  likeCount: number;
  likePreview?: string[];
  onOpenList: () => void;
}

export default function LikedUsersPreview({
  likeCount,
  likePreview,
  onOpenList,
}: LikedUsersPreviewProps) {
  const { t } = useTranslation('feed');

  if (likeCount === 0) return null;

  const names = likePreview ?? [];

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenList();
  };

  const btnClass =
    'text-sm text-muted-foreground hover:text-foreground transition-colors text-left [&_b]:text-foreground [&_b]:font-medium';

  if (names.length === 0) {
    return (
      <button type="button" onClick={handleClick} className={btnClass}>
        {t('likedUsersCount', { count: likeCount })}
      </button>
    );
  }

  if (names.length === 1) {
    return (
      <button type="button" onClick={handleClick} className={btnClass}>
        <Trans
          t={t}
          i18nKey="likedByOne"
          values={{ name: names[0] }}
          components={{ bold: <b /> }}
        />
      </button>
    );
  }

  if (names.length === 2) {
    return (
      <button type="button" onClick={handleClick} className={btnClass}>
        <Trans
          t={t}
          i18nKey="likedByTwo"
          values={{ name1: names[0], name2: names[1] }}
          components={{ bold: <b /> }}
        />
      </button>
    );
  }

  if (names.length === 3 && likeCount <= 3) {
    return (
      <button type="button" onClick={handleClick} className={btnClass}>
        <Trans
          t={t}
          i18nKey="likedByThree"
          values={{ name1: names[0], name2: names[1], name3: names[2] }}
          components={{ bold: <b /> }}
        />
      </button>
    );
  }

  const separator = t('likedByNameSeparator');
  const joined = names.slice(0, 3).join(separator);

  return (
    <button type="button" onClick={handleClick} className={btnClass}>
      <Trans
        t={t}
        i18nKey="likedByMore"
        values={{ names: joined, count: likeCount }}
        components={{ bold: <b /> }}
      />
    </button>
  );
}
