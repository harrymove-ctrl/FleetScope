/*
 * RealitySplit — parameters.
 *
 * Vendored from the reality-split reference. The file is split into two halves
 * and the rule matters more than any single number:
 *
 *   MEASURED came off a 162-frame reference clip at 25fps, frame by frame. It
 *   is data, not knobs. The eases have fatter tails than any closed form, the
 *   seam gaps are three different sizes because a human made them, and the
 *   drift law was solved from two letters' displacement. The values that look
 *   most arbitrary are exactly the ones that must not move.
 *
 *   TUNABLE is everything an instance may override through the options API.
 *
 * FleetScope uses this as the landing preloader and overrides only TUNABLE
 * fields at the call site — the library is not edited to customise it.
 */

export const WORD: string = 'Animation';

export interface Palette {
  bg: string;
  box: string;
  handle: string;
  ink: string;
}

/*
 * TUNABLE. Four flat colours, because a design tool has no gradients. The
 * handle must be the loudest of the four and clear of both field and box in
 * value as well as hue, or the corners vanish into whichever surface they land
 * on.
 */
export const PALETTES: Record<string, Palette> = {
  volt: { bg: '#ffe500', box: '#1f22c9', handle: '#ff3d00', ink: '#ffffff' },
  reality: { bg: '#4e49fc', box: '#0b5c35', handle: '#e8ff97', ink: '#ffffff' },
  mint: { bg: '#0f3d2e', box: '#7cf0b8', handle: '#ff5c7a', ink: '#0f3d2e' },
  studio: { bg: '#f3f3f5', box: '#1e1e1e', handle: '#0d99ff', ink: '#ffffff' },
  press: { bg: '#d94f2b', box: '#2b1a12', handle: '#f2d8a7', ink: '#fff8ee' },
  terminal: { bg: '#0d0f0c', box: '#14301c', handle: '#5cff8f', ink: '#d8ffe4' },
  klein: { bg: '#f4f4f6', box: '#002fa7', handle: '#ff5c00', ink: '#ffffff' },
  paper: { bg: '#e8e8e6', box: '#111111', handle: '#8a8a8a', ink: '#ffffff' },
  /* FleetScope's own: the carousel plate, its accent, and the action blue. */
  fleetscope: { bg: '#05060a', box: '#12203a', handle: '#5fe3ff', ink: '#f2f5fa' },
};

export const PALETTE: Palette = PALETTES['volt']!;

export const SCATTER_SPREAD = 0.5;

export type BoxShape = 'rect' | 'round' | 'ellipse' | 'squircle';
export type HandleShape = 'circle' | 'square' | 'hollow' | 'diamond' | 'bar';

export const BOX_RADIUS = 0.22;
export const SQUIRCLE_N = 4;

/*
 * Shapes must grow, and the factor is geometry rather than taste. A box fitted
 * to a letter's ink is a rectangle; inscribe an ellipse in it and the corners
 * are cut off, so the glyph pokes out of its own selection object — the one
 * thing a design-tool fantasy cannot do. A point at the ink corner satisfies
 * (x/a)^n + (y/b)^n = 1 only once the shape is scaled by 2^(1/n).
 */
export const SHAPE_INFLATE: Record<BoxShape, number> = {
  rect: 1,
  round: 1,
  ellipse: Math.SQRT2,
  squircle: Math.pow(2, 1 / SQUIRCLE_N),
};

export interface Variant {
  word?: string;
  palette?: string | Palette;
  shape?: BoxShape;
  handle?: HandleShape;
  seed?: number;
}

export const VARIANTS: Variant[] = [
  { word: 'Animation', palette: 'volt', shape: 'rect', handle: 'square' },
  { word: 'Reality', palette: 'mint', shape: 'round', handle: 'circle', seed: 1 },
  { word: 'Selected', palette: 'klein', shape: 'squircle', handle: 'bar', seed: 2 },
  { word: 'Objects', palette: 'terminal', shape: 'ellipse', handle: 'diamond', seed: 3 },
  { word: 'Layers', palette: 'press', shape: 'round', handle: 'hollow', seed: 4 },
  { word: 'Canvas', palette: 'studio', shape: 'rect', handle: 'square', seed: 5 },
];

export const COLLAPSE_DUR = 0.42;
export const EMERGE_DUR = 0.5;
export const FIELD_FADE = 0.55;
export const CYCLE_VARIANTS = true;

/* MEASURED — geometry read off the reference's 700px square. */
export const FONT_SIZE = 178 / 700;
export const WORD_H = 208 / 700;
export const PAD_X = 22 / 700;
export const BASELINE_FRAC = 158 / 208;
export const HANDLE_R = 11.75 / 700;
export const HANDLE_R_GIANT = 30 / 700;

export const REFERENCE_WORD: string = 'Reality';

