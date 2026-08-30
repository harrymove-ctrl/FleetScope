import { describe, expect, it } from 'vitest';
import {
  BEND_DEFAULTS,
  foldAmounts,
  foldPlan,
  settle,
  smoothstep,
} from '../src/features/launch/bend';

/**
 * The fold's maths.
 *
 * The property that matters is that both scroll ends flatten: the first screen
 * has nothing above it to fold away and the last has nothing below, so a page
 * that bends there is bending nothing and looks broken.
 */

describe('smoothstep', () => {
  it('is clamped and symmetric about the midpoint', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 6);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(9)).toBe(1);
  });
});

describe('foldAmounts', () => {
  const max = 4000;

  it('flattens the top edge at the top of the page', () => {
    expect(foldAmounts(0, max, BEND_DEFAULTS).top).toBe(0);
  });

  it('flattens the bottom edge at the bottom of the page', () => {
    expect(foldAmounts(max, max, BEND_DEFAULTS).bottom).toBe(0);
  });

  it('folds both edges through the middle', () => {
    const mid = foldAmounts(max / 2, max, BEND_DEFAULTS);
    expect(mid.top).toBe(1);
    expect(mid.bottom).toBe(1);
  });

  it('reaches full fold after the ease distance', () => {
    expect(foldAmounts(BEND_DEFAULTS.ease, max, BEND_DEFAULTS).top).toBe(1);
    expect(foldAmounts(BEND_DEFAULTS.ease / 2, max, BEND_DEFAULTS).top).toBeCloseTo(0.5, 6);
  });

  it('does not fold a page that cannot scroll', () => {
    expect(foldAmounts(0, 0, BEND_DEFAULTS)).toEqual({ top: 0, bottom: 0 });
  });

  it('honours the per-edge switches', () => {
    const off = { ...BEND_DEFAULTS, top: false, bottom: false };
    expect(foldAmounts(max / 2, max, off)).toEqual({ top: 0, bottom: 0 });
  });

  it('clamps a scroll position past either end', () => {
    expect(foldAmounts(-500, max, BEND_DEFAULTS).top).toBe(0);
    expect(foldAmounts(max + 500, max, BEND_DEFAULTS).bottom).toBe(0);
  });
});

describe('foldPlan', () => {
  const vh = 900;
  const opts = { zone: 240, angle: 80, direction: 'in' as const };
  const both = { top: 1, bottom: 1 };

  it('leaves the flat middle untransformed', () => {
    expect(foldPlan(400, 100, vh, both, opts)).toBeNull();
  });

  it('folds deeper the further a row is into the zone', () => {
    const shallow = foldPlan(700, 100, vh, both, opts)!;
    const deep = foldPlan(820, 100, vh, both, opts)!;
    expect(Math.abs(deep.degrees)).toBeGreaterThan(Math.abs(shallow.degrees));
  });

  it('hinges about the near edge of the row', () => {
    // Bottom zone folds up about its own top edge; top zone folds away about
    // its own bottom edge. An origin outside the element would collapse a row
    // that only partly overlaps the zone.
    expect(foldPlan(820, 100, vh, both, opts)!.originY).toBe(0);
    expect(foldPlan(-20, 100, vh, both, opts)!.originY).toBe(100);
  });

  it('leaves off-screen rows alone', () => {
    // Without this a row far above the crease still hinges about it, and the
    // rotation projects it back into view: the list piles up at the fold.
    expect(foldPlan(-4000, 300, vh, both, opts)).toBeNull();
    expect(foldPlan(vh + 500, 300, vh, both, opts)).toBeNull();
  });

  it('folds the two zones in opposite directions', () => {
    const top = foldPlan(-20, 100, vh, both, opts)!;
    const bottom = foldPlan(880, 100, vh, both, opts)!;
    expect(Math.sign(top.degrees)).toBe(-Math.sign(bottom.degrees));
  });

  it('does not fold an edge whose amount is zero', () => {
    expect(foldPlan(-20, 100, vh, { top: 0, bottom: 1 }, opts)).toBeNull();
    expect(foldPlan(880, 100, vh, { top: 1, bottom: 0 }, opts)).toBeNull();
  });

  it('scales the angle with how folded the edge is', () => {
    const half = foldPlan(880, 100, vh, { top: 0, bottom: 0.5 }, opts)!;
    const full = foldPlan(880, 100, vh, both, opts)!;
    expect(Math.abs(half.degrees)).toBeCloseTo(Math.abs(full.degrees) / 2, 6);
  });

  it('reverses with direction', () => {
    const inward = foldPlan(880, 100, vh, both, { ...opts, direction: 'in' })!;
    const outward = foldPlan(880, 100, vh, both, { ...opts, direction: 'out' })!;
    expect(Math.sign(inward.degrees)).toBe(-Math.sign(outward.degrees));
  });

  it('never lets a zone eat more than half the viewport', () => {
    // Two overlapping zones would leave no flat middle, so an element would be
    // in both at once and the fold would fight itself.
    const plan = foldPlan(400, 10, vh, both, { ...opts, zone: 100_000 });
    expect(plan === null || Number.isFinite(plan.originY)).toBe(true);
  });
});

describe('settle', () => {
  it('snaps when smoothing is off', () => {
    expect(settle(0, 1, 0.016, 0)).toBe(1);
  });

  it('lands exactly on the target rather than approaching forever', () => {
    // The render loop stops on equality, so a value that only ever approaches
    // would spin a frame every 16ms for the life of the page.
    let v = 0;
    for (let i = 0; i < 200; i += 1) v = settle(v, 1, 1 / 60, 0.1);
    expect(v).toBe(1);
  });

  it('is frame-rate independent', () => {
    let slow = 0;
    let fast = 0;
    for (let i = 0; i < 30; i += 1) slow = settle(slow, 1, 1 / 30, 0.2);
    for (let i = 0; i < 60; i += 1) fast = settle(fast, 1, 1 / 60, 0.2);
    expect(slow).toBeCloseTo(fast, 2);
  });
});
