/**
 * A cached `getBoundingClientRect`, refreshed only when it can have changed.
 *
 * The Bend engine reads the output canvas's rect on every pointer move to map
 * a cursor position onto the folded surface. Calling `getBoundingClientRect`
 * there forces a synchronous layout on every mouse event, which is the kind of
 * cost that only shows up as "it feels heavy". This reads it once and again on
 * the events that can actually invalidate it.
 */

export function createRectCache(element: Element) {
  let current = element.getBoundingClientRect();

  const refresh = () => {
    current = element.getBoundingClientRect();
  };

  const observer = new ResizeObserver(refresh);
  observer.observe(element);
  window.addEventListener('resize', refresh, { passive: true });
  window.addEventListener('scroll', refresh, {
    capture: true,
    passive: true,
  });

  return {
    get current() {
      return current;
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    },
  };
}
