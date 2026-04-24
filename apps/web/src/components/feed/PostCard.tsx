import { memo, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PostDto } from '@moments/shared';
import { useAuthStore } from '@/store/auth.store';
import { useToggleLike, useDeletePost } from '@/hooks/usePosts';
import { formatRelativeTime } from '@/lib/utils';
import { mediaToLightboxSlides } from '@/lib/mediaToLightbox';
import { User, Trash2, Heart, MessageSquare, Users, Ellipsis, Pencil } from 'lucide-react';
import { formatBabyAge, formatBabyAgeEn } from '@moments/shared';
import i18n from '@/i18n';
import MediaGrid from './MediaGrid';
import PostAudioPlayer from './PostAudioPlayer';
import { useMediaLightbox } from './MediaLightboxProvider';
import { PostContent } from './PostContent';
import CommentSection from '@/components/post/CommentSection';
import LikedUsersPreview from '@/components/post/LikedUsersPreview';
import LikedUsersList from '@/components/post/LikedUsersList';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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
  highlightCommentId?: string;
}

function PostCardInner({ post, variant = 'feed', highlightCommentId }: PostCardProps) {
  const { t } = useTranslation('feed');
  const currentUser = useAuthStore((s) => s.currentUser);
  const toggleLike = useToggleLike();
  const deletePost = useDeletePost();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [likedUsersOpen, setLikedUsersOpen] = useState(false);

  const isOwner = currentUser?.id === post.author.id;
  const navigate = useNavigate();

  // Lightbox (shared singleton provided by MediaLightboxProvider)
  const lightbox = useMediaLightbox();
  const slides = useMemo(() => mediaToLightboxSlides(post.media), [post.media]);

  const handleMediaClick = (index: number) => {
    lightbox.open(slides, index);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleLike.mutate(post.id);
  };

  const handleDeleteConfirm = () => {
    deletePost.mutate(post.id);
    setDeleteOpen(false);
  };

  return (
    <div
      className="surface-card rounded-xl shadow-sm border border-border p-4 cursor-pointer"
      onClick={() => navigate(`/posts/${post.id}`)}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/users/${post.author.username}`} onClick={(e) => e.stopPropagation()}>
          {post.author.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt={post.space ? (post.author.spaceNickname ?? post.author.displayName) : post.author.displayName}
              loading="lazy"
              decoding="async"
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
            {post.space ? (post.author.spaceNickname ?? post.author.displayName) : post.author.displayName}
          </Link>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>@{post.author.username}</span>
            <span>&middot;</span>
            <span>{formatRelativeTime(post.createdAt)}</span>
            {post.space?.type === 'baby' && post.space.babyBirthday && (
              <>
                <span>&middot;</span>
                <span className="text-primary/80">
                  {i18n.language === 'zh-CN'
                    ? formatBabyAge(post.space.babyBirthday, post.createdAt)
                    : formatBabyAgeEn(post.space.babyBirthday, post.createdAt)}
                </span>
              </>
            )}
          </div>
          {post.space && (
            <Link
              to={`/spaces/${post.space.slug}`}
              className="inline-flex items-center gap-1 text-xs text-primary/80 hover:text-primary mt-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Users className="w-3 h-3" />
              <span>{post.space.name}</span>
            </Link>
          )}
        </div>

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="rounded-lg p-2 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                title={t('postCard.actionsTitle')}
              >
                <Ellipsis className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onSelect={() => navigate(`/posts/${post.id}?edit=1`)}
              >
                <Pencil className="w-4 h-4" />
                {t('postCard.editAction')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                destructive
              >
                <Trash2 className="w-4 h-4" />
                {t('postCard.deleteTitle')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <div>
        {post.content && (
          <PostContent
            content={post.content}
            mentions={post.mentions}
            className="mt-3 text-foreground text-sm whitespace-pre-wrap break-words"
          />
        )}

        {/* Media */}
        <MediaGrid items={post.media} variant={variant} onItemClick={handleMediaClick} />

        {post.audio && <PostAudioPlayer audio={post.audio} postId={post.id} />}
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

        {variant !== 'detail' && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MessageSquare className="w-5 h-5" />
            {post.commentCount > 0 && <span>{post.commentCount}</span>}
          </span>
        )}
      </div>

      {variant === 'detail' && post.likeCount > 0 && (
        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
          <LikedUsersPreview
            likeCount={post.likeCount}
            likePreview={post.likePreview}
            onOpenList={() => setLikedUsersOpen(true)}
          />
        </div>
      )}

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
          highlightCommentId={highlightCommentId}
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

      <LikedUsersList
        postId={post.id}
        open={likedUsersOpen}
        onOpenChange={setLikedUsersOpen}
      />
    </div>
  );
}

/**
 * Memoised export. The feed's optimistic like-toggle replaces a single post
 * reference inside the paginated cache, which means every other post keeps
 * its referential identity — `memo` short-circuits their re-renders. Without
 * this, a single like forces the whole list to reconcile.
 */
const PostCard = memo(PostCardInner);

export default PostCard;
