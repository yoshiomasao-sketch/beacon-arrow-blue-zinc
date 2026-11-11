/**
 * Lightbox card tilt. Visual only: rotateX / rotateY on a wrapper inside the pan transform.
 * Pan, zoom, and marker hit testing stay on the unrotated box.
 */

/** Each axis stays inside this so the picture stays readable. */
export const TILT_MAX_DEG = 5;
/** Drag distance that reaches the max angle. Shorter drags scale linearly. */
export const TILT_RANGE_PX = 80;
/** Release. Ease-out, no overshoot, short enough to stay out of the next gesture. */
export const TILT_RETURN_MS = 240;

export type Tilt = { x: number; y: number };

export const TILT_REST: Tilt = { x: 0, y: 0 };

function clampTilt(angle: number, max = TILT_MAX_DEG): number {
  if (!Number.isFinite(angle)) return 0;
  return Math.min(max, Math.max(-max, angle));
}

/**
 * Drag right → positive rotateY (right edge recedes).
 * Drag down → negative rotateX (top edge comes forward).
 * `base` is the angle already on screen, so a new drag during the return continues from there.
 * A base inside ±5° can never leave that range. A base left over from a recoil stays put until
 * the pointer moves back inward, then it rejoins the ±5° rail without jumping.
 */
export function tiltFromDrag(dx: number, dy: number, base: Tilt = TILT_REST): Tilt {
  const x = applyDragAxis(base.x, (-(Number.isFinite(dy) ? dy : 0) / TILT_RANGE_PX) * TILT_MAX_DEG);
  const y = applyDragAxis(base.y, ((Number.isFinite(dx) ? dx : 0) / TILT_RANGE_PX) * TILT_MAX_DEG);
  return { x, y };
}

function applyDragAxis(base: number, delta: number): number {
  const safeBase = Number.isFinite(base) ? base : 0;
  const next = safeBase + (Number.isFinite(delta) ? delta : 0);
  if (Math.abs(safeBase) <= TILT_MAX_DEG) return clampTilt(next);
  const outward = Math.sign(safeBase);
  if (outward > 0) return Math.min(safeBase, Math.max(-TILT_MAX_DEG, next));
  if (outward < 0) return Math.max(safeBase, Math.min(TILT_MAX_DEG, next));
  return clampTilt(next);
}

/**
 * Recover rotateX/rotateY degrees from the matrix Chrome builds for
 * `rotateX(x) rotateY(y)`. Signs follow that CSS order, not a textbook Rx*Ry.
 * The cap is the recoil max so a grab during the throw keeps the on-screen angle.
 */
export function tiltFromMatrix(m11: number, m22: number, m23: number, m31: number): Tilt {
  if (![m11, m22, m23, m31].every(Number.isFinite)) return TILT_REST;
  const y = (Math.atan2(m31, m11) * 180) / Math.PI;
  const x = (Math.atan2(m23, m22) * 180) / Math.PI;
  return { x: clampTilt(x, RECOIL_MAX_DEG), y: clampTilt(y, RECOIL_MAX_DEG) };
}

/**
 * Specular slide on the PC card face. Driven by the same tilt angles.
 * ±5° maps to a short glide so the picture stays visible.
 */
export const SHEEN_TRAVEL_X = 18;
export const SHEEN_TRAVEL_Y = 14;
export const SHEEN_OPACITY = 0.55;

export type Sheen = { x: number; y: number; opacity: number; turn: number };

export const SHEEN_REST: Sheen = { x: 0, y: 0, opacity: 0, turn: 0 };

/** Right lean (positive rotateY) slides the highlight right. Down lean slides it down. */
export function sheenFromTilt(tilt: Tilt): Sheen {
  const nx = clampTilt(tilt.y, RECOIL_MAX_DEG) / TILT_MAX_DEG;
  const ny = clampTilt(tilt.x, RECOIL_MAX_DEG) / TILT_MAX_DEG;
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return SHEEN_REST;
  const mag = Math.min(1, Math.hypot(nx, ny));
  return {
    x: nx === 0 ? 0 : nx * SHEEN_TRAVEL_X,
    y: ny === 0 ? 0 : -ny * SHEEN_TRAVEL_Y,
    opacity: mag * SHEEN_OPACITY,
    turn: (nx === 0 ? 0 : nx * 12) - (ny === 0 ? 0 : ny * 6),
  };
}

/**
 * Release recoil. Tune these without touching the drag path.
 * Speed is pointer px per ms over the recent window, not a single frame.
 */
