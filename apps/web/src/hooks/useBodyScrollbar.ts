import { useEffect } from 'react';
import { useOverlayScrollbars } from 'overlayscrollbars-react';

/**
 * Attaches OverlayScrollbars to a target scroll container.
 *
 * Previously this hook always targeted `document.body`. Now that
 * AppLayout scrolls inside `<main>` (so the sticky header doesn't move
 * during iOS rubber-band overscroll), pass the <main> element here.
 * Falls back to document.body if nothing is provided — keeps callers
 * that still want page-level scroll working.
 */
export function useBodyScrollbar(element?: HTMLElement | null) {
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
    // `element` starts as null on first render (ref callback hasn't fired);
    // wait until a real element is available, or fall back to body when
    // the caller opts out of passing one entirely.
    const target = element ?? (element === undefined ? document.body : null);
    if (!target) return;

    initialize(target);
    return () => {
      instance()?.destroy();
    };
  }, [initialize, instance, element]);
}
