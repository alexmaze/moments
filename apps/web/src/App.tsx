import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import GuestLayout from '@/components/layout/GuestLayout';
import AuthGuard from '@/components/layout/AuthGuard';
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
import NotFoundPage from '@/pages/NotFoundPage';
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
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  );
}

export default App;
