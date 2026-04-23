import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import GuestLayout from '@/components/layout/GuestLayout';
import AuthGuard from '@/components/layout/AuthGuard';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminLayout from '@/components/admin/AdminLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import FeedPage from '@/pages/FeedPage';
import PostDetailPage from '@/pages/PostDetailPage';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';
import SpacesPage from '@/pages/SpacesPage';
import SpaceDetailPage from '@/pages/SpaceDetailPage';
import SpaceEditPage from '@/pages/SpaceEditPage';
import TagPage from '@/pages/TagPage';
import NotificationsPage from '@/pages/NotificationsPage';
import NotFoundPage from '@/pages/NotFoundPage';
import AdminDashboardPage from '@/pages/admin/DashboardPage';
import AdminUsersPage from '@/pages/admin/UsersPage';
import AdminPostsPage from '@/pages/admin/PostsPage';
import AdminSettingsPage from '@/pages/admin/SettingsPage';
import { Toaster } from '@/components/ui/sonner';
import { useTheme } from '@/hooks/useTheme';

function App() {
  const { t } = useTranslation();
  useTheme();

  document.title = t('brand');

  return (
    <>
    <Toaster />
    <Routes>
      <Route element={<GuestLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route index element={<FeedPage />} />
          <Route path="/posts/:id" element={<PostDetailPage />} />
          <Route path="/users/:username" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/spaces" element={<SpacesPage />} />
          <Route path="/spaces/:slug" element={<SpaceDetailPage />} />
          <Route path="/spaces/:slug/edit" element={<SpaceEditPage />} />
          <Route path="/tags/:name" element={<TagPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>
      <Route path="/admin" element={<AdminGuard />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="posts" element={<AdminPostsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  );
}

export default App;
