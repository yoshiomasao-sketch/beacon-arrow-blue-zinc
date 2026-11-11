/**
 * Phone lightbox wobble from a shake.
 * Separate from device tilt and from the puru markers.
 * These constants are the tuning knobs.
 */

/** Change in acceleration, m/s², that counts as a shake rather than a tilt. */
export const SHAKE_THRESHOLD = 14;
/** Extra m/s² above the threshold that reaches the full wobble. */
export const SHAKE_SPAN = 22;
/** Ignore another hit from the same jolt for this long. */
export const SHAKE_MIN_INTERVAL_MS = 90;
/** A gap this long is a pause, not a shake. */
export const SHAKE_STALE_MS = 180;
export const SHAKE_MAX_PX = 14;
export const SHAKE_MAX_DEG = 3.5;
/** Per 16ms. About 0.2s back to rest. */
export const SHAKE_DECAY = 0.86;
const SHAKE_REST_PX = 0.35;
const SHAKE_REST_DEG = 0.2;

export type Accel = { x: number; y: number; z: number };
export type ShakePose = { x: number; y: number; r: number };
export type ShakeSample = { prev: Accel | null; gravity: boolean; lastAt: number };

export const SHAKE_REST: ShakePose = { x: 0, y: 0, r: 0 };
export const SHAKE_SAMPLE: ShakeSample = { prev: null, gravity: false, lastAt: 0 };

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(-max, value));
}

export function finiteAccel(value: { x: number | null; y: number | null; z: number | null } | null | undefined): Accel | null {
  if (!value || value.x == null || value.y == null || value.z == null) return null;
  if (![value.x, value.y, value.z].every(Number.isFinite)) return null;
  return { x: value.x, y: value.y, z: value.z };
}

/** Prefer acceleration without gravity. Fall back to the gravity-included vector. */
export function readAccel(
  acceleration: { x: number | null; y: number | null; z: number | null } | null | undefined,
  includingGravity: { x: number | null; y: number | null; z: number | null } | null | undefined,
): { accel: Accel; gravity: boolean } | null {
  const linear = finiteAccel(acceleration);
  if (linear) return { accel: linear, gravity: false };
  const withGravity = finiteAccel(includingGravity);
  if (withGravity) return { accel: withGravity, gravity: true };
  return null;
}

/**
 * Delta from the previous sample. A still phone and a slow tilt stay under the threshold.
 * The first sample, a source change, or a long gap only resets the baseline.
 */
export function considerShake(state: ShakeSample, sample: { accel: Accel; gravity: boolean }, now: number): { delta: number; next: ShakeSample } {
  const next = { prev: sample.accel, gravity: sample.gravity, lastAt: now };
  if (!state.prev || state.gravity !== sample.gravity) return { delta: 0, next };
  const dt = now - state.lastAt;
  if (!Number.isFinite(dt) || dt <= 0 || dt > SHAKE_STALE_MS) return { delta: 0, next };
  const delta = Math.hypot(sample.accel.x - state.prev.x, sample.accel.y - state.prev.y, sample.accel.z - state.prev.z);
  return { delta, next };
}

/** 0 under the threshold, 1 at a hard shake. */
export function shakePower(delta: number): number {
  if (!Number.isFinite(delta) || delta < SHAKE_THRESHOLD) return 0;
  return Math.min(1, (delta - SHAKE_THRESHOLD) / SHAKE_SPAN);
}

/** Side-to-side, a smaller vertical kick, and a light twist. Capped. */
export function impulseFromPower(power: number, flip: boolean): ShakePose {
  if (!Number.isFinite(power) || power <= 0) return SHAKE_REST;
  const amount = Math.min(1, power);
  const sign = flip ? -1 : 1;
  return {
    x: clamp(sign * SHAKE_MAX_PX * amount, SHAKE_MAX_PX),
    y: clamp(-sign * SHAKE_MAX_PX * 0.55 * amount, SHAKE_MAX_PX),
    r: clamp(-sign * SHAKE_MAX_DEG * amount, SHAKE_MAX_DEG),
  };
}

export function decayShake(pose: ShakePose, dtMs: number): ShakePose {
  const steps = Math.max(0, dtMs) / 16;
  const factor = SHAKE_DECAY ** steps;
  const next = { x: pose.x * factor, y: pose.y * factor, r: pose.r * factor };
  if (Math.hypot(next.x, next.y) < SHAKE_REST_PX && Math.abs(next.r) < SHAKE_REST_DEG) return SHAKE_REST;
  return next;
}

export function motionSupport(scope: { isSecureContext?: boolean; DeviceMotionEvent?: unknown } | null | undefined): "ok" | "insecure" | "missing" {
  if (!scope || typeof scope.DeviceMotionEvent === "undefined") return "missing";
  if (scope.isSecureContext === false) return "insecure";
  return "ok";
}

export async function requestMotionPermission(ctor: { requestPermission?: () => Promise<string> } | null | undefined): Promise<"granted" | "denied"> {
  if (!ctor || typeof ctor.requestPermission !== "function") return "granted";
  try {
    const result = await ctor.requestPermission();
    return result === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/** A finger on the picture owns it. Shake paint waits. */
export function shakePaintAllowed(mode: string, classes: { tilting: boolean; settling: boolean; recoiling: boolean }): boolean {
  if (classes.tilting || classes.settling || classes.recoiling) return false;
  return mode !== "pending" && mode !== "pan" && mode !== "pinch" && mode !== "swipe";
}
