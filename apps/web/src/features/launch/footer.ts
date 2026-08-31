/**
 * The peel footer's reveal maths.
 *
 * The footer is fixed behind the page. The page ends with a viewport-tall
 * spacer, so scrolling to the bottom slides the opaque content off the top of
 * the fixed footer and uncovers it — nothing animates the footer itself, which
 * is why the reveal cannot fall out of sync with the scroll.
 *
 * Only the wordmark is scripted: its letters rise in sequence once the spacer
 * is genuinely on screen. These are the pure parts of that.
 */

/** Seconds between one wordmark letter and the next. */
export const LETTER_STEP = 0.1;

/** How much of the spacer must be visible before the letters begin. */
export const REVEAL_THRESHOLD = 0.1;

/**
 * Split a wordmark into rendered units.
 *
 * Uses the iterator rather than `split('')` so an astral character — an emoji
 * wordmark, say — stays one letter instead of becoming two lone surrogates
 * that animate apart.
 */
export function wordmarkLetters(brand: string): readonly string[] {
  return [...brand];
}

/** The stagger delay for letter `index`, in seconds. */
export function letterDelay(index: number, step: number = LETTER_STEP): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.round(index * step * 1000) / 1000;
}

/**
 * Whether the wordmark should be showing.
 *
 * Deliberately symmetric: the letters fall back out when the spacer leaves, so
 * a second scroll down plays the reveal again rather than finding it already
 * spent.
 */
export function isRevealed(intersectionRatio: number, threshold = REVEAL_THRESHOLD): boolean {
  if (!Number.isFinite(intersectionRatio)) return false;
  return intersectionRatio >= threshold;
}

export interface FooterRevealHandle {
  destroy(): void;
}

/** Wire the spacer's visibility to the wordmark's `is-visible` class. */
export function mountFooterReveal(
  spacer: Element,
  wordmark: Element,
  threshold = REVEAL_THRESHOLD,
): FooterRevealHandle {
  if (typeof IntersectionObserver !== 'function') {
    // No observer, no reveal to sequence: show the wordmark outright rather
    // than leaving eight invisible letters behind.
    wordmark.classList.add('is-visible');
    return { destroy() {} };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      wordmark.classList.toggle('is-visible', isRevealed(entry.intersectionRatio, threshold));
    },
    { threshold: [0, threshold, 1] },
  );
  observer.observe(spacer);

  return {
    destroy(): void {
      observer.disconnect();
    },
  };
}
