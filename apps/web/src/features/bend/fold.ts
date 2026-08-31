/**
 * The fold, as geometry.
 *
 * canvas-ui folds captured pixels in a shader, which needs html-in-canvas and
 * so needs a browser flag. This is the same fold expressed in CSS: the face is
 * drawn three times, each copy clipped to a band, and the two end bands rotated
 * about the crease between them.
 *
 * The reason that works where folding real elements did not: `clip-path` cuts
 * pixels, not elements, and the transform applies to the clipped result. A
 * paragraph straddling the crease is therefore split down its middle, with each
 * half rotating with its own band — which is what a cube edge looks like and
 * what no per-element hinge can do.
 *
 * Everything below is pure so the geometry can be checked without a browser.
 * The ramps deliberately match the reference engine's `syncScroll`.
 */

export interface FoldOptions {
  /** Height of the folded band at each edge, in CSS pixels. */
  zone: number;
  /** Fold angle in degrees at full fold. 90 is a cube edge. */
  angle: number;
  /** Perspective focal length in CSS pixels. Smaller pinches harder. */
  perspective: number;
  /** 'in' tips the edges toward the viewer, 'out' away. */
  direction: 'in' | 'out';
  /** Scroll distance over which an edge flattens near its scroll end. */
  ease: number;
}

export const FOLD_DEFAULTS: FoldOptions = {
  zone: 240,
  angle: 80,
  perspective: 700,
  direction: 'in',
  ease: 240,
};

/** Hermite ramp, clamped. The reference uses this for both edges. */
export function ramp(value: number, over: number): number {
  const span = Math.max(over, 1);
  const x = Math.min(Math.max(value / span, 0), 1);
  return x * x * (3 - 2 * x);
}

export interface FoldAmounts {
  /** 0 at the top of the scroll, 1 once clear of it. */
  top: number;
  /** 0 at the bottom of the scroll, 1 once clear of it. */
  bottom: number;
}

/**
 * How folded each edge is at a given scroll position.
 *
 * Both edges flatten at their own end of the scroll. That is what makes the
 * face feel like a surface rather than an effect: you never meet a crease at
 * the moment you run out of content behind it.
 */
export function foldAmounts(scrollTop: number, maxScroll: number, ease: number): FoldAmounts {
  if (!Number.isFinite(scrollTop) || !Number.isFinite(maxScroll) || maxScroll <= 1) {
    return { top: 0, bottom: 0 };
  }
  const t = Math.min(Math.max(scrollTop, 0), maxScroll);
  return { top: ramp(t, ease), bottom: ramp(maxScroll - t, ease) };
}

/**
 * The rotation for one band, in degrees.
 *
 * Signs are opposite for the two bands because each turns about the crease on
 * its own inner side. 'in' brings the far edge toward the viewer.
 */
export function bandRotation(
  edge: 'top' | 'bottom',
  amount: number,
  angle: number,
  direction: 'in' | 'out',
): number {
  const magnitude = Math.min(Math.max(angle, 0), 160) * Math.min(Math.max(amount, 0), 1);
  const towardViewer = direction === 'in' ? -1 : 1;
  return edge === 'top' ? magnitude * towardViewer : magnitude * -towardViewer;
}

/**
 * The zone height actually used.
 *
 * Two bands cannot together exceed the face, and a zone taller than half of it
 * would make them overlap and fight for the same pixels.
 */
export function effectiveZone(zone: number, height: number): number {
  if (!Number.isFinite(height) || height <= 0) return 0;
  return Math.min(Math.max(zone, 0), Math.floor(height / 2));
}

/** How far the face has travelled, clamped to the content it has. */
export function faceOffset(scrollY: number, faceTop: number, maxScroll: number): number {
  if (!Number.isFinite(scrollY) || !Number.isFinite(faceTop)) return 0;
  return Math.min(Math.max(scrollY - faceTop, 0), Math.max(maxScroll, 0));
}

/**
 * How resolved a corner block is at a given position in the face.
 *
 * A block arrives from below, passes the bottom crease, and is fully readable
 * once it is clear of it. Reveal is driven from this rather than from an
 * observer per element for two reasons: the face is drawn three times, so an
 * observer would have to keep 24 blocks in step by itself, and the two folded
 * copies are inside a clipped, rotated band where intersection is not what a
 * reader sees anyway.
 *
 * @param top    the block's top, relative to the face's viewport
 * @param height the face's viewport height
 * @param zone   the fold zone, so a block resolves clear of the crease
 * @param run    distance over which it resolves once past the crease
 */
export function cornerReveal(top: number, height: number, zone: number, run = 220): number {
  if (!Number.isFinite(top) || !Number.isFinite(height) || height <= 0) return 1;
  const end = Math.max(0, height - zone - run);
  if (top <= end) return 1;
  if (top >= height) return 0;
  const x = (height - top) / Math.max(height - end, 1);
  return x * x * (3 - 2 * x);
}
