/**
 * The Bend fold.
 *
 * The page scrolls on the face of a cube: content entering at the bottom folds
 * up over a virtual edge into the flat middle, and content leaving at the top
 * folds away over the opposite edge. Both flatten out at the scroll ends, so
 * the first and last screens are never bent.
 *
 * # Why this is CSS 3D and not the reference's shader
 *
 * The reference implementation captures the live DOM into a canvas with
 * `CanvasRenderingContext2D.drawElementImage` and folds it in a WebGL2
 * fragment shader. That API is html-in-canvas, and it is experimental: checked
 * in Chrome 151, both `drawElementImage` and `canvas.requestPaint` are
 * `undefined`. Without them the reference's own guard sets `uCover` to 0 and
 * the output canvas draws nothing over the plain DOM — the effect is invisible
 * for everyone not running the flag.
 *
 * Folding the real elements gets the same read today, and avoids the part of
 * that design that exists only to undo capturing: it needs no hover rewriting,
 * no click forwarding, no caret remapping for text selection. The text stays
 * selectable and the links stay clickable because they were never replaced by
 * a picture of themselves.
 *
 * What it gives up is the rounded crease. A shader can bend a surface along a
 * circular arc; CSS rotates a flat plane about an edge. At the angles this page
 * uses the difference is not visible, and a hard crease is the cube edge the
 * effect is named for anyway.
 */

/** Options, named as in the reference so the two can be compared. */
export interface BendOptions {
  /** Height of the folded region at each edge, in CSS pixels. */
  readonly zone: number;
  /** Maximum fold angle in degrees. 90 is a cube edge. */
  readonly angle: number;
  /** Perspective focal length in CSS pixels. Smaller pinches the fold harder. */
  readonly perspective: number;
  /** `out` folds away from the viewer; `in` tilts toward them. */
  readonly direction: 'out' | 'in';
  /** Scroll distance over which an edge flattens near its scroll end. */
  readonly ease: number;
  /** Seconds the bend takes to settle. 0 snaps. */
  readonly smoothing: number;
  readonly top: boolean;
  readonly bottom: boolean;
}

export const BEND_DEFAULTS: BendOptions = {
  zone: 240,
  angle: 80,
  perspective: 700,
  direction: 'in',
  ease: 240,
  smoothing: 0.1,
  top: true,
  bottom: true,
};

/** Hermite smoothstep on the unit interval. */
export function smoothstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * How much each edge is folded, given the scroll position.
 *
 * Both ends flatten: at the very top there is nothing above to fold away, and
 * at the very bottom nothing below to fold up. `ease` is the distance over
 * which that flattening happens.
 */
export function foldAmounts(
  scrollTop: number,
  maxScroll: number,
  options: Pick<BendOptions, 'ease' | 'top' | 'bottom'>,
): { readonly top: number; readonly bottom: number } {
  if (!Number.isFinite(maxScroll) || maxScroll <= 1) return { top: 0, bottom: 0 };
  const ease = Math.max(options.ease, 1);
  const clamped = Math.min(Math.max(scrollTop, 0), maxScroll);
  return {
    top: options.top ? smoothstep(clamped / ease) : 0,
    bottom: options.bottom ? smoothstep((maxScroll - clamped) / ease) : 0,
  };
}

/**
 * Exponential settle toward a target, frame-rate independent.
 *
 * `1 - e^(-dt/tau)` rather than a fixed per-frame fraction, so the motion is
 * the same on a 60Hz and a 120Hz display. A tau of 0 snaps.
 */
export function settle(current: number, target: number, deltaSeconds: number, tau: number): number {
  if (tau <= 0) return target;
  const k = 1 - Math.exp(-deltaSeconds / Math.max(tau, 1e-4));
  const next = current + (target - current) * k;
  // Snap when the remaining distance stops being visible, so the loop can stop
  // rather than approaching forever.
  return Math.abs(target - next) < 0.001 ? target : next;
}

/**
 * How one element folds, given where it sits in the viewport.
 *
 * # Why each row hinges about its own edge
 *
 * A cube fold is one rigid plane hinging about one line, and the obvious way
 * to reproduce that is to rotate every row in a zone about the same viewport
 * crease. That was tried and is wrong for DOM: a row only partly overlapping
 * the zone still rotates as a whole about a line outside itself, which
 * collapses it and drags rows above the fold back into view. The canvas
 * implementation never meets this, because it folds a viewport-sized surface
 * of pixels and can bend the part inside the zone while leaving the rest flat.
 * An element is atomic; it cannot be half-folded.
 *
 * So each row hinges about its own near edge by an angle that ramps with how
 * deep into the zone it has travelled. Adjacent rows differ slightly, which
 * reads as a faceted fold rather than a perfectly smooth one — the honest
 * limit of folding real elements instead of a captured image of them.
 *
 * Returns `null` for a row in the flat middle or off screen, which should
 * carry no transform rather than an identity one.
 */
export interface FoldPlan {
  /** `transform-origin` Y, in pixels from the element's own top edge. */
  readonly originY: number;
  readonly degrees: number;
}

export function foldPlan(
  elementTop: number,
  elementHeight: number,
  viewportHeight: number,
  amounts: { readonly top: number; readonly bottom: number },
  options: Pick<BendOptions, 'zone' | 'angle' | 'direction'>,
): FoldPlan | null {
  // Off screen: a rotation about an edge outside the viewport projects the row
  // back into view, so these are left alone entirely.
  if (elementTop + elementHeight <= 0 || elementTop >= viewportHeight) return null;

  const band = Math.min(Math.max(options.zone, 8), viewportHeight / 2);
  const centre = elementTop + elementHeight / 2;
  const sign = options.direction === 'in' ? -1 : 1;

  if (centre < band && amounts.top > 0) {
    const depth = smoothstep(1 - centre / band);
    // Hinges about its own bottom edge, folding away over the top.
    return { originY: elementHeight, degrees: -sign * options.angle * amounts.top * depth };
  }
  if (centre > viewportHeight - band && amounts.bottom > 0) {
    const depth = smoothstep((centre - (viewportHeight - band)) / band);
    // Hinges about its own top edge, folding up from below.
    return { originY: 0, degrees: sign * options.angle * amounts.bottom * depth };
  }
  return null;
}
