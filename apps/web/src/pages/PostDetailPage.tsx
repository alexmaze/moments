import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { usePost } from '@/hooks/usePosts';
import PostDetail from '@/components/post/PostDetail';
import QuickComposer from '@/components/composer/QuickComposer';
import { useAuthStore } from '@/store/auth.store';

export default function PostDetailPage() {
  const { t } = useTranslation('post');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { data: post, isLoading, isError } = usePost(id!);
  const isEditMode = searchParams.get('edit') === '1';
  const highlightCommentId = searchParams.get('commentId');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="surface-card rounded-xl shadow-sm border border-border p-4 animate-pulse">
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
        <ArrowLeft className="w-4 h-4" />
        {t('back')}
      </button>

      {isEditMode && currentUser?.id === post.author.id ? (
        <QuickComposer
          mode="edit"
          initialPost={post}
          onCancel={() => navigate(`/posts/${post.id}`)}
          onSuccess={() => navigate(`/posts/${post.id}`, { replace: true })}
        />
      ) : (
        <PostDetail post={post} highlightCommentId={highlightCommentId ?? undefined} />
      )}
    </div>
  );
}
