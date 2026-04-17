import { Outlet } from 'react-router-dom';

export default function GuestLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full py-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Moments
        </h1>
      </header>
      <main className="w-full max-w-md px-4">
        <Outlet />
      </main>
    </div>
  );
}
