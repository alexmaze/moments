import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePost } from '@/hooks/usePosts';
import PostDetail from '@/components/post/PostDetail';

export default function PostDetailPage() {
  const { t } = useTranslation('post');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: post, isLoading, isError } = usePost(id!);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-3 bg-muted rounded w-24" />
              <div className="h-2 bg-muted rounded w-16" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-sm text-primary hover:underline"
        >
          {t('back')}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        {t('back')}
      </button>

      <PostDetail post={post} />
    </div>
  );
}
