import { describe, expect, it } from 'vitest';
import {
  FOLD_DEFAULTS,
  cornerReveal,
  bandRotation,
  effectiveZone,
  faceOffset,
  foldAmounts,
  ramp,
} from '../src/features/bend/fold';

/**
 * The fold's geometry.
 *
 * Everything visible about the effect comes out of these four functions: how
 * far each edge has folded, which way each band turns, how tall a band may be,
 * and where the face has travelled to. Getting any of them wrong is a crease in
 * the wrong place, and a crease in the wrong place is not subtle.
 */
describe('ramp', () => {
  it('is flat at the ends and smooth between', () => {
    expect(ramp(0, 240)).toBe(0);
    expect(ramp(240, 240)).toBe(1);
    expect(ramp(120, 240)).toBeCloseTo(0.5, 5);
  });

  it('clamps rather than overshooting past the ramp', () => {
    expect(ramp(1000, 240)).toBe(1);
    expect(ramp(-50, 240)).toBe(0);
  });

  it('survives a zero-length ramp instead of dividing by it', () => {
    expect(Number.isFinite(ramp(10, 0))).toBe(true);
  });
});

describe('foldAmounts', () => {
  const { ease } = FOLD_DEFAULTS;

  it('leaves the top flat at the start of the scroll', () => {
    // Otherwise the first thing a visitor sees is a folded heading.
    expect(foldAmounts(0, 4000, ease).top).toBe(0);
  });

  it('leaves the bottom flat at the end of the scroll', () => {
    expect(foldAmounts(4000, 4000, ease).bottom).toBe(0);
  });

  it('folds both edges in the middle', () => {
    const mid = foldAmounts(2000, 4000, ease);
    expect(mid.top).toBe(1);
    expect(mid.bottom).toBe(1);
  });

  it('does not fold a face with nothing to scroll', () => {
    expect(foldAmounts(0, 0, ease)).toEqual({ top: 0, bottom: 0 });
    expect(foldAmounts(0, 1, ease)).toEqual({ top: 0, bottom: 0 });
  });

  it('clamps a scroll position past either end', () => {
    expect(foldAmounts(-500, 4000, ease).top).toBe(0);
    expect(foldAmounts(9999, 4000, ease).bottom).toBe(0);
  });

  it('treats a missing measurement as unfolded', () => {
    expect(foldAmounts(Number.NaN, 4000, ease)).toEqual({ top: 0, bottom: 0 });
  });
});

describe('bandRotation', () => {
  it('turns the two bands in opposite directions', () => {
    // They pivot about creases on opposite sides, so equal signs would fold
    // the face into a Z rather than around a box.
    const top = bandRotation('top', 1, 80, 'in');
    const bottom = bandRotation('bottom', 1, 80, 'in');
    expect(Math.sign(top)).toBe(-Math.sign(bottom));
    expect(Math.abs(top)).toBe(Math.abs(bottom));
  });

  it('reverses with direction', () => {
    expect(bandRotation('top', 1, 80, 'in')).toBe(-bandRotation('top', 1, 80, 'out'));
  });

  it('scales with how folded the edge is', () => {
    // `toBeCloseTo`, not `toBe`: an unfolded band computes to -0, which is the
    // same rotation as 0 and which Object.is would call a failure.
    expect(bandRotation('top', 0, 80, 'in')).toBeCloseTo(0, 10);
    expect(Math.abs(bandRotation('top', 0.5, 80, 'in'))).toBeCloseTo(40, 5);
  });

  it('refuses to fold past the point where a band would invert', () => {
    expect(Math.abs(bandRotation('top', 1, 500, 'in'))).toBe(160);
    expect(Math.abs(bandRotation('top', 5, 80, 'in'))).toBe(80);
  });
});

describe('effectiveZone', () => {
  it('keeps the two bands from overlapping', () => {
    // A zone past half the face would have both bands claiming the same rows.
    expect(effectiveZone(600, 800)).toBe(400);
  });

  it('leaves a zone that fits alone', () => {
    expect(effectiveZone(240, 900)).toBe(240);
  });

  it('has no zone in a face with no height', () => {
    expect(effectiveZone(240, 0)).toBe(0);
  });
});

describe('faceOffset', () => {
  it('is zero before the face is reached', () => {
    expect(faceOffset(100, 900, 4000)).toBe(0);
  });

  it('tracks the scroll once inside the face', () => {
    expect(faceOffset(1500, 900, 4000)).toBe(600);
  });

  it('stops at the end of the content rather than running past it', () => {
    expect(faceOffset(99_999, 900, 4000)).toBe(4000);
  });
});

describe('cornerReveal', () => {
  const H = 900;
  const ZONE = 240;

  it('is hidden while the block is still below the face', () => {
    expect(cornerReveal(H, H, ZONE)).toBe(0);
    expect(cornerReveal(H + 400, H, ZONE)).toBe(0);
  });

  it('is fully resolved once the block is clear of the bottom crease', () => {
    // Anything still folding must not also be half-dissolved — two effects on
    // the same text at once reads as a rendering fault, not a reveal.
    expect(cornerReveal(H - ZONE - 220, H, ZONE)).toBe(1);
    expect(cornerReveal(0, H, ZONE)).toBe(1);
    expect(cornerReveal(-500, H, ZONE)).toBe(1);
  });

  it('rises monotonically as the block travels up', () => {
    const seen = [H, H - 100, H - 250, H - 400, H - 600].map((t) => cornerReveal(t, H, ZONE));
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!);
    }
  });

  it('resolves everything when the face has no height to measure', () => {
    // A block that never resolves is a block that is never readable.
    expect(cornerReveal(10, 0, ZONE)).toBe(1);
    expect(cornerReveal(Number.NaN, H, ZONE)).toBe(1);
  });
});
