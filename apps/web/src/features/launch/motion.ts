/**
 * Shared render helpers.
 *
 * What is left here after the launchpad became a carousel: the pixel-ratio cap,
 * which both passes of the renderer need and neither should decide for itself.
 * The scroll-reveal and scroll-scrub helpers that used to live here went with
 * the scrolling page they served, rather than staying as tested dead code.
 */

/**
 * Cap the canvas pixel ratio.
 *
 * Above 2 costs fill rate and returns nothing a reader can see. The `degraded`
 * flag drops to 1 for a renderer that has already missed its budget once.
 */
export function cappedPixelRatio(devicePixelRatio: number, degraded = false): number {
  const ceiling = degraded ? 1 : 2;
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1;
  return Math.min(devicePixelRatio, ceiling);
}
