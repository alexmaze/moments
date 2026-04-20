import { createContext, useContext } from 'react';

/**
 * The main scroll container element provided by AppLayout.
 *
 * The app scrolls inside <main> rather than the window so the sticky
 * header can stay put while iOS rubber-band overscroll still feels
 * native inside the feed. Any child that needs to observe viewport
 * intersection (infinite scroll) must consume this ref and pass it as
 * the `root` option to IntersectionObserver — otherwise observations
 * will silently stop firing.
 *
 * `null` is a valid value during the first render before the <main>
 * element mounts; observers should gracefully handle that.
 */
export const ScrollContainerContext = createContext<HTMLElement | null>(null);

export function useScrollContainer(): HTMLElement | null {
  return useContext(ScrollContainerContext);
}
