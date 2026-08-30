/**
 * The launchpad carousel engine.
 *
 * # Shape
 *
 * Two passes, as in the reference implementation:
 *
 *   1. the card row is drawn as textured quads into a framebuffer;
 *   2. a fullscreen quad samples that framebuffer through the liquid-glass
 *      lens (`lens.ts`).
 *
 * That ordering is the whole reason the effect reads as glass. A lens applied
 * per-card is a blur on each card; a lens applied to the rendered scene bends
 * whatever is behind it, including the gaps between cards.
 *
 * # Attribution
 *
 * The layout and scroll model — fixed panel height with aspect-derived widths,
 * a lerped scroll target, idle-gated snapping, flick friction, speed-derived
 * shrink, and the entry and focus choreography — are adapted from the
 * `liquid-glass-carousel` engine, MIT licensed, Copyright (c) 2026 Yousuf
 * Soomro, as vendored into NeuroPay at commit
 * 010d0ec187e038e6e57d945f63b57fd21ad373a9. See THIRD-PARTY-NOTICES.md.
 *
 * The original is ~1,250 lines of three.js and GSAP. This is a smaller,
 * dependency-free rewrite against raw WebGL with hand-rolled easing, keeping
 * the tunables and the feel rather than the code.
 */

import { mountLensPass } from './lens';

/** One card in the row. */
export interface CarouselCard {
  readonly id: string;
  readonly src: string;
  /** Width / height. Cards are all the same height and vary in width. */
  readonly aspect: number;
}

/*
 * Tunables, taken from the reference's resolved configuration.
 *
 * `PANEL_H` and `GAP` are the NeuroPay overrides (600/28) rather than upstream
 * (450/12): these cards carry readable interface detail, which needs the size.
 */
export const PANEL_H = 600;
export const GAP = 28;
/** Lerp toward the scroll target. Lower is heavier and glides more. */
export const EASE = 0.09;
export const WHEEL = 1.4;
export const DRAG = 1.6;
/** Flick momentum decay after a drag release. */
export const FRICTION = 0.865;
/**
 * Idle input before snapping engages.
 *
 * The reference notes that distance and velocity gating "triggered
 * inconsistently (fast flicks vs slow scrolls behaved completely differently)";
 * idle time means the same thing at any speed.
 */
export const SNAP_IDLE_MS = 120;
/** Slower than EASE, so the settle reads as a landing rather than a speed-up. */
export const SNAP_EASE = 0.05;
export const SHRINK_MAX = 60;
export const SHRINK_ATTACK = 0.25;
export const SHRINK_DECAY = 0.06;
/** Movement before a press counts as a drag rather than a click. */
export const CLICK_SLOP = 6;
export const TOUCH_CLICK_SLOP = 12;
export const TOUCH_DRAG = 1.0;
export const TOUCH_EASE = 0.22;

/** Focus mode: the chosen card grows, the rest drop away, the lens fades. */
export const FOCUS_CARD_MS = 700;
export const FOCUS_MAIN_MS = 900;
export const FOCUS_STAGGER_MS = 60;
export const FOCUS_DROP = 1.4;
export const FOCUS_SCALE = 1.06;

/** Entry: cards rise from below, then grow, while the lens blooms in. */
export const ENTRY_DELAY_MS = 500;
export const ENTRY_RISE_MS = 1000;
export const ENTRY_STAGGER_MS = 70;
export const ENTRY_FROM_BELOW = 0.9;
export const ENTRY_GROW_DELAY_MS = 250;
export const ENTRY_GROW_MS = 2150;
export const ENTRY_GROW_STAGGER_MS = 85;
export const ENTRY_START_H = 80;

/** Ease-out cubic, standing in for the reference's power3.out. */
export function easeOutCubic(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - c, 3);
}

/** Ease-in-out expo, standing in for expo.inOut on the grow step. */
export function easeInOutExpo(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  if (c === 0) return 0;
  if (c === 1) return 1;
  return c < 0.5 ? Math.pow(2, 20 * c - 10) / 2 : (2 - Math.pow(2, -20 * c + 10)) / 2;
}

/** Width of one card at a given height. */
export function cardWidth(aspect: number, height: number): number {
  return height * aspect;
}

/**
 * Left offset of each card, and the row's total width.
 *
 * Pure so the hit-testing, the snap targets and the renderer all agree about
 * where a card is without each deriving it separately.
 */
export function layoutRow(
  cards: readonly CarouselCard[],
  height: number,
  gap: number,
): { readonly offsets: readonly number[]; readonly total: number } {
  const offsets: number[] = [];
  let x = 0;
  for (const card of cards) {
    offsets.push(x);
    x += cardWidth(card.aspect, height) + gap;
  }
  return { offsets, total: Math.max(0, x - gap) };
}