export const RECOIL_WINDOW_MS = 80;
export const RECOIL_SPEED_MIN = 0.45;
export const RECOIL_SPEED_FULL = 1.8;
export const RECOIL_SPEED_CAP = 4;
export const RECOIL_EXTRA_MAX = 5;
export const RECOIL_MAX_DEG = 10;
export const RECOIL_BACK_RATIO = 0.34;
export const RECOIL_MS = 400;
export const RECOIL_PEAK_AT = 0.3;
export const RECOIL_BACK_AT = 0.62;

export type TiltSample = { t: number; x: number; y: number };
export type TiltVelocity = { vx: number; vy: number };
export type RecoilFrame = { at: number; tilt: Tilt };

function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 0;
  return Math.min(RECOIL_SPEED_CAP, Math.max(-RECOIL_SPEED_CAP, speed));
}

/** Net pointer speed across the recent window. Older motion and single spikes are ignored. */
export function tiltVelocity(samples: readonly TiltSample[], now: number): TiltVelocity {
  if (!Number.isFinite(now)) return { vx: 0, vy: 0 };
  let first: TiltSample | null = null;
  let last: TiltSample | null = null;
  for (const sample of samples) {
    if (!sample || ![sample.t, sample.x, sample.y].every(Number.isFinite)) continue;
    const age = now - sample.t;
    if (age < 0 || age > RECOIL_WINDOW_MS) continue;
    if (!first || sample.t < first.t) first = sample;
    if (!last || sample.t >= last.t) last = sample;
  }
  if (!first || !last) return { vx: 0, vy: 0 };
  const dt = last.t - first.t;
  if (dt < 8) return { vx: 0, vy: 0 };
  return {
    vx: clampSpeed((last.x - first.x) / dt),
    vy: clampSpeed((last.y - first.y) / dt),
  };
}

function axisImpulse(speed: number): number {
  if (!Number.isFinite(speed)) return 0;
  const mag = Math.abs(speed);
  if (mag < RECOIL_SPEED_MIN) return 0;
  const t = Math.min(1, (mag - RECOIL_SPEED_MIN) / (RECOIL_SPEED_FULL - RECOIL_SPEED_MIN));
  return Math.sign(speed) * RECOIL_EXTRA_MAX * t;
}

/**
 * Rightward speed → positive rotateY. Downward speed → negative rotateX.
 * Null when neither axis is fast enough: the caller keeps the 240ms return.
 * Peak, one opposite swing, then rest. No repeated bounce.
 */
export function recoilKeyframes(start: Tilt, vx: number, vy: number): RecoilFrame[] | null {
  const impulseX = axisImpulse(-vy);
  const impulseY = axisImpulse(vx);
  if (impulseX === 0 && impulseY === 0) return null;
  const safe = {
    x: clampTilt(start.x, RECOIL_MAX_DEG),
    y: clampTilt(start.y, RECOIL_MAX_DEG),
  };
  const peak = {
    x: impulseX === 0 ? safe.x * (1 - RECOIL_PEAK_AT) : clampTilt(safe.x + impulseX, RECOIL_MAX_DEG),
    y: impulseY === 0 ? safe.y * (1 - RECOIL_PEAK_AT) : clampTilt(safe.y + impulseY, RECOIL_MAX_DEG),
  };
  const back = {
    x: impulseX === 0 ? safe.x * (1 - RECOIL_BACK_AT) : clampTilt(-Math.sign(impulseX) * Math.abs(impulseX) * RECOIL_BACK_RATIO, RECOIL_MAX_DEG),
    y: impulseY === 0 ? safe.y * (1 - RECOIL_BACK_AT) : clampTilt(-Math.sign(impulseY) * Math.abs(impulseY) * RECOIL_BACK_RATIO, RECOIL_MAX_DEG),
  };
  return [
    { at: 0, tilt: safe },
    { at: RECOIL_PEAK_AT, tilt: peak },
    { at: RECOIL_BACK_AT, tilt: back },
    { at: 1, tilt: TILT_REST },
  ];
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Sample the throw. `t` is 0–1 across RECOIL_MS. */
export function tiltAtRecoil(frames: readonly RecoilFrame[], t: number): Tilt {
  if (frames.length === 0) return TILT_REST;
  const p = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  if (p <= frames[0].at) return frames[0].tilt;
  let index = 0;
  while (index < frames.length - 2 && frames[index + 1].at < p) index += 1;
  const from = frames[index];
  const to = frames[Math.min(index + 1, frames.length - 1)];
  const span = to.at - from.at || 1;
  const local = (p - from.at) / span;
  const eased = index === 0 ? easeOutCubic(local) : easeInOut(local);
  return {
    x: from.tilt.x + (to.tilt.x - from.tilt.x) * eased,
    y: from.tilt.y + (to.tilt.y - from.tilt.y) * eased,
  };
}
