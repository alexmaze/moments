import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getUserProfileApi } from '@/api/users.api';
import { useUserPosts } from '@/hooks/usePosts';
import ProfileHeader from '@/components/profile/ProfileHeader';
import PostCard from '@/components/feed/PostCard';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  const { data: profile, isLoading: profileLoading, isError: profileError } = useQuery({
    queryKey: ['userProfile', username],
    queryFn: () => getUserProfileApi(username!),
    enabled: !!username,
  });

  const { data: postsData, isLoading: postsLoading } = useUserPosts(username!);
  const posts = postsData?.pages.flatMap((p) => p.data) ?? [];

  if (profileLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-muted rounded w-32" />
              <div className="h-3 bg-muted rounded w-20" />
              <div className="h-3 bg-muted rounded w-48 mt-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">User not found.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back
      </button>

      <ProfileHeader profile={profile} />

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground px-1">Posts</h2>

        {postsLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-card rounded-xl shadow-sm border border-border p-4 animate-pulse">
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
                </div>
              </div>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No posts yet.
          </div>
        )}
      </div>
    </div>
  );
}
