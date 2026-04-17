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
      // For HTML5 videos, `src` should NOT be the video URL (that's for YouTube/Vimeo).
      // Set `src` to empty string so lgZoom doesn't try to treat it as an image.
      // The actual video is provided via the `video` object.
      return {
        src: '',
        poster: item.coverUrl ?? undefined,
        thumb: item.coverUrl ?? undefined,
        video: {
          source: [{ src: item.publicUrl, type: item.mimeType }],
          attributes: {
            preload: 'metadata',
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
