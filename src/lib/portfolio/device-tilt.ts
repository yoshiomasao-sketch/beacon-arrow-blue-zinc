/**
 * Phone lightbox tilt from the device orientation sensor.
 * Separate from the PC drag tilt. These constants are the tuning knobs.
 */

/** Image tilt cap on each axis. About 22° of device tilt reaches this. */
export const SENSOR_MAX_DEG = 10;
/** Device degrees away from the baseline that reach the full image tilt. */
export const SENSOR_RANGE_DEG = 22;
/** Device motion smaller than this is treated as still. */
export const SENSOR_DEADZONE_DEG = 1.2;
/** How much of the remaining gap to close on each accepted sample. */
export const SENSOR_SMOOTH = 0.42;
/** Drop sensor events that arrive faster than this. */
export const SENSOR_MIN_INTERVAL_MS = 32;

export type Pose = { beta: number; gamma: number };
export type SensorTilt = { x: number; y: number };

export const SENSOR_REST: SensorTilt = { x: 0, y: 0 };

export function wrap180(delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  const wrapped = ((((delta + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(-max, value));
}

function axisFromDevice(delta: number): number {
  const wrapped = wrap180(delta);
  const abs = Math.abs(wrapped);
  if (abs <= SENSOR_DEADZONE_DEG) return 0;
  const past = abs - SENSOR_DEADZONE_DEG;
  const span = Math.max(1, SENSOR_RANGE_DEG - SENSOR_DEADZONE_DEG);
  return clamp((Math.sign(wrapped) * past * SENSOR_MAX_DEG) / span, SENSOR_MAX_DEG);
}

/**
 * The picture turns against the phone so it keeps facing the viewer.
 * Rightward roll (positive gamma) → negative rotateY.
 * Positive pitch (positive beta) → positive rotateX.
 * Left/right stays as it is. Up/down is the opposite of the previous mapping.
 * Both are relative to the pose captured when the feature started.
 */
export function tiltFromPose(pose: Pose, baseline: Pose): SensorTilt {
  const x = axisFromDevice(pose.beta - baseline.beta) || 0;
  const y = -axisFromDevice(pose.gamma - baseline.gamma) || 0;
  return { x, y };
}

function deviceFromAxis(axis: number): number {
  if (!Number.isFinite(axis) || Math.abs(axis) < 0.04) return 0;
  const span = Math.max(1, SENSOR_RANGE_DEG - SENSOR_DEADZONE_DEG);
  const mag = Math.min(SENSOR_MAX_DEG, Math.abs(axis));
  return Math.sign(axis) * ((mag * span) / SENSOR_MAX_DEG + SENSOR_DEADZONE_DEG);
}

/** Pose that keeps the picture at `shown` while the phone is at `pose`. */
export function baselineForShown(pose: Pose, shown: SensorTilt): Pose {
  return {
    beta: pose.beta - deviceFromAxis(shown.x),
    gamma: pose.gamma - deviceFromAxis(-shown.y),
  };
}

export function poseFromReading(beta: number | null, gamma: number | null): Pose | null {
  if (beta == null || gamma == null) return null;
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  return { beta, gamma };
}

export function smoothTilt(current: SensorTilt, target: SensorTilt, factor = SENSOR_SMOOTH): SensorTilt {
  const mix = Number.isFinite(factor) ? Math.min(1, Math.max(0, factor)) : SENSOR_SMOOTH;
  const next = {
    x: current.x + (target.x - current.x) * mix,
    y: current.y + (target.y - current.y) * mix,
  };
  if (Math.abs(next.x - target.x) < 0.04) next.x = target.x;
  if (Math.abs(next.y - target.y) < 0.04) next.y = target.y;
  if (target.x === 0 && Math.abs(next.x) < 0.04) next.x = 0;
  if (target.y === 0 && Math.abs(next.y) < 0.04) next.y = 0;
  return next;
}

export function sensorSupport(scope: { isSecureContext?: boolean; DeviceOrientationEvent?: unknown } | null | undefined): "ok" | "insecure" | "missing" {
  if (!scope || typeof scope.DeviceOrientationEvent === "undefined") return "missing";
  if (scope.isSecureContext === false) return "insecure";
  return "ok";
}

export async function requestSensorPermission(ctor: { requestPermission?: () => Promise<string> } | null | undefined): Promise<"granted" | "denied"> {
  if (!ctor || typeof ctor.requestPermission !== "function") return "granted";
  try {
    const result = await ctor.requestPermission();
    return result === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/** Direct touch gestures own the picture. Sensor writes wait until they finish. */
export function sensorWriteAllowed(mode: string, classes: { tilting: boolean; settling: boolean; recoiling: boolean }): boolean {
  if (classes.tilting || classes.settling || classes.recoiling) return false;
  return mode !== "pending" && mode !== "pan" && mode !== "pinch" && mode !== "swipe";
}