/** Scroll position that centres a given card. */
export function centerOffset(
  cards: readonly CarouselCard[],
  index: number,
  height: number,
  gap: number,
): number {
  const { offsets } = layoutRow(cards, height, gap);
  const start = offsets[index] ?? 0;
  const card = cards[index];
  const width = card === undefined ? 0 : cardWidth(card.aspect, height);
  return start + width / 2;
}

/** Which card is nearest a scroll position. */
export function nearestIndex(
  cards: readonly CarouselCard[],
  scroll: number,
  height: number,
  gap: number,
): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < cards.length; index += 1) {
    const distance = Math.abs(centerOffset(cards, index, height, gap) - scroll);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

/**
 * Speed-derived shrink, capped at 25%.
 *
 * Clamped at both ends: unclamped, a fast flick collapses the row on a quick
 * machine and does nothing on a slow one.
 */
export function speedShrink(speed: number): number {
  const magnitude = Math.min(Math.abs(speed) / SHRINK_MAX, 1);
  return 1 - 0.25 * magnitude;
}

export interface CarouselHandle {
  readonly closeFocus: () => void;
  readonly focusAt: (index: number) => void;
  readonly step: (delta: number) => void;
  readonly dispose: () => void;
}

export interface CarouselOptions {
  readonly cards: readonly CarouselCard[];
  readonly onActiveChange: (index: number) => void;
  readonly onFocusChange: (focused: boolean) => void;
  readonly onEntryDone: () => void;
  readonly onFallback: (reason: string) => void;
  readonly reducedMotion: boolean;
}

/**
 * Mount the carousel onto a canvas.
 *
 * Returns `null` when it cannot run, having already reported why. A null return
 * is an ordinary outcome: the caller's semantic card list is a complete design
 * on its own.
 */
export function mountCarousel(
  canvas: HTMLCanvasElement,
  options: CarouselOptions,
): CarouselHandle | null {
  const pass = mountLensPass(canvas, {
    cards: options.cards,
    onFallback: options.onFallback,
  });
  if (pass === null) return null;

  const cards = options.cards;
  let disposed = false;
  let frame = 0;

  // Scroll model: `target` is what input moves, `scroll` lerps after it.
  let scroll = 0;
  let target = 0;
  let velocity = 0;
  let lastInputAt = 0;
  let snapping = false;
  let active = 0;
  let shrink = 1;
  let lastScroll = 0;

  // Entry and focus are time-based, and are the only clocks in the engine.
  const startedAt = performance.now();
  let entryDone = options.reducedMotion;
  let focusIndex = -1;
  let focusAt = 0;
  let closing = false;

  const height = (): number => {
    // The row scales with the viewport so a card is never taller than it.
    const available = canvas.clientHeight * 0.74;
    return Math.max(160, Math.min(PANEL_H, available));
  };

  const setActive = (index: number): void => {
    if (index === active) return;
    active = index;
    options.onActiveChange(index);
  };

  const now = (): number => performance.now();

  const tick = (): void => {
    if (disposed) return;
    frame = window.requestAnimationFrame(tick);

    // A hidden document gets no frames anyway; this also stops the engine
    // spending a phone battery in a background tab.
    if (document.visibilityState !== 'visible') return;

    const t = now();
    const h = height();
    const { total } = layoutRow(cards, h, GAP);

    if (!entryDone && t - startedAt > ENTRY_DELAY_MS + ENTRY_GROW_DELAY_MS + ENTRY_GROW_MS) {
      entryDone = true;
      options.onEntryDone();
    }

    if (focusIndex < 0) {
      // Flick momentum, then the idle-gated snap.
      if (Math.abs(velocity) > 0.1) {
        target += velocity;
        velocity *= FRICTION;
      }
      target = Math.min(Math.max(target, 0), total);

      if (!options.reducedMotion && t - lastInputAt > SNAP_IDLE_MS && Math.abs(velocity) < 0.5) {
        snapping = true;
      }
      const wanted = snapping
        ? centerOffset(cards, nearestIndex(cards, target, h, GAP), h, GAP)
        : target;
      scroll += (wanted - scroll) * (snapping ? SNAP_EASE : EASE);
    } else {
      scroll += (centerOffset(cards, focusIndex, h, GAP) - scroll) * SNAP_EASE * 2.4;
    }

    // Speed-derived shrink, attacking faster than it decays so the row tightens
    // immediately and relaxes gently.
    const speed = Math.abs(scroll - lastScroll);
    lastScroll = scroll;
    const wantedShrink = options.reducedMotion ? 1 : speedShrink(speed);
    shrink += (wantedShrink - shrink) * (wantedShrink < shrink ? SHRINK_ATTACK : SHRINK_DECAY);

    setActive(nearestIndex(cards, scroll, h, GAP));

    pass.render({
      scroll,
      height: h,
      gap: GAP,
      shrink,
      entry: options.reducedMotion
        ? 1
        : easeOutCubic((t - startedAt - ENTRY_DELAY_MS) / ENTRY_RISE_MS),
      grow: options.reducedMotion
        ? 1
        : easeInOutExpo((t - startedAt - ENTRY_DELAY_MS - ENTRY_GROW_DELAY_MS) / ENTRY_GROW_MS),
      entryStaggerMs: ENTRY_STAGGER_MS,
      growStaggerMs: ENTRY_GROW_STAGGER_MS,
      elapsed: t - startedAt,
      focusIndex,
      focusProgress:
        focusIndex < 0 && !closing
          ? 0
          : easeOutCubic((t - focusAt) / (closing ? FOCUS_CARD_MS : FOCUS_MAIN_MS)),
      closing,
    });

    if (closing && t - focusAt > FOCUS_CARD_MS) {
      closing = false;
      snapping = true;
    }
  };

  /* ── Input ─────────────────────────────────────────────────────────────── */

  const onWheel = (event: WheelEvent): void => {
    if (focusIndex >= 0) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;

    /*
     * Hand the gesture back at the ends.
     *
     * The reference is a single screen with nothing after it, so it can consume
     * every wheel event. This page has the card list below, and a carousel that
     * swallows all vertical scrolling is a trap: the reader pushes down, the
     * row does not move because it is already at the end, and the page appears
     * frozen. So when the row is clamped and the gesture pushes further in the
     * same direction, we do not preventDefault and the page scrolls on.
     */
    const { total } = layoutRow(cards, height(), GAP);
    const atStart = target <= 0.5 && delta < 0;
    const atEnd = target >= total - 0.5 && delta > 0;
    if (atStart || atEnd) return;

    event.preventDefault();
    target += delta * WHEEL;
    velocity = 0;
    snapping = false;
    lastInputAt = now();
  };

  let pointerId: number | null = null;
  let pressX = 0;
  let lastX = 0;
  let lastMoveAt = 0;
  let dragged = false;
  let pointerKind = 'mouse';

  const onPointerDown = (event: PointerEvent): void => {
    if (focusIndex >= 0) return;
    pointerId = event.pointerId;
    pointerKind = event.pointerType;
    pressX = event.clientX;
    lastX = event.clientX;
    lastMoveAt = now();
    dragged = false;
    velocity = 0;
    snapping = false;
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    const dx = event.clientX - lastX;
    lastX = event.clientX;
    lastMoveAt = now();
    lastInputAt = lastMoveAt;
    const slop = pointerKind === 'touch' ? TOUCH_CLICK_SLOP : CLICK_SLOP;
    if (Math.abs(event.clientX - pressX) > slop) dragged = true;
    // Touch runs 1:1 and follows harder — a finger expects the row to stick
    // to it, where the wheel wants weight.
    const sensitivity = pointerKind === 'touch' ? TOUCH_DRAG : DRAG;
    target -= dx * sensitivity;
    if (pointerKind === 'touch') scroll += (target - scroll) * TOUCH_EASE;
    velocity = -dx * sensitivity * 0.5;
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    lastInputAt = now();
    // A pointer that sat still before release is a press, not a flick.
    if (now() - lastMoveAt > 90) velocity = 0;
    if (!dragged) {
      const index = nearestIndex(cards, target, height(), GAP);
      openFocus(index);
    }
  };

  const openFocus = (index: number): void => {
    if (focusIndex >= 0) return;
    focusIndex = index;
    focusAt = now();
    closing = false;
    options.onFocusChange(true);
  };

  const closeFocus = (): void => {
    if (focusIndex < 0) return;
    focusIndex = -1;
    closing = true;
    focusAt = now();
    options.onFocusChange(false);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      closeFocus();
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (focusIndex < 0) {
        event.preventDefault();
        openFocus(active);
      }
    }
  };

  const step = (delta: number): void => {
    if (focusIndex >= 0) return;
    const next = Math.min(Math.max(active + delta, 0), cards.length - 1);
    target = centerOffset(cards, next, height(), GAP);
    velocity = 0;
    snapping = true;
    lastInputAt = 0;
  };

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('keydown', onKeyDown);

  target = centerOffset(cards, 0, height(), GAP);
  scroll = target;
  frame = window.requestAnimationFrame(tick);

  return {
    closeFocus,
    focusAt: openFocus,
    step,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(frame);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      pass.dispose();
    },
  };
}
