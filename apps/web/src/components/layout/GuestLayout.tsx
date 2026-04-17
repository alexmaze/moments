import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function GuestLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full py-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t('brand')}
        </h1>
      </header>
      <main className="w-full max-w-md px-4">
        <Outlet />
      </main>
    </div>
  );
}
