import type { PostDto } from '@/types/dto';
import PostCard from '@/components/feed/PostCard';

interface PostDetailProps {
  post: PostDto;
}

export default function PostDetail({ post }: PostDetailProps) {
  return (
    <div>
      <PostCard post={post} variant="detail" />
    </div>
  );
}
