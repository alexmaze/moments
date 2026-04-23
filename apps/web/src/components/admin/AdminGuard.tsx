import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

export default function AdminGuard() {
  const currentUser = useAuthStore((s) => s.currentUser);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!currentUser.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
