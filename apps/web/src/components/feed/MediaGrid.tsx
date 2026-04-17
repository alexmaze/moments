import type { PostMediaDto } from '@/types/dto';

interface MediaGridProps {
  items: PostMediaDto[];
  onItemClick?: (index: number) => void;
}

export default function MediaGrid({ items, onItemClick }: MediaGridProps) {
  if (items.length === 0) return null;

  const gridClass =
    items.length === 1
      ? 'grid grid-cols-1'
      : items.length === 2
        ? 'grid grid-cols-2'
        : 'grid grid-cols-3';

  return (
    <div className={`${gridClass} gap-1 mt-3`}>
      {items.map((item, i) => (
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
          className={`group relative overflow-hidden rounded-lg bg-muted ${
            items.length === 1 ? 'max-h-96' : 'aspect-square'
          } ${onItemClick ? 'cursor-pointer' : ''}`}
        >
          {item.type === 'video' ? (
            <>
              <img
                src={item.coverUrl || item.publicUrl}
                alt=""
                className={`w-full object-cover ${
                  items.length === 1 ? 'max-h-96' : 'h-full'
                }`}
              />
              {/* Play icon overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="white"
                    className="w-5 h-5 ml-0.5"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
              </div>
            </>
          ) : (
            <img
              src={item.publicUrl}
              alt=""
              className={`w-full object-cover ${
                items.length === 1 ? 'max-h-96' : 'h-full'
              }`}
            />
          )}

          {/* Hover darkening overlay — only when interactive */}
          {onItemClick && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
          )}
        </div>
      ))}
    </div>
  );
}
