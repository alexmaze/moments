import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function GuestLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center relative overflow-hidden">
      {/* Decorative amber radial glow */}
      <div
        className="absolute inset-x-0 top-0 h-[28rem] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -5%, hsl(24 80% 50% / 0.10) 0%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      <header className="relative w-full py-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          {t('brand')}
        </h1>
      </header>
      <main className="relative w-full max-w-md px-4">
        <Outlet />
      </main>
    </div>
  );
}
