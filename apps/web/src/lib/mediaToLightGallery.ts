import type { GalleryItem } from 'lightgallery/lg-utils';
import type { PostMediaDto } from '@/types/dto';

/**
 * Converts PostMediaDto[] to lightGallery's GalleryItem[] (dynamicEl format).
 *
 * Image slides: { src, thumb }
 * Video slides: { src (poster fallback), poster, video: { source, attributes } }
 */
export function mediaToLightGallerySlides(
  items: PostMediaDto[],
): GalleryItem[] {
  return items.map((item): GalleryItem => {
    if (item.type === 'video') {
      return {
        src: item.publicUrl,
        poster: item.coverUrl ?? undefined,
        thumb: item.coverUrl ?? undefined,
        video: {
          source: [{ src: item.publicUrl, type: item.mimeType }],
          attributes: {
            preload: 'none',
            controls: true,
            playsinline: true,
          } as unknown as HTMLVideoElement,
          tracks: [] as unknown as HTMLTrackElement[],
        },
      };
    }

    // image
    return {
      src: item.publicUrl,
      thumb: item.publicUrl,
    };
  });
}
