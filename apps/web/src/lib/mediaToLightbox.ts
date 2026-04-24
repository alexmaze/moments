import type { Slide } from 'yet-another-react-lightbox';
import type { PostMediaDto } from '@moments/shared';

// YARL's video slide is a custom slide type keyed on `type: 'video'`.
// Width/height are required (used to preserve aspect ratio). Our
// PostMediaDto allows null for legacy records; fall back to a generic
// 16:9 landscape size rather than dropping the slide.
const FALLBACK_W = 1920;
const FALLBACK_H = 1080;

export function mediaToLightboxSlides(items: PostMediaDto[]): Slide[] {
  return items.map((item): Slide => {
    if (item.type === 'video') {
      return {
        type: 'video',
        width: item.width ?? FALLBACK_W,
        height: item.height ?? FALLBACK_H,
        poster: item.coverUrl ?? undefined,
        sources: [{ src: item.publicUrl, type: item.mimeType }],
        controls: true,
        playsInline: true,
        preload: 'metadata',
      } as Slide;
    }
    return {
      src: item.publicUrl,
      width: item.width ?? undefined,
      height: item.height ?? undefined,
    };
  });
}
