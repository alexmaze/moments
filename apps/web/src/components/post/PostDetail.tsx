import type { PostDto } from '@/types/dto';
import PostCard from '@/components/feed/PostCard';

interface PostDetailProps {
  post: PostDto;
  highlightCommentId?: string;
}

export default function PostDetail({ post, highlightCommentId }: PostDetailProps) {
  return (
    <div>
      <PostCard post={post} variant="detail" highlightCommentId={highlightCommentId} />
    </div>
  );
}
