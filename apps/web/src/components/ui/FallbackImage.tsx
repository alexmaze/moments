import { useState, useEffect, type ComponentProps } from 'react';
import { ImageOff, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type FallbackVariant = 'image' | 'video';

interface FallbackImageProps extends Omit<ComponentProps<'img'>, 'onError'> {
  /** Which icon to show on failure: ImageOff or VideoOff */
  fallbackVariant?: FallbackVariant;
  /** Additional class for the fallback container (inherits the img className by default) */
  fallbackClassName?: string;
  /** Icon size class, e.g. "w-6 h-6". Defaults based on container size. */
  iconClassName?: string;
}

/**
 * Drop-in `<img>` replacement that gracefully handles load failures.
 * On error: hides the broken image and shows a muted background + icon.
 */
export default function FallbackImage({
  fallbackVariant = 'image',
  fallbackClassName,
  iconClassName = 'w-6 h-6',
  className,
  alt,
  src,
  ...imgProps
}: FallbackImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    const Icon = fallbackVariant === 'video' ? VideoOff : ImageOff;
    return (
      <div
        className={cn(
          'bg-muted flex items-center justify-center',
          className,
          fallbackClassName,
        )}
        role="img"
        aria-label={alt || undefined}
      >
        <Icon className={cn('text-muted-foreground/60', iconClassName)} />
      </div>
    );
  }

  return (
    <img
      {...imgProps}
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
