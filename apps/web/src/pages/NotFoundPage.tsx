import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <h1 className="text-6xl font-bold text-foreground">404</h1>
      <p className="mt-2 text-lg text-muted-foreground">Page not found</p>
      <Link
        to="/"
        className="mt-6 rounded-lg px-4 py-2 bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
      >
        Go home
      </Link>
    </div>
  );
}
