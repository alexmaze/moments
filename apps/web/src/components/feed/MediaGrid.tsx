import type { PostMediaDto } from '@/types/dto';
import { Play } from 'lucide-react';

interface MediaGridProps {
  items: PostMediaDto[];
  variant?: 'feed' | 'detail';
  onItemClick?: (index: number) => void;
}

/** Clamp single-image aspect ratio to [1:2, 2:1] range */
function getClampedAspectRatio(
  width: number | null,
  height: number | null,
): number {
  if (!width || !height) return 4 / 3;
  const ratio = width / height;
  const MIN_RATIO = 1 / 2; // tallest portrait allowed
  const MAX_RATIO = 2 / 1; // widest landscape allowed
  return Math.min(Math.max(ratio, MIN_RATIO), MAX_RATIO);
}

/** Grid column class based on display count */
function getGridCols(count: number): string {
  if (count === 1) return '';
  if (count === 2 || count === 4) return 'grid-cols-2';
  return 'grid-cols-3';
}

export default function MediaGrid({
  items,
  variant = 'feed',
  onItemClick,
}: MediaGridProps) {
  if (items.length === 0) return null;

  const totalCount = items.length;
  const maxDisplay = variant === 'feed' ? 9 : Infinity;
  const displayItems = items.slice(0, Math.min(totalCount, maxDisplay));
  const overflowCount = totalCount - displayItems.length;

  // For grid layout, use displayItems count (which equals totalCount when detail or <= 9)
  const gridCols = getGridCols(
    Math.min(totalCount, maxDisplay),
  );

  // Single-item layout: smart aspect ratio
  if (displayItems.length === 1) {
    const item = displayItems[0];
    const aspectRatio = getClampedAspectRatio(item.width, item.height);

    return (
      <div className="mt-3">
        <div
          onClick={
            onItemClick
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onItemClick(0);
                }
              : undefined
          }
          role={onItemClick ? 'button' : undefined}
          tabIndex={onItemClick ? 0 : undefined}
          onKeyDown={
            onItemClick
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onItemClick(0);
                  }
                }
              : undefined
          }
          className={`group relative overflow-hidden rounded-lg bg-muted max-h-[400px] ${
            onItemClick ? 'cursor-pointer' : ''
          }`}
          style={{ aspectRatio: String(aspectRatio) }}
        >
          <MediaCell item={item} />

          {/* Hover darkening overlay */}
          {onItemClick && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
          )}
        </div>
      </div>
    );
  }

  // Multi-item grid layout
  return (
    <div className={`grid ${gridCols} gap-1 mt-3`}>
      {displayItems.map((item, i) => {
        const isLastWithOverflow =
          overflowCount > 0 && i === displayItems.length - 1;

        return (
          <div
            key={item.id}
            onClick={
              onItemClick
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onItemClick(i);
                  }
                : undefined
            }
            role={onItemClick ? 'button' : undefined}
            tabIndex={onItemClick ? 0 : undefined}
            onKeyDown={
              onItemClick
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onItemClick(i);
                    }
                  }
                : undefined
            }
            className={`group relative overflow-hidden rounded-lg bg-muted aspect-square ${
              onItemClick ? 'cursor-pointer' : ''
            }`}
          >
            <MediaCell item={item} />

            {/* +N overflow overlay */}
            {isLastWithOverflow && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                <span className="text-white text-2xl font-bold">
                  +{overflowCount}
                </span>
              </div>
            )}

            {/* Hover darkening overlay */}
            {onItemClick && !isLastWithOverflow && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Renders the image or video content inside a grid cell */
function MediaCell({
  item,
}: {
  item: PostMediaDto;
}) {
  const mediaClass = 'w-full h-full object-cover';

  if (item.type === 'video') {
    return (
      <>
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={mediaClass}
          />
        ) : (
          <video
            src={item.publicUrl}
            muted
            playsInline
            preload="metadata"
            className={mediaClass}
          />
        )}
        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
            <Play
              className="w-5 h-5 ml-0.5"
              fill="white"
              stroke="white"
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <img
      src={item.publicUrl}
      alt=""
      loading="lazy"
      decoding="async"
      className={mediaClass}
    />
  );
}
