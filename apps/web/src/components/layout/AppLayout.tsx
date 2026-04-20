import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { useThemeStore, getEffectiveTheme } from '@/store/theme.store';
import { useBackground } from '@/hooks/useBackground';
import { useBodyScrollbar } from '@/hooks/useBodyScrollbar';
import { cn } from '@/lib/utils';
import { Home, User, LogOut, Sun, Moon, Monitor, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function AppLayout() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.currentUser);
  const navigate = useNavigate();
  const location = useLocation();

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const { backgroundStyle, hasCustomBackground } = useBackground();

  useBodyScrollbar();

  // Cycles: null (system) → 'light' → 'dark' → null
  function cycleTheme() {
    if (theme === null) return setTheme('light');
    if (theme === 'light') return setTheme('dark');
    return setTheme(null);
  }

  // Icon reflects current state: Monitor for system, Sun/Moon for explicit
  const ThemeIcon = theme === null
    ? Monitor
    : getEffectiveTheme() === 'dark' ? Moon : Sun;

  const themeLabel = theme === null
    ? t('theme.system')
    : theme === 'light'
      ? t('theme.light')
      : t('theme.dark');

  const isHome = location.pathname === '/';
  const isSpaces = location.pathname.startsWith('/spaces');
  const isProfile = currentUser
    ? location.pathname === `/users/${currentUser.username}`
    : false;

  const handleLogout = () => {
    useAuthStore.getState().clearAuth();
    navigate('/login');
  };

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col',
        !hasCustomBackground && 'bg-background',
      )}
      style={hasCustomBackground ? backgroundStyle : undefined}
    >
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-bold tracking-tight text-primary">
              {t('brand')}
            </Link>

            {/* Desktop nav tabs */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isHome ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
              >
                {t('nav.home')}
              </Link>
              <Link
                to="/spaces"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isSpaces ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
              >
                {t('nav.spaces')}
              </Link>
            </nav>
          </div>

          {currentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => navigate(`/users/${currentUser.username}`)}>
                  <User className="w-4 h-4" />
                  {t('nav.profile')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={cycleTheme}>
                  <ThemeIcon className="w-4 h-4" />
                  {themeLabel}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout} destructive>
                  <LogOut className="w-4 h-4" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-20 md:pb-4">
        <Outlet />
      </main>

      {/* Bottom mobile nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-sm border-t border-border md:hidden">
        <div className="flex items-center justify-around h-14">
          <Link to="/" className={`flex flex-col items-center gap-0.5 transition-colors p-2 ${isHome ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Home className="w-5 h-5" />
            <span className="text-[10px]">{t('nav.home')}</span>
          </Link>

          <Link to="/spaces" className={`flex flex-col items-center gap-0.5 transition-colors p-2 ${isSpaces ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Users className="w-5 h-5" />
            <span className="text-[10px]">{t('nav.spaces')}</span>
          </Link>

          {currentUser && (
            <Link
              to={`/users/${currentUser.username}`}
              className={`flex flex-col items-center gap-0.5 transition-colors p-2 ${isProfile ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <User className="w-5 h-5" />
              <span className="text-[10px]">{t('nav.profile')}</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
