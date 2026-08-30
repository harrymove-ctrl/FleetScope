/**
 * `soft-blur-in` — the landing page's entrance.
 *
 * Implements the spec of the same id from the `animate-text` skill
 * (`.agents/skills/animate-text/assets/specs/soft-blur-in.json`): a
 * per-character fade from `opacity 0, y 16px, blur 12px` over 900ms on
 * `cubic-bezier(0.22, 1, 0.36, 1)`, stagger 25ms.
 *
 * Two of the spec's own usage notes are followed rather than ignored:
 * strings over 40 characters switch to per-word, because the stagger otherwise
 * runs longer than anyone will wait; and copy under 24px drops to blur 6 and
 * stagger 15, because 12px of blur on body text is illegible rather than soft.
 *
 * Splitting text into elements hides it from assistive technology as a word —
 * a screen reader can end up spelling it out — so the split container is
 * `aria-hidden` and the host carries the original string as its label.
 */

export const SOFT_BLUR_IN = {
  durationMs: 900,
  staggerMs: 25,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  fromY: 16,
  fromBlur: 12,
} as const;

/** Past this length the per-character stagger outlasts the reader's patience. */
export const PER_WORD_ABOVE = 40;

/** Below this size the full blur reads as a smudge rather than a focus pull. */
export const SMALL_TEXT_PX = 24;

export type SplitMode = 'character' | 'word';

/** Which unit to animate, per the spec's own note on long strings. */
export function splitMode(text: string, threshold = PER_WORD_ABOVE): SplitMode {
  return text.trim().length > threshold ? 'word' : 'character';
}

/** Blur and stagger, reduced for small copy as the spec requires. */
export function scaleForSize(fontSizePx: number): { blurPx: number; staggerMs: number } {
  if (!Number.isFinite(fontSizePx) || fontSizePx >= SMALL_TEXT_PX) {
    return { blurPx: SOFT_BLUR_IN.fromBlur, staggerMs: SOFT_BLUR_IN.staggerMs };
  }
  return { blurPx: 6, staggerMs: 15 };
}

/**
 * Split into animatable units.
 *
 * Words keep their trailing space so the line still breaks where it did; a
 * split that drops spaces reflows the heading it was supposed to decorate.
 */
export function splitText(text: string, mode: SplitMode): string[] {
  if (mode === 'word') {
    return text.split(/(\s+)/).filter((part) => part.length > 0);
  }
  return [...text];
}

/** When each unit starts, in ms. */
export function unitDelay(index: number, staggerMs: number): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return index * staggerMs;
}

export interface AnimateHandle {
  destroy(): void;
}

/**
 * Apply the effect to an element's own text.
 *
 * Returns a handle even when it does nothing — under reduced motion, or with
 * no text — so callers never branch on whether the page is allowed to move.
 */
export function animateText(host: HTMLElement, reduced = false): AnimateHandle {
  const text = host.textContent?.trim() ?? '';
  if (text.length === 0 || reduced) return { destroy() {} };

  const size = Number.parseFloat(getComputedStyle(host).fontSize);
  const { blurPx, staggerMs } = scaleForSize(size);
  const mode = splitMode(text);
  const units = splitText(text, mode);

  const frag = document.createDocumentFragment();
  const spans: HTMLElement[] = [];
  for (const [index, unit] of units.entries()) {
    if (/^\s+$/.test(unit)) {
      frag.append(unit);
      continue;
    }
    const span = document.createElement('span');
    span.className = 'at-unit';
    span.textContent = unit;
    span.style.animationDelay = `${unitDelay(index, staggerMs)}ms`;
    span.style.setProperty('--at-blur', `${blurPx}px`);
    frag.append(span);
    spans.push(span);
  }

  // The label goes on before the split, so the element never spends a frame
  // without an accessible name.
  host.setAttribute('aria-label', text);
  const holder = document.createElement('span');
  holder.setAttribute('aria-hidden', 'true');
  holder.append(frag);
  host.replaceChildren(holder);
  host.setAttribute('data-at-ready', '');

  return {
    destroy(): void {
      host.removeAttribute('data-at-ready');
      host.removeAttribute('aria-label');
      host.textContent = text;
      spans.length = 0;
    },
  };
}
