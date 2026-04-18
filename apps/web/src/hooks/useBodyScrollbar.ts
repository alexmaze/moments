import { useEffect } from 'react';
import { useOverlayScrollbars } from 'overlayscrollbars-react';

/**
 * Attaches OverlayScrollbars to document.body for the main page scroll.
 * Call once inside AppLayout (mounts for every authenticated page).
 */
export function useBodyScrollbar() {
  const [initialize, instance] = useOverlayScrollbars({
    options: {
      scrollbars: {
        theme: 'os-theme-moments',
        autoHide: 'scroll',
        autoHideDelay: 1200,
        autoHideSuspend: false,
        dragScroll: true,
        clickScroll: false,
      },
    },
    defer: true,
  });

  useEffect(() => {
    initialize(document.body);
    return () => {
      instance()?.destroy();
    };
  }, [initialize, instance]);
}
