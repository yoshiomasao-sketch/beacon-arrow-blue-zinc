/**
 * Gallery thumbnail tilt. Visual only, and only while a mouse is on that card.
 * The lightbox tilt is a separate module and is not used here.
 */

/** Press at the thumbnail edge. */
export const THUMB_MAX_DEG = 8;
/** Center band that stays flat, so a resting cursor does not twitch. */
export const THUMB_DEADZONE = 0.08;
/** How much of the remaining gap to close on each frame. High, so the card feels touched. */
export const THUMB_FOLLOW = 0.7;
/** Mouse leave. Inside the 200–250ms range. */
export const THUMB_RETURN_MS = 220;
export const THUMB_RETURN_EASE = "cubic-bezier(0.22, 0.8, 0.3, 1)";

export type ThumbTilt = { x: number; y: number };

export const THUMB_REST: ThumbTilt = { x: 0, y: 0 };

export type ThumbSheen = { x: number; y: number; opacity: number; turn: number };

export const THUMB_SHEEN_REST: ThumbSheen = { x: 0, y: 0, opacity: 0, turn: 0 };

const SHEEN_TRAVEL_X = 16;
const SHEEN_TRAVEL_Y = 12;
const SHEEN_OPACITY = 0.38;

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(-1, value));
}

/** Offset from the center, divided by half the thumbnail size. */
export function thumbUnit(offset: number, half: number): number {
  if (!Number.isFinite(offset) || !Number.isFinite(half) || half <= 0) return 0;
  return clampUnit(offset / half);
}

function press(unit: number): number {
  const abs = Math.abs(unit);
  if (abs <= THUMB_DEADZONE) return 0;
  const past = (abs - THUMB_DEADZONE) / (1 - THUMB_DEADZONE);
  return Math.sign(unit) * past * THUMB_MAX_DEG;
}

/**
 * nx +1 is the right edge, ny +1 is the bottom edge.
 * The side under the cursor is pushed in: right → +rotateY, top → +rotateX.
 */
export function thumbTiltFromPointer(nx: number, ny: number): ThumbTilt {
  return {
    x: press(-clampUnit(ny)),
    y: press(clampUnit(nx)),
  };
}

/** One frame of catch-up. Snaps once the gap is too small to see. */
export function thumbFollow(shown: ThumbTilt, target: ThumbTilt, factor = THUMB_FOLLOW): ThumbTilt {
  const blend = (from: number, to: number) => {
    const safeFrom = Number.isFinite(from) ? from : 0;
    const safeTo = Number.isFinite(to) ? to : 0;
    const next = safeFrom + (safeTo - safeFrom) * factor;
    return Math.abs(safeTo - next) < 0.04 ? safeTo : next;
  };
  return { x: blend(shown.x, target.x), y: blend(shown.y, target.y) };
}

/** Soft highlight that moves with the press. Opacity stays low enough to keep the picture readable. */
export function thumbSheen(tilt: ThumbTilt): ThumbSheen {
  const nx = (Number.isFinite(tilt.y) ? tilt.y : 0) / THUMB_MAX_DEG;
  const ny = (Number.isFinite(tilt.x) ? tilt.x : 0) / THUMB_MAX_DEG;
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return THUMB_SHEEN_REST;
  const mag = Math.min(1, Math.hypot(nx, ny));
  if (mag === 0) return THUMB_SHEEN_REST;
  return {
    x: nx === 0 ? 0 : nx * SHEEN_TRAVEL_X,
    y: ny === 0 ? 0 : -ny * SHEEN_TRAVEL_Y,
    opacity: mag * SHEEN_OPACITY,
    turn: (nx === 0 ? 0 : nx * 10) - (ny === 0 ? 0 : ny * 5),
  };
}

/**
 * A mouse pointer tilts the card. Touch and pen do not.
 * Primary `(hover)` / `(pointer)` are not consulted: Windows Chrome often reports
 * the touchscreen as primary even while a mouse is sending pointer events.
 * Reduced motion stays still.
 */
export function thumbTiltEnabled(pointerType: string, reducedMotion: boolean): boolean {
  return pointerType === "mouse" && !reducedMotion;
}
