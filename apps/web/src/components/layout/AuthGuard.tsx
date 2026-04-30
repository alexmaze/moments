import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { getMeApi } from '@/api/auth.api';

export default function AuthGuard() {
  const token = useAuthStore((s) => s.token);
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    if (!token) return;

    // Refresh user data on mount — signed URLs in localStorage go stale
    getMeApi()
      .then((user) => setCurrentUser(user))
      .catch(() => clearAuth());
  }, [token, setCurrentUser, clearAuth]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
