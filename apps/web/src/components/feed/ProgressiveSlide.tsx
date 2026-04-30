import { useState, useCallback } from 'react';
import type { ContainerRect, Slide, SlideImage } from 'yet-another-react-lightbox';

/** Extended image slide carrying an optional thumbnail URL for progressive loading. */
interface ProgressiveImageSlide extends SlideImage {
  thumbnail?: string;
}

function isImageSlide(slide: Slide): slide is ProgressiveImageSlide {
  return !('type' in slide && slide.type !== undefined && slide.type !== 'image');
}

/**
 * Compute the `object-fit: contain`-equivalent rendered size of an image
 * within a YARL container rect. Returns CSS properties to absolutely-center
 * the image at its natural aspect ratio within the container.
 */
function computeContainedStyle(
  slide: ProgressiveImageSlide,
  rect: ContainerRect,
): React.CSSProperties {
  const imgW = slide.width;
  const imgH = slide.height;

  // If we don't know the image dimensions, let the browser handle it
  if (!imgW || !imgH || !rect.width || !rect.height) {
    return {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    };
  }

  const containerRatio = rect.width / rect.height;
  const imageRatio = imgW / imgH;

  let renderW: number;
  let renderH: number;

  if (imageRatio > containerRatio) {
    // Image is wider than container → fit by width
    renderW = rect.width;
    renderH = rect.width / imageRatio;
  } else {
    // Image is taller than container → fit by height
    renderH = rect.height;
    renderW = rect.height * imageRatio;
  }

  return {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: renderW,
    height: renderH,
    objectFit: 'cover',
  };
}

interface ProgressiveSlideProps {
  slide: Slide;
  rect: ContainerRect;
  offset: number;
}

/**
 * Progressive image slide renderer for YARL.
 *
 * Shows the CI thumbnail (already cached by the feed grid) immediately,
 * then loads the full-resolution original on top with a crossfade transition.
 *
 * Returns `null` for non-image slides so YARL falls back to its default
 * renderer (e.g. Video plugin).
 */
export function ProgressiveSlide({ slide, rect, offset }: ProgressiveSlideProps) {
  const [loaded, setLoaded] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  // Only handle image slides
  if (!isImageSlide(slide)) return null;

  const { src, thumbnail } = slide;
  const needsProgressive = thumbnail && thumbnail !== src;

  // No thumbnail available → render a plain image (same as YARL default)
  if (!needsProgressive) {
    return (
      <div className="progressive-slide">
        <img
          src={src}
          alt={slide.alt ?? ''}
          draggable={false}
          style={computeContainedStyle(slide, rect)}
        />
      </div>
    );
  }

  // Only pre-load the full-res image for the current and adjacent slides
  const shouldLoadFullRes = Math.abs(offset) <= 1;

  return (
    <div className="progressive-slide">
      {/* Thumbnail layer — instant from browser cache */}
      <img
        className="thumbnail-layer"
        src={thumbnail}
        alt={slide.alt ?? ''}
        draggable={false}
        style={computeContainedStyle(slide, rect)}
      />

      {/* Full-res layer — loads in background, fades in on completion */}
      {shouldLoadFullRes && (
        <img
          className="fullres-layer"
          src={src}
          alt={slide.alt ?? ''}
          draggable={false}
          onLoad={handleLoad}
          style={{
            ...computeContainedStyle(slide, rect),
            opacity: loaded ? 1 : 0,
          }}
        />
      )}
    </div>
  );
}
