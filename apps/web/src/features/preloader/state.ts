/**
 * When the preloader gets out of the way.
 *
 * A preloader that outstays the page is worse than none, so dismissal is a
 * decision with three inputs rather than a fixed timeout: the animation has
 * completed a pass, the page has finished loading, and — regardless of either
 * — a ceiling has been reached. The ceiling is the important one. It is what
 * stops a slow network or a stalled frame loop from holding a visitor in front
 * of a logo.
 */

/** One pass, then out. Long enough to read, short enough not to be a toll. */
export const PRELOADER_SPEED = 2.2;

/** Hard ceiling. Past this the overlay leaves whatever else is true. */
export const PRELOADER_MAX_MS = 3600;

/** Shown once per tab. A preloader on every navigation is an obstacle. */
export const PRELOADER_KEY = 'fleetscope:preloaded';

export interface DismissInput {
  /** Milliseconds since the overlay appeared. */
  elapsedMs: number;
  /** The engine has wrapped at least once. */
  passComplete: boolean;
  /** `document.readyState === 'complete'`. */
  pageReady: boolean;
}

/**
 * Whether the overlay should go now.
 *
 * The ceiling is checked first and on its own: if it has passed, nothing else
 * can keep the overlay up.
 */
export function shouldDismiss(input: DismissInput, maxMs: number = PRELOADER_MAX_MS): boolean {
  if (!Number.isFinite(input.elapsedMs)) return true;
  if (input.elapsedMs >= maxMs) return true;
  return input.passComplete && input.pageReady;
}

/**
 * Whether to show it at all.
 *
 * Skipped outright under reduced motion. A static frame was the alternative,
 * but a still image of a loading animation is just a delay with a picture on
 * it — someone who asked for less motion is better served by the page.
 */
export function shouldShow(alreadyShown: boolean, reducedMotion: boolean): boolean {
  return !alreadyShown && !reducedMotion;
}

/**
 * Whether the clock has wrapped, since the engine's time is t mod loop.
 *
 * Any decrease is not enough. A frame's timestamp can predate the moment the
 * loop was started, which pushes the clock slightly negative on the first
 * tick; read as a wrap, that dismissed the overlay about 200ms in, before the
 * word had finished splitting. A real wrap falls from near the end of the loop
 * to near its start, so it must clear half the loop to count.
 */
export function wrapped(previous: number, current: number, loopLength: number): boolean {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return false;
  if (!Number.isFinite(loopLength) || loopLength <= 0) return false;
  return previous - current > loopLength / 2;
}
