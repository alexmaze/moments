import type { PostDto } from '@/types/dto';
import PostCard from '@/components/feed/PostCard';
import CommentSection from './CommentSection';

interface PostDetailProps {
  post: PostDto;
}

export default function PostDetail({ post }: PostDetailProps) {
  return (
    <div>
      <PostCard post={post} />
      <div className="mt-4">
        <CommentSection postId={post.id} />
      </div>
    </div>
  );
}
