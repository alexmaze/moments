import { Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import GuestLayout from '@/components/layout/GuestLayout';
import AuthGuard from '@/components/layout/AuthGuard';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import FeedPage from '@/pages/FeedPage';
import PostDetailPage from '@/pages/PostDetailPage';
import ProfilePage from '@/pages/ProfilePage';
import NotFoundPage from '@/pages/NotFoundPage';
import { Toaster } from '@/components/ui/sonner';

function App() {
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
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  );
}

export default App;
