import { describe, expect, it } from 'vitest';
import {
  PALETTES,
  PULSE_DUR,
  ROWS,
  ROW_START_FRAME,
  checkerParityHolds,
} from '../src/features/checker/params';
import { WARPED_PERIOD, toMeasured } from '../src/features/checker/engine';

/**
 * The measurement, checked as data.
 *
 * These tables are not preferences, so the tests do not assert taste. They
 * assert the properties the piece falls apart without: the parity rule that
 * keeps the checker a checker, the three-scene structure the timing tables
 * assume, and a time warp that is monotone and lands exactly on its endpoints.
 */
describe('palette parity', () => {
  it.each(PALETTES.map((p) => [p.id, p] as const))(
    '%s never puts the same colour on both sides of the rectangle border',
    (_id, palette) => {
      // Adjacent ground and rectangle cells always land on opposite parity, so
      // a repeat merges the two into blobs and the checker visibly breaks.
      // It is the single easiest thing to get wrong when adding a palette.
      for (const scene of palette.scenes) {
        expect(checkerParityHolds(scene)).toBe(true);
      }
    },
  );

  it('gives every palette exactly three scenes', () => {
    // Three is structural, not cosmetic: the timing tables carry three pulse
    // durations and three rows of fitted starts.
    for (const palette of PALETTES) expect(palette.scenes).toHaveLength(3);
  });
});

describe('timing tables', () => {
  it('has one fitted start per row for each pulse', () => {
    expect(ROW_START_FRAME).toHaveLength(PULSE_DUR.length);
    for (const pulse of ROW_START_FRAME) expect(pulse).toHaveLength(ROWS);
  });

  it('cascades strictly down each pulse', () => {
    // The stagger is the whole undulation. A row starting before the one above
    // it would read as a tear rather than a wave.
    for (const pulse of ROW_START_FRAME) {
      for (let r = 1; r < pulse.length; r++) {
        expect(pulse[r]!).toBeGreaterThan(pulse[r - 1]!);
      }
    }
  });

  it('keeps the stagger uneven, because the source is hand-made', () => {
    // Regularised into a uniform cascade this reads as a wipe, so a table that
    // has been "tidied" is a real regression.
    const first = ROW_START_FRAME[0]!;
    const gaps = first.slice(1).map((v, i) => +(v - first[i]!).toFixed(4));
    expect(new Set(gaps).size).toBeGreaterThan(1);
  });

  it('ends the loop with the exit pulse as the snappiest', () => {
    // Flattening the three to one duration loses the accelerating feel.
    expect(PULSE_DUR[2]).toBeLessThan(PULSE_DUR[0]!);
    expect(PULSE_DUR[2]).toBeLessThan(PULSE_DUR[1]!);
  });
});

describe('time warp', () => {
  it('starts at zero', () => {
    expect(toMeasured(0)).toBeCloseTo(0, 6);
  });

  it('is monotone across the whole clock period', () => {
    // A non-monotone map runs the board backwards mid-pulse.
    let previous = -Infinity;
    for (let i = 0; i <= 400; i++) {
      const v = toMeasured((i / 400) * WARPED_PERIOD);
      expect(v).toBeGreaterThanOrEqual(previous);
      previous = v;
    }
  });

  it('compresses the clock against the measured loop', () => {
    // The measured loop is 34% dead air, which drags in a scrolling page.
    expect(WARPED_PERIOD).toBeLessThan(346 / 30);
    expect(WARPED_PERIOD).toBeGreaterThan(0);
  });
});
