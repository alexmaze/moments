import { Link } from 'react-router-dom';
import { memo } from 'react';
import { renderContentWithTagsAndMentions } from '@moments/shared';
import type { MentionUserDto } from '@moments/shared';

interface PostContentProps {
  content: string;
  mentions?: MentionUserDto[];
  className?: string;
}

export const PostContent = memo(function PostContent({ content, mentions, className }: PostContentProps) {
  if (!content) return null;

  const parts = renderContentWithTagsAndMentions(content);

  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (part.type === 'tag') {
          return (
            <Link
              key={i}
              to={`/tags/${encodeURIComponent(part.value)}`}
              className="text-primary hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              #{part.value}
            </Link>
          );
        }
        if (part.type === 'mention') {
          const username = mentions?.find(m => m.id === part.userId)?.username;
          return (
            <Link
              key={i}
              to={`/users/${username ?? part.userId}`}
              className="text-primary hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              @{mentions?.find(m => m.id === part.userId)?.spaceNickname ?? part.displayName}
            </Link>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </p>
  );
});