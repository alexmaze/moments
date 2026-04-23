import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, Loader2, ChevronLeft, ChevronRight, User, Play } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/admin.api';
import PostAudioPlayer from '@/components/feed/PostAudioPlayer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PostDto } from '@/types/dto';

export default function PostsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PostDto | null>(null);
  const pageSize = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['adminPosts', page, search],
    queryFn: () => adminApi.getPosts({ page, pageSize, search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => adminApi.deletePost(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['adminPosts', page, search] });
      const previousData = queryClient.getQueryData(['adminPosts', page, search]);
      queryClient.setQueryData(['adminPosts', page, search], (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((p) => p.id !== postId),
          total: old.total - 1,
        };
      });
      return { previousData };
    },
    onError: () => {
      toast.error('Failed to delete post');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] });
    },
    onSuccess: () => {
      toast.success('Post deleted');
      setDeleteTarget(null);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateContent = (content: string | null, maxLength: number = 100) => {
    if (!content) return <span className="text-muted-foreground italic">No content</span>;
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Posts</h1>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by content..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Search
        </button>
      </form>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Content</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Author</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Media</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Audio</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Likes</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Comments</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Created</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-destructive">
                    Failed to load posts
                  </td>
                </tr>
              )}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No posts found
                  </td>
                </tr>
              )}
              {data?.items.map((post) => (
                <tr key={post.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-foreground max-w-xs">
                    {truncateContent(post.content)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {post.author.avatarUrl ? (
                        <img
                          src={post.author.avatarUrl}
                          alt={post.author.displayName}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-3 h-3 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {post.author.displayName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          @{post.author.username}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {post.media.length === 0 && !post.audio && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {post.media.slice(0, 4).map((media) => (
                        <div
                          key={media.id}
                          className="relative w-12 h-12 rounded overflow-hidden bg-muted"
                        >
                          {media.type === 'image' ? (
                            <img
                              src={media.publicUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full relative">
                              {media.coverUrl ? (
                                <img
                                  src={media.coverUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <Play className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Play className="w-4 h-4 text-white" fill="white" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {post.media.length > 4 && (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                          +{post.media.length - 4}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {post.audio ? (
                      <div className="w-32">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          {Math.floor((post.audio.durationMs || 0) / 60000)}:{String(Math.floor(((post.audio.durationMs || 0) % 60000) / 1000)).padStart(2, '0')}
                        </div>
                        <PostAudioPlayer audio={post.audio} postId={post.id} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground text-center">
                    {post.likeCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground text-center">
                    {post.commentCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(post.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setDeleteTarget(post)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, data?.total ?? 0)} of {data?.total ?? 0} posts
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-input rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-muted-foreground px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border border-input rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
