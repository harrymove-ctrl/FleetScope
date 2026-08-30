import { describe, expect, it } from 'vitest';
import {
  PER_WORD_ABOVE,
  SMALL_TEXT_PX,
  SOFT_BLUR_IN,
  scaleForSize,
  splitMode,
  splitText,
  unitDelay,
} from '../src/features/launch/animate-text';

/**
 * soft-blur-in, against the spec it claims to implement.
 *
 * The spec is a contract, not a mood: it names the durations, the stagger and
 * two conditions under which those numbers must change. These check the parts
 * that decide what a reader actually sees — which unit is animated, how long
 * the whole run takes, and whether the text survives being split.
 */
describe('splitMode', () => {
  it('animates characters for a short heading', () => {
    expect(splitMode('FleetScope')).toBe('character');
  });

  it('switches to words past the spec threshold', () => {
    // Per-character on a long string staggers well past a second, which the
    // spec calls out and which reads as a page that has not finished loading.
    const long = 'x'.repeat(PER_WORD_ABOVE + 1);
    expect(splitMode(long)).toBe('word');
  });

  it('measures the trimmed string, not the surrounding whitespace', () => {
    expect(splitMode(`  ${'x'.repeat(PER_WORD_ABOVE)}  `)).toBe('character');
  });
});

describe('scaleForSize', () => {
  it('uses the spec defaults at heading size', () => {
    expect(scaleForSize(64)).toEqual({
      blurPx: SOFT_BLUR_IN.fromBlur,
      staggerMs: SOFT_BLUR_IN.staggerMs,
    });
  });

  it('drops blur and stagger on small copy', () => {
    // 12px of blur on 16px text is a smudge, not a focus pull.
    expect(scaleForSize(SMALL_TEXT_PX - 1)).toEqual({ blurPx: 6, staggerMs: 15 });
  });

  it('treats an unmeasurable size as a heading rather than guessing small', () => {
    expect(scaleForSize(Number.NaN).blurPx).toBe(SOFT_BLUR_IN.fromBlur);
  });
});

describe('splitText', () => {
  it('keeps every character', () => {
    expect(splitText('Fleet', 'character').join('')).toBe('Fleet');
  });

  it('keeps the spaces when splitting by word', () => {
    // Dropping them reflows the very heading the effect is decorating.
    const text = 'Watch agent work become evidence';
    expect(splitText(text, 'word').join('')).toBe(text);
  });

  it('keeps an astral character whole', () => {
    expect(splitText('a🛰b', 'character')).toEqual(['a', '🛰', 'b']);
  });
});

describe('unitDelay', () => {
  it('starts the first unit immediately', () => {
    expect(unitDelay(0, 25)).toBe(0);
  });

  it('steps by the stagger', () => {
    expect(unitDelay(4, 25)).toBe(100);
  });

  it('keeps a heading under the spec"s own patience limit', () => {
    // "FleetScope" is 10 units; last start plus the 900ms run must stay near
    // the 1300ms the spec names as the ceiling for a swap.
    const last = unitDelay(9, SOFT_BLUR_IN.staggerMs) + SOFT_BLUR_IN.durationMs;
    expect(last).toBeLessThanOrEqual(1300);
  });

  it('never runs backwards on a bad index', () => {
    expect(unitDelay(-2, 25)).toBe(0);
  });
});
