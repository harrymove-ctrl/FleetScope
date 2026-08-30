/**
 * A cached `getBoundingClientRect`, refreshed only when it can have changed.
 *
 * The Bend engine reads the output canvas's rect on every pointer move to map
 * a cursor position onto the folded surface. Calling `getBoundingClientRect`
 * there forces a synchronous layout on every mouse event, which is the kind of
 * cost that only shows up as "it feels heavy". This reads it once and again on
 * the events that can actually invalidate it.
 */
export interface RectCache {
  readonly current: DOMRect;
  destroy(): void;
}

export function createRectCache(element: Element): RectCache {
  let rect = element.getBoundingClientRect();

  const refresh = (): void => {
    rect = element.getBoundingClientRect();
  };

  // Scroll and resize move the element without resizing it, so the observer
  // alone is not enough.
  window.addEventListener('scroll', refresh, { passive: true, capture: true });
  window.addEventListener('resize', refresh, { passive: true });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(refresh) : null;
  observer?.observe(element);

  return {
    get current(): DOMRect {
      return rect;
    },
    destroy(): void {
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
      observer?.disconnect();
    },
  };
}
