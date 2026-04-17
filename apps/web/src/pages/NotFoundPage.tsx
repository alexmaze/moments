import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <h1 className="text-6xl font-bold text-foreground">{t('notFound.title')}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{t('notFound.message')}</p>
      <Link
        to="/"
        className="mt-6 rounded-lg px-4 py-2 bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
      >
        {t('notFound.goHome')}
      </Link>
    </div>
  );
}
