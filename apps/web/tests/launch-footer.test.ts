import { describe, expect, it, vi } from 'vitest';
import {
  LETTER_STEP,
  REVEAL_THRESHOLD,
  isRevealed,
  letterDelay,
  mountFooterReveal,
  wordmarkLetters,
} from '../src/features/launch/footer';

/**
 * The peel footer's scripted part.
 *
 * The reveal itself is layout — the page slides off a fixed sheet — so there is
 * nothing to test there and nothing that can drift. What is scripted is the
 * wordmark: which letters exist, when each starts, and whether it should be
 * showing at all. Those are the three things that can be wrong on screen.
 */
describe('wordmarkLetters', () => {
  it('splits a plain wordmark into its letters', () => {
    expect(wordmarkLetters('fleet')).toEqual(['f', 'l', 'e', 'e', 't']);
  });

  it('keeps an astral character whole', () => {
    // `split('')` would cut this into two lone surrogates, which then animate
    // apart into two pieces of a broken glyph.
    expect(wordmarkLetters('a🛰b')).toEqual(['a', '🛰', 'b']);
  });

  it('has nothing to stagger for an empty wordmark', () => {
    expect(wordmarkLetters('')).toEqual([]);
  });
});

describe('letterDelay', () => {
  it('starts the first letter immediately', () => {
    expect(letterDelay(0)).toBe(0);
  });

  it('steps each later letter by one interval', () => {
    expect(letterDelay(1)).toBeCloseTo(LETTER_STEP, 5);
    expect(letterDelay(4)).toBeCloseTo(4 * LETTER_STEP, 5);
  });

  it('is monotonic, so letters never overtake each other', () => {
    const delays = [0, 1, 2, 3, 4, 5].map((i) => letterDelay(i));
    const sorted = [...delays].sort((a, b) => a - b);
    expect(delays).toEqual(sorted);
  });

  it('refuses to run backwards on a bad index', () => {
    expect(letterDelay(-3)).toBe(0);
    expect(letterDelay(Number.NaN)).toBe(0);
  });
});

describe('isRevealed', () => {
  it('shows the wordmark once the spacer is meaningfully on screen', () => {
    expect(isRevealed(REVEAL_THRESHOLD)).toBe(true);
    expect(isRevealed(1)).toBe(true);
  });

  it('stays hidden while the spacer is barely clipped in', () => {
    expect(isRevealed(0)).toBe(false);
    expect(isRevealed(REVEAL_THRESHOLD - 0.01)).toBe(false);
  });

  it('treats a missing ratio as not revealed rather than as revealed', () => {
    expect(isRevealed(Number.NaN)).toBe(false);
  });
});

describe('mountFooterReveal', () => {
  const el = (): Element =>
    ({ classList: { add: vi.fn(), toggle: vi.fn() } }) as unknown as Element;

  it('toggles the class from the latest entry', () => {
    const observers: Array<(entries: unknown[]) => void> = [];
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: unknown[]) => void) {
          observers.push(cb);
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );

    const wordmark = el();
    const handle = mountFooterReveal(el(), wordmark);

    observers[0]?.([{ intersectionRatio: 0 }, { intersectionRatio: 0.6 }]);
    expect(wordmark.classList.toggle).toHaveBeenCalledWith('is-visible', true);

    observers[0]?.([{ intersectionRatio: 0 }]);
    expect(wordmark.classList.toggle).toHaveBeenLastCalledWith('is-visible', false);

    handle.destroy();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('shows the wordmark outright where there is no observer to sequence it', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const wordmark = el();
    mountFooterReveal(el(), wordmark);
    // The alternative is eight permanently invisible letters.
    expect(wordmark.classList.add).toHaveBeenCalledWith('is-visible');
    vi.unstubAllGlobals();
  });
});
