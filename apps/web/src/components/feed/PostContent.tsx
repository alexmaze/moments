import { Link } from 'react-router-dom';
import { memo } from 'react';
import { renderContentWithTagsAndMentions } from '@moments/shared';

interface PostContentProps {
  content: string;
  className?: string;
}

export const PostContent = memo(function PostContent({ content, className }: PostContentProps) {
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
          return (
            <Link
              key={i}
              to={`/users/${part.userId}`}
              className="text-primary hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              @{part.displayName}
            </Link>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </p>
  );
});