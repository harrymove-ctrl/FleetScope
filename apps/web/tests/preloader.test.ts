import { describe, expect, it } from 'vitest';
import {
  PRELOADER_MAX_MS,
  shouldDismiss,
  shouldShow,
  wrapped,
} from '../src/features/preloader/state';

/**
 * When the preloader leaves.
 *
 * A preloader is an obstacle by construction, so the only interesting
 * behaviour is how it gets out of the way. These cover the paths that trap a
 * visitor: a ceiling that does not hold, a pass that never completes, and a
 * page that never reports ready.
 */
describe('shouldDismiss', () => {
  const ready = { passComplete: true, pageReady: true };

  it('waits while the animation and the page are both unfinished', () => {
    expect(shouldDismiss({ elapsedMs: 400, passComplete: false, pageReady: false })).toBe(false);
  });

  it('leaves once the pass has run and the page is ready', () => {
    expect(shouldDismiss({ elapsedMs: 400, ...ready })).toBe(true);
  });

  it('will not leave on a finished pass alone while the page is still loading', () => {
    expect(shouldDismiss({ elapsedMs: 400, passComplete: true, pageReady: false })).toBe(false);
  });

  it('leaves at the ceiling however unfinished everything else is', () => {
    // The case that matters: a slow network or a stalled frame loop must not
    // hold someone in front of a logo.
    expect(
      shouldDismiss({ elapsedMs: PRELOADER_MAX_MS, passComplete: false, pageReady: false }),
    ).toBe(true);
  });

  it('leaves rather than staying when the clock is unreadable', () => {
    expect(shouldDismiss({ elapsedMs: Number.NaN, passComplete: false, pageReady: false })).toBe(
      true,
    );
  });
});

describe('shouldShow', () => {
  it('shows on a first visit', () => {
    expect(shouldShow(false, false)).toBe(true);
  });

  it('does not show twice in one tab', () => {
    expect(shouldShow(true, false)).toBe(false);
  });

  it('is skipped entirely under reduced motion', () => {
    // Not a static frame: a still image of a loading animation is a delay
    // with a picture on it.
    expect(shouldShow(false, true)).toBe(false);
  });
});

describe('wrapped', () => {
  const LOOP = 8;

  it('sees a fall from the end of the loop to its start as a pass', () => {
    expect(wrapped(7.9, 0.05, LOOP)).toBe(true);
  });

  it('does not call ordinary progress a wrap', () => {
    expect(wrapped(1, 1.4, LOOP)).toBe(false);
  });

  it('ignores a small dip below zero on the first tick', () => {
    // A frame's timestamp can predate the moment the loop started, so the
    // clock goes slightly negative. Read as a wrap it dismissed the overlay
    // 200ms in, before the word had finished splitting.
    expect(wrapped(0, -0.029, LOOP)).toBe(false);
  });

  it('needs the fall to clear half the loop', () => {
    expect(wrapped(LOOP / 2, 0.01, LOOP)).toBe(false);
    expect(wrapped(LOOP - 0.1, 0.01, LOOP)).toBe(true);
  });

  it('treats an unreadable clock or loop as no wrap, so the ceiling decides', () => {
    expect(wrapped(Number.NaN, 1, LOOP)).toBe(false);
    expect(wrapped(7.9, 0.05, 0)).toBe(false);
  });
});
