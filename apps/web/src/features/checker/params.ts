/*
 * Checker conveyor — parameters.
 *
 * Vendored from the checker-conveyor reference, rebuilt from a 540x304,
 * 346-frame, 30fps GIF that loops seamlessly in 11.53s.
 *
 * The tables here are measurements, not preferences. Two in particular:
 *
 *   ROW_START_FRAME was least-squares fitted per row against that row's own
 *   seam trajectory, and carries the source's ±0.2-frame hand jitter around a
 *   ~3.6-frame cascade. Regularising it into a uniform stagger turns the wave
 *   into a wipe.
 *
 *   EASE_LUT is the whip: ~24 frames of windup to 23% of the distance, then
 *   HALF THE TRAVEL IN 2-4 FRAMES, then ~24 frames of settle. Expo.inOut is
 *   close but too round in the middle and too thin in the tails.
 *
 * A palette is always exactly three scenes, because three is structural: the
 * timing tables carry three pulse durations and three rows of nine fitted
 * starts, so any other count desyncs the measurement.
 */

export const ROWS = 9;
export const REF_COLS = 16;

export const RECT_ROW_START = 2;
export const RECT_ROW_END = 6;
export const RECT_COLS = 12;

export interface Scene {
  readonly ground: readonly [string, string];
  readonly rect: readonly [string, string];
}

export type Direction = 'left' | 'right' | 'split';

export interface Palette {
  id: string;
  name: string;
  scenes: readonly [Scene, Scene, Scene];
  direction: Direction;
  reverseCascade?: boolean;
}

/*
 * WITHIN a scene the rectangle border must never repeat a colour: adjacent
 * ground and rectangle cells always have opposite parity, so ground.even must
 * differ from rect.odd and ground.odd from rect.even, or the two merge into
 * blobs and the checker visibly breaks. `checkerParityHolds` in this module
 * asserts it, and a test runs it over every palette.
 *
 * Continuity DOES break at the seam between two scenes — two lights or two
 * darks can touch. That is in the source frames and is kept: scenes are
 * absolute patterns, not carried state.
 */
export const PALETTES: readonly Palette[] = [
  {
    id: 'arcade',
    name: 'Arcade',
    direction: 'left',
    scenes: [
      { ground: ['#0066fd', '#63ecff'], rect: ['#0066fd', '#63ecff'] },
      { ground: ['#0066fd', '#63ecff'], rect: ['#ffbaf1', '#ff0100'] },
      { ground: ['#ffb800', '#000000'], rect: ['#ff57bb', '#f2edd9'] },
    ],
  },
  {
    id: 'risograph',
    name: 'Risograph',
    direction: 'left',
    scenes: [
      { ground: ['#f4f1e8', '#ff48b0'], rect: ['#f4f1e8', '#ff48b0'] },
      { ground: ['#f4f1e8', '#ff48b0'], rect: ['#1a3fd4', '#0a1f7a'] },
      { ground: ['#1a3fd4', '#f4f1e8'], rect: ['#ff48b0', '#1a1a1a'] },
    ],
  },
  {
    id: 'plaster',
    name: 'Plaster',
    direction: 'right',
    scenes: [
      { ground: ['#e5dcc8', '#c96a4b'], rect: ['#e5dcc8', '#c96a4b'] },
      { ground: ['#9aa87c', '#e5dcc8'], rect: ['#3d4a2f', '#e5dcc8'] },
      { ground: ['#2b2a26', '#d8c9a8'], rect: ['#c96a4b', '#f0e9d8'] },
    ],
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    direction: 'split',
    scenes: [
      { ground: ['#111111', '#e8e8e8'], rect: ['#111111', '#e8e8e8'] },
      { ground: ['#111111', '#e8e8e8'], rect: ['#7a7a7a', '#e8e8e8'] },
      { ground: ['#e8e8e8', '#111111'], rect: ['#5a5a5a', '#c8c8c8'] },
    ],
  },
  {
    id: 'acid',
    name: 'Acid',
    direction: 'left',
    reverseCascade: true,
    scenes: [
      { ground: ['#2d1b4e', '#c6f24e'], rect: ['#2d1b4e', '#c6f24e'] },
      { ground: ['#2d1b4e', '#c6f24e'], rect: ['#7b2ff7', '#e9ff70'] },
      { ground: ['#0d1b3d', '#3ddbff'], rect: ['#c6f24e', '#7b2ff7'] },
    ],
  },
  {
    id: 'dusk',
    name: 'Dusk',
    direction: 'split',
    reverseCascade: true,
    scenes: [
      { ground: ['#131a42', '#5f74c9'], rect: ['#131a42', '#5f74c9'] },
      { ground: ['#131a42', '#5f74c9'], rect: ['#8e2f6d', '#ff85a8'] },
      { ground: ['#3a1f2e', '#ffab4a'], rect: ['#ffd98a', '#8c3a2f'] },
    ],
  },
] as const;

/**
 * The parity rule, as a check rather than a comment.
 *
 * Adjacent ground and rectangle cells always land on opposite parity, so a
 * scene reads as a broken checker the moment `ground.even === rect.odd` or
 * `ground.odd === rect.even`. It is the single easiest thing to get wrong when
 * adding a palette, and the eye reads the result as blobs rather than as a
 * mistake — which is why it is asserted instead of trusted.
 */
export function checkerParityHolds(scene: Scene): boolean {
  return scene.ground[0] !== scene.rect[1] && scene.ground[1] !== scene.rect[0];
}

export const PALETTE_SECONDS = 2.2;

/* Time warp. The measured loop is 34% dead air: right for a GIF you stare at,
   a drag in a scrolling page. Only the still stretches are compressed. */
export const DWELL_SCALE = 0.42;
export const PULSE_RATE = 1.45;

export const FADE_SECONDS = 0.34;

export const PULSE_WINDOWS = [
  [(36.7 - 1) / 30, (65.6 - 1) / 30 + 51 / 30],
  [(158.28 - 1) / 30, (187.26 - 1) / 30 + 50 / 30],
  [(266.4 - 1) / 30, (294.96 - 1) / 30 + 42 / 30],
] as const;

export const PERIOD = 346 / 30;

/* The exit pulse is measurably snappier; flattening the three to one duration
   loses the loop's accelerating feel. */
export const PULSE_DUR = [51 / 30, 50 / 30, 42 / 30] as const;

export const ROW_START_FRAME = [
  [36.7, 40.3, 43.92, 47.46, 51.32, 54.9, 58.38, 62.0, 65.6],
  [158.28, 161.54, 165.4, 169.26, 172.52, 176.3, 179.54, 183.4, 187.26],
  [266.4, 269.92, 273.42, 276.96, 280.88, 284.42, 287.92, 291.42, 294.96],
] as const;

export const EASE_LUT = [
  0, 0.0024, 0.0056, 0.0098, 0.0153, 0.0226, 0.0322, 0.0448, 0.0667, 0.087, 0.124, 0.165, 0.233,
  0.73, 0.819, 0.867, 0.907, 0.93, 0.946, 0.963, 0.974, 0.981, 0.989, 0.994, 0.998, 1,
] as const;
