import { describe, expect, it } from 'vitest';
import {
  GAP,
  cardWidth,
  centerOffset,
  easeInOutExpo,
  easeOutCubic,
  layoutRow,
  nearestIndex,
  speedShrink,
  type CarouselCard,
} from '../src/features/launch/carousel';
import { cappedPixelRatio } from '../src/features/launch/motion';

/**
 * The carousel's layout maths.
 *
 * Hit-testing, snap targets and the renderer all ask these functions where a
 * card is. If they disagreed by a pixel the row would settle onto one card and
 * report another — which is the class of bug that is invisible until someone
 * notices the counter is off by one.
 */

const card = (id: string, aspect = 0.776): CarouselCard => ({
  id,
  src: `/product/${id}.png`,
  aspect,
});
const cards = [card('a'), card('b'), card('c')];
const H = 600;

describe('layoutRow', () => {
  it('places each card after the previous one plus the gap', () => {
    const { offsets } = layoutRow(cards, H, GAP);
    const width = cardWidth(0.776, H);
    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBeCloseTo(width + GAP, 5);
    expect(offsets[2]).toBeCloseTo((width + GAP) * 2, 5);
  });

  it('excludes the trailing gap from the total', () => {
    const { total } = layoutRow(cards, H, GAP);
    expect(total).toBeCloseTo(cardWidth(0.776, H) * 3 + GAP * 2, 5);
  });

  it('is empty-safe', () => {
    expect(layoutRow([], H, GAP)).toEqual({ offsets: [], total: 0 });
  });

  it('derives width from the aspect, keeping every card the same height', () => {
    const mixed = [card('a', 0.5), card('b', 2)];
    const { offsets } = layoutRow(mixed, H, GAP);
    expect(offsets[1]).toBeCloseTo(H * 0.5 + GAP, 5);
  });
});

describe('centerOffset and nearestIndex', () => {
  it('centres on the middle of the card, not its left edge', () => {
    expect(centerOffset(cards, 0, H, GAP)).toBeCloseTo(cardWidth(0.776, H) / 2, 5);
  });

  it('round-trips: the nearest card to a card centre is that card', () => {
    // The invariant the snap depends on. If this ever fails, the row settles
    // onto one card while the counter names another.
    for (let index = 0; index < cards.length; index += 1) {
      expect(nearestIndex(cards, centerOffset(cards, index, H, GAP), H, GAP)).toBe(index);
    }
  });

  it('clamps to the ends rather than running off', () => {
    expect(nearestIndex(cards, -10_000, H, GAP)).toBe(0);
    expect(nearestIndex(cards, 10_000, H, GAP)).toBe(cards.length - 1);
  });
});

describe('speedShrink', () => {
  it('never shrinks a card past the 25% cap', () => {
    expect(speedShrink(100_000)).toBeGreaterThanOrEqual(0.75);
    expect(speedShrink(-100_000)).toBeGreaterThanOrEqual(0.75);
  });

  it('leaves a still row at full size', () => {
    expect(speedShrink(0)).toBe(1);
  });

  it('is symmetric in direction', () => {
    expect(speedShrink(30)).toBeCloseTo(speedShrink(-30), 10);
  });
});

describe('easing', () => {
  it('starts at 0 and ends at 1', () => {
    for (const ease of [easeOutCubic, easeInOutExpo]) {
      expect(ease(0)).toBeCloseTo(0, 6);
      expect(ease(1)).toBeCloseTo(1, 6);
    }
  });

  it('clamps outside the unit range, so a late frame cannot overshoot', () => {
    expect(easeOutCubic(-3)).toBe(0);
    expect(easeOutCubic(9)).toBe(1);
    expect(easeInOutExpo(-3)).toBe(0);
    expect(easeInOutExpo(9)).toBe(1);
  });

  it('is monotonic', () => {
    for (const ease of [easeOutCubic, easeInOutExpo]) {
      let previous = -1;
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const value = ease(t);
        expect(value).toBeGreaterThanOrEqual(previous);
        previous = value;
      }
    }
  });
});

describe('cappedPixelRatio', () => {
  it('caps at 2, and at 1 once degraded', () => {
    expect(cappedPixelRatio(3)).toBe(2);
    expect(cappedPixelRatio(1.5)).toBe(1.5);
    expect(cappedPixelRatio(3, true)).toBe(1);
  });

  it('is safe on a nonsense ratio', () => {
    expect(cappedPixelRatio(0)).toBe(1);
    expect(cappedPixelRatio(Number.NaN)).toBe(1);
  });
});
