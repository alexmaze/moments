import { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PostDto } from '@/types/dto';
import { useAuthStore } from '@/store/auth.store';
import { useToggleLike, useDeletePost } from '@/hooks/usePosts';
import { formatRelativeTime } from '@/lib/utils';
import { mediaToLightGallerySlides } from '@/lib/mediaToLightGallery';
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
}

export default function PostCard({ post }: PostCardProps) {
  const { t } = useTranslation('feed');
  const currentUser = useAuthStore((s) => s.currentUser);
  const toggleLike = useToggleLike();
  const deletePost = useDeletePost();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isOwner = currentUser?.id === post.author.id;

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
    <div className="bg-card rounded-xl shadow-sm border border-border p-4">
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-muted-foreground">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <Link to={`/posts/${post.id}`} className="block">
        {post.content && (
          <p className="mt-3 text-foreground text-sm whitespace-pre-wrap break-words">
            {post.content}
          </p>
        )}

        {/* Media */}
        <MediaGrid items={post.media} onItemClick={handleMediaClick} />
      </Link>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-4">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            post.isLikedByMe
              ? 'text-red-500'
              : 'text-muted-foreground hover:text-red-500'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={post.isLikedByMe ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            className="w-5 h-5"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {post.likeCount > 0 && <span>{post.likeCount}</span>}
        </button>

        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
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