/* Golden angle: no two letters ever line up, so it never resolves into a ring. */
export const SCATTER_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const SCATTER_INNER = 0.26;
export const SCATTER_OUTER = 0.46;
export const SCATTER_RELAX_PASSES = 60;
export const SCATTER_GAP = 0.03;

/*
 * TUNABLE. How much of the width the assembled word may occupy. Not from the
 * reference — that was a square card holding a seven-letter word, so width was
 * never the binding constraint. On a full-viewport overlay it usually is.
 */
export const FIT_WIDTH = 0.82;

/* Padding recovered from the reference, read off the R. */
export const FIT_PAD_X = 0.16;
export const FIT_PAD_Y = 0.26;

/* MEASURED. Three different gaps because a human made them; hand slop and all. */
export const SEAM_GAPS = [33 / 700, 33 / 700, 29 / 700, 43 / 700, 29 / 700, 29 / 700];

/* MEASURED. Solved from two letters: R at 354px moved 88px, e at 280px moved 57px. */
export const DRIFT_D0 = 1430 / 700;

export const ZOOM = 3.46;
export const TRAIN_FIT = 0.86;
export const TRAIN_NORMALISE = 0.8;
export const ZOOM_FADE_IN = 0.05;
export const ZOOM_FADE_OUT = 0.34;
export const ZOOM_BLUR = 15 / 700;

/*
 * TUNABLE. Below this alpha the defocus is dropped. A canvas filter is by far
 * the most expensive operation in the piece; measured on a full-viewport
 * overlay, blurring the nearly-gone pieces took the worst frame from 92ms to
 * 275ms, and at this opacity the fade has already done the work.
 */
export const BLUR_CUTOFF_ALPHA = 0.35;

export const TRAIN = ['a', 'R', 'e', 't'] as const;
export const ARRIVE = [3.44, 4.12, 4.72];
export const ARRIVE_DUR = [0.28, 0.18, 0.18];
export const DEPART = [3.48, 4.08, 4.68, 5.24];
export const DEPART_DUR = 0.14;

export const TRAIN_ALL = true;
export const TRAIN_ARRIVE_SLOW = 0.2;
export const TRAIN_ARRIVE_FAST = 0.11;

/* A floor, not a remainder. Derived as a remainder it went negative on nine
   letters: every letter began departing before it finished arriving. */
export const TRAIN_DWELL_MIN = 0.09;

export const SPRING_FREQ = 8.5;
export const SPRING_DAMP = 5;
export const SPRING_AMP = 0.02;
export const TRAIN_OVERLAP = 0.35;

/* MEASURED — the reference timeline, in seconds. */
export const LOOP = 6.48;
export const T_SPLIT = 0.36;
export const T_SPREAD_END = 0.6;
export const T_SCATTER = 0.64;
export const T_SCATTER_END = 1.36;
export const T_ZOOM = 1.92;
export const T_ZOOM_END = 3.36;
export const T_POP = 5.52;
export const T_POP_END = 5.88;

export const SELECT_ALL_HOLD = 0.55;
export const SELECT_FADE = 0.45;
export const SELECT_DIM = 0.22;
export const TIGHTEN_IN = 0.11;
export const TIGHTEN_OUT = 0.55;

/*
 * MEASURED eases. No closed form fits: the tails are fatter than any
 * cubic-bezier or sigmoid. The zoom covers 26%->80% of its travel in five
 * frames around k=0.4 and then spends a fifth of the phase on the last 5%; the
 * reassembly pop goes 4.5%, 16%, then eighty-one percent between two frames.
 * Shipped as control points through a monotone spline.
 */
export const SCATTER_E: [number, number][] = [
  [0, 0],
  [0.2, 0.02],
  [0.33, 0.05],
  [0.45, 0.35],
  [0.56, 0.8],
  [0.67, 0.94],
  [0.78, 0.99],
  [1, 1],
];

export const ZOOM_E: [number, number][] = [
  [0, 0],
  [0.06, 0.02],
  [0.17, 0.06],
  [0.28, 0.15],
  [0.33, 0.26],
  [0.39, 0.66],
  [0.44, 0.8],
  [0.5, 0.86],
  [0.56, 0.9],
  [0.67, 0.955],
  [0.78, 0.98],
  [0.89, 0.995],
  [1, 1],
];

export const TRAV_E: [number, number][] = [
  [0, 0],
  [0.2, 0.03],
  [0.35, 0.15],
  [0.5, 0.5],
  [0.65, 0.88],
  [0.8, 0.975],
  [1, 1],
];

export const POP_E: [number, number][] = [
  [0, 0],
  [0.11, 0.01],
  [0.22, 0.045],
  [0.33, 0.16],
  [0.44, 0.81],
  [0.56, 0.92],
  [0.67, 0.964],
  [0.78, 0.986],
  [0.89, 0.997],
  [1, 1],
];
