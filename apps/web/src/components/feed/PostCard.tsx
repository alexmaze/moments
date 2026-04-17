import { useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PostDto } from '@/types/dto';
import { useAuthStore } from '@/store/auth.store';
import { useToggleLike, useDeletePost } from '@/hooks/usePosts';
import { formatRelativeTime } from '@/lib/utils';
import { mediaToLightGallerySlides } from '@/lib/mediaToLightGallery';
import { User, Trash2, Heart, MessageSquare } from 'lucide-react';
import MediaGrid from './MediaGrid';
import MediaLightbox from './MediaLightbox';
import type { MediaLightboxHandle } from './MediaLightbox';
import CommentSection from '@/components/post/CommentSection';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface PostCardProps {
  post: PostDto;
  variant?: 'feed' | 'detail';
}

export default function PostCard({ post, variant = 'feed' }: PostCardProps) {
  const { t } = useTranslation('feed');
  const currentUser = useAuthStore((s) => s.currentUser);
  const toggleLike = useToggleLike();
  const deletePost = useDeletePost();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isOwner = currentUser?.id === post.author.id;
  const navigate = useNavigate();

  // Lightbox
  const lightboxRef = useRef<MediaLightboxHandle>(null);
  const slides = useMemo(() => mediaToLightGallerySlides(post.media), [post.media]);

  const handleMediaClick = (index: number) => {
    lightboxRef.current?.openGallery(index);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleLike.mutate(post.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    deletePost.mutate(post.id);
    setDeleteOpen(false);
  };

  return (
    <div
      className="bg-card rounded-xl shadow-sm border border-border p-4 cursor-pointer"
      onClick={() => navigate(`/posts/${post.id}`)}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/users/${post.author.username}`} onClick={(e) => e.stopPropagation()}>
          {post.author.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <Link
            to={`/users/${post.author.username}`}
            className="font-medium text-foreground hover:underline text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {post.author.displayName}
          </Link>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>@{post.author.username}</span>
            <span>&middot;</span>
            <span>{formatRelativeTime(post.createdAt)}</span>
          </div>
        </div>

        {isOwner && (
          <button
            onClick={handleDeleteClick}
            className="rounded-lg p-2 hover:bg-accent transition-colors text-muted-foreground hover:text-destructive"
            title={t('postCard.deleteTitle')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div>
        {post.content && (
          <p className="mt-3 text-foreground text-sm whitespace-pre-wrap break-words">
            {post.content}
          </p>
        )}

        {/* Media */}
        <MediaGrid items={post.media} variant={variant} onItemClick={handleMediaClick} />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-4">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            post.isLikedByMe
              ? 'text-like'
              : 'text-muted-foreground hover:text-like'
          }`}
        >
          <Heart
            className="w-5 h-5"
            fill={post.isLikedByMe ? 'currentColor' : 'none'}
          />
          {post.likeCount > 0 && <span>{post.likeCount}</span>}
        </button>

        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MessageSquare className="w-5 h-5" />
          {post.commentCount > 0 && <span>{post.commentCount}</span>}
        </span>
      </div>

      {/* Inline comment section — always visible */}
      <div
        className="mt-3 pt-3 border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <CommentSection
          postId={post.id}
          initialComments={post.comments}
          initialHasMore={post.hasMoreComments}
          variant="inline"
        />
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('postCard.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('postCard.deleteConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('postCard.deleteConfirmCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t('postCard.deleteConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Media lightbox */}
      {post.media.length > 0 && (
        <MediaLightbox ref={lightboxRef} slides={slides} />
      )}
    </div>
  );
}
