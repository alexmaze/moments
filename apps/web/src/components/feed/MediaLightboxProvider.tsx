import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Lightbox, { type Slide } from 'yet-another-react-lightbox';
import Video from 'yet-another-react-lightbox/plugins/video';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import 'yet-another-react-lightbox/plugins/counter.css';

interface MediaLightboxContextValue {
  open: (slides: Slide[], index?: number) => void;
}

const MediaLightboxContext = createContext<MediaLightboxContextValue | null>(
  null,
);

interface LightboxState {
  open: boolean;
  slides: Slide[];
  index: number;
}

/**
 * Global lightbox singleton.
 *
 * Every `PostCard` used to mount its own `<LightGallery>` instance, which
 * scaled poorly with feed size (50+ cards = 50+ gallery instances). The
 * first pass replaced that with a single lightGallery `dynamic` instance
 * shared via Context, but lightGallery's imperative `refresh()` added a
 * perceptible delay when switching data sources. This iteration swaps the
 * backend to `yet-another-react-lightbox` — a React-first library where
 * `slides` is just a prop, so switching posts is an ordinary re-render
 * with no DOM tear-down.
 */
export function MediaLightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LightboxState>({
    open: false,
    slides: [],
    index: 0,
  });

  const open = useCallback((slides: Slide[], index = 0) => {
    if (slides.length === 0) return;
    setState({ open: true, slides, index });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <MediaLightboxContext.Provider value={value}>
      {children}
      <Lightbox
        open={state.open}
        close={close}
        slides={state.slides}
        index={state.index}
        plugins={[Video, Zoom, Counter]}
        carousel={{ finite: true }}
        controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
        zoom={{ scrollToZoom: true, maxZoomPixelRatio: 1 }}
        video={{ autoPlay: false, controls: true, playsInline: true }}
        className="moments-lightbox"
      />
    </MediaLightboxContext.Provider>
  );
}

export function useMediaLightbox(): MediaLightboxContextValue {
  const ctx = useContext(MediaLightboxContext);
  if (!ctx) {
    throw new Error(
      'useMediaLightbox must be used within a <MediaLightboxProvider>',
    );
  }
  return ctx;
}
