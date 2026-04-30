import { useState, useEffect, type ComponentProps } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeConfig: Record<AvatarSize, { container: string; icon: string }> = {
  xs: { container: 'w-6 h-6', icon: 'w-3 h-3' },
  sm: { container: 'w-8 h-8', icon: 'w-4 h-4' },
  md: { container: 'w-10 h-10', icon: 'w-5 h-5' },
  lg: { container: 'w-14 h-14', icon: 'w-6 h-6' },
  xl: { container: 'w-20 h-20', icon: 'w-8 h-8' },
};

interface UserAvatarProps extends Omit<ComponentProps<'img'>, 'src' | 'onError'> {
  /** Avatar URL — can be null/undefined, in which case fallback is shown immediately */
  src: string | null | undefined;
  /** Preset size. Defaults to 'md' (w-10 h-10). */
  size?: AvatarSize;
  /** Override size class for the container (if preset doesn't fit) */
  containerClassName?: string;
}

/**
 * Unified avatar component.
 * - If `src` is falsy → renders fallback icon immediately.
 * - If `src` is provided but image fails to load → renders fallback icon.
 * - All avatar styling (rounded-full, object-cover) is built in.
 */
export default function UserAvatar({
  src,
  size = 'md',
  containerClassName,
  className,
  alt,
  ...imgProps
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const { container, icon } = sizeConfig[size];

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={cn(
          'rounded-full bg-muted flex items-center justify-center shrink-0',
          container,
          containerClassName,
          className,
        )}
        role="img"
        aria-label={alt || undefined}
      >
        <User className={cn('text-muted-foreground', icon)} />
      </div>
    );
  }

  return (
    <img
      {...imgProps}
      src={src}
      alt={alt ?? ''}
      className={cn(
        'rounded-full object-cover shrink-0',
        container,
        containerClassName,
        className,
      )}
      onError={() => setFailed(true)}
    />
  );
}
