/**
 * Phone tilt recoil when the device snaps back toward its baseline.
 * The live sensor tilt stays separate. These constants are the tuning knobs.
 * PC drag recoil is not used here.
 */

import { SENSOR_REST, type SensorTilt } from "./device-tilt.ts";

/** Recent target angles used to measure speed, in ms. */
export const SENSOR_RECOIL_WINDOW_MS = 120;
/** How long a tilt still counts as the pose we are returning from. */
export const SENSOR_RECOIL_MEMORY_MS = 480;
/** Image degrees the phone must reach before a return can recoil. */
export const SENSOR_RECOIL_AWAY_DEG = 4;
/** A return only counts once the image angle is back down to this, or 45% of the peak. */
export const SENSOR_RECOIL_NEAR_DEG = 2.6;
/** After a recoil, the phone must come back this close to rest before it can arm again. */
export const SENSOR_RECOIL_RESET_DEG = 1.6;
/** Image degrees per ms. Slower than this is a normal follow, not a throw. */
export const SENSOR_RECOIL_SPEED_MIN = 0.08;
/** Speed that reaches the full throw. */
export const SENSOR_RECOIL_SPEED_FULL = 0.22;
export const SENSOR_RECOIL_SPEED_CAP = 0.5;
/** Throw size at full speed. This offset is unchanged. */
export const SENSOR_RECOIL_EXTRA_MAX = 10;
/** Room for a ±10° live tilt plus the throw, so the live tilt is not clipped. */
export const SENSOR_RECOIL_MAX_DEG = 20;
export const SENSOR_RECOIL_BACK_RATIO = 0.34;
export const SENSOR_RECOIL_MS = 400;
export const SENSOR_RECOIL_PEAK_AT = 0.3;
export const SENSOR_RECOIL_BACK_AT = 0.62;
/** Leaving rest again by this much cancels a throw already in progress. */
export const SENSOR_RECOIL_REGRAB_DEG = 2.5;

export type SensorRecoilFrame = { at: number; tilt: SensorTilt };

type AxisWatch = { peak: number; sign: number; at: number; armed: boolean; dipped: boolean };

export type SensorRecoilWatch = {
  samples: { t: number; x: number; y: number }[];
  x: AxisWatch;
  y: AxisWatch;
};

const AXIS_WATCH: AxisWatch = { peak: 0, sign: 0, at: 0, armed: true, dipped: false };

export function freshSensorRecoilWatch(): SensorRecoilWatch {
  return { samples: [], x: { ...AXIS_WATCH }, y: { ...AXIS_WATCH } };
}

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(-max, value));
}

function followPeak(axis: AxisWatch, angle: number, now: number): AxisWatch {
  const abs = Math.abs(angle);
  let next = axis;
  if (axis.at === 0 || now - axis.at > SENSOR_RECOIL_MEMORY_MS) {
    next = { peak: abs, sign: Math.sign(angle) || axis.sign, at: now, armed: axis.armed, dipped: axis.dipped };
  } else if (abs >= axis.peak) {
    next = { ...axis, peak: abs, sign: Math.sign(angle) || axis.sign, at: now };
  }
  if (!next.armed && abs <= SENSOR_RECOIL_RESET_DEG) next = { ...next, dipped: true };
  if (!next.armed && next.dipped && abs >= SENSOR_RECOIL_AWAY_DEG) next = { ...next, armed: true, dipped: false };
  return next;
}

function axisVelocity(samples: readonly { t: number; x: number; y: number }[], now: number, axis: "x" | "y"): number {
  const recent = samples.filter((sample) => {
    const age = now - sample.t;
    return age >= 0 && age <= SENSOR_RECOIL_WINDOW_MS;
  });
  if (recent.length < 2) return 0;
  const last = recent[recent.length - 1];
  const prev = recent[recent.length - 2];
  const dt = last.t - prev.t;
  if (dt < 16 || dt > SENSOR_RECOIL_WINDOW_MS) return 0;
  const speed = (last[axis] - prev[axis]) / dt;
  if (!Number.isFinite(speed)) return 0;
  return clamp(speed, SENSOR_RECOIL_SPEED_CAP);
}

function axisImpulse(axis: AxisWatch, angle: number, velocity: number, now: number): number {
  if (!axis.armed || axis.peak < SENSOR_RECOIL_AWAY_DEG || axis.sign === 0) return 0;
  if (now - axis.at > SENSOR_RECOIL_MEMORY_MS) return 0;
  const abs = Math.abs(angle);
  if (abs > Math.max(SENSOR_RECOIL_NEAR_DEG, axis.peak * 0.45)) return 0;
  if (velocity * axis.sign >= 0) return 0;
  const mag = Math.abs(velocity);
  if (mag < SENSOR_RECOIL_SPEED_MIN) return 0;
  const span = SENSOR_RECOIL_SPEED_FULL - SENSOR_RECOIL_SPEED_MIN;
  const amount = Math.min(1, (mag - SENSOR_RECOIL_SPEED_MIN) / span);
  return Math.sign(velocity) * SENSOR_RECOIL_EXTRA_MAX * amount;
}

function disarm(axis: AxisWatch, angle: number, now: number): AxisWatch {
  return { peak: Math.abs(angle), sign: axis.sign, at: now, armed: false, dipped: false };
}

/**
 * Watch the unsmoothed image tilt. A fast return toward the baseline produces
 * an impulse in the direction of that return. A slow return or a wobble does not.
 */
export function observeSensorReturn(watch: SensorRecoilWatch, target: SensorTilt, now: number): { watch: SensorRecoilWatch; impulse: SensorTilt | null } {
  const samples = watch.samples.filter((sample) => now - sample.t <= SENSOR_RECOIL_WINDOW_MS).concat({ t: now, x: target.x, y: target.y });
  let x = followPeak(watch.x, target.x, now);
  let y = followPeak(watch.y, target.y, now);
  const ix = axisImpulse(x, target.x, axisVelocity(samples, now, "x"), now);
  const iy = axisImpulse(y, target.y, axisVelocity(samples, now, "y"), now);
  if (ix !== 0) x = disarm(x, target.x, now);
  if (iy !== 0) y = disarm(y, target.y, now);
  return {
    watch: { samples, x, y },
    impulse: ix === 0 && iy === 0 ? null : { x: ix, y: iy },
  };
}

/** Drop a throw that is already running so the next real tilt can arm again. */
export function muteSensorRecoil(watch: SensorRecoilWatch): SensorRecoilWatch {
  return {
    samples: [],
    x: { ...watch.x, armed: false, dipped: false },
    y: { ...watch.y, armed: false, dipped: false },
  };
}

export function sensorReturnReversed(minAbs: number, angle: number): boolean {
  return Math.abs(angle) > minAbs + SENSOR_RECOIL_REGRAB_DEG;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Offset from the live tilt: out, one opposite swing, then none. */
export function sensorRecoilOffsets(impulse: SensorTilt): SensorRecoilFrame[] | null {
  if (impulse.x === 0 && impulse.y === 0) return null;
  const peak = {
    x: clamp(impulse.x, SENSOR_RECOIL_MAX_DEG),
    y: clamp(impulse.y, SENSOR_RECOIL_MAX_DEG),
  };
  const back = {
    x: clamp(-Math.sign(peak.x) * Math.abs(peak.x) * SENSOR_RECOIL_BACK_RATIO, SENSOR_RECOIL_MAX_DEG),
    y: clamp(-Math.sign(peak.y) * Math.abs(peak.y) * SENSOR_RECOIL_BACK_RATIO, SENSOR_RECOIL_MAX_DEG),
  };
  return [
    { at: 0, tilt: SENSOR_REST },
    { at: SENSOR_RECOIL_PEAK_AT, tilt: peak },
    { at: SENSOR_RECOIL_BACK_AT, tilt: back },
    { at: 1, tilt: SENSOR_REST },
  ];
}

export function sensorRecoilOffset(frames: readonly SensorRecoilFrame[], t: number): SensorTilt {
  if (frames.length === 0) return SENSOR_REST;
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

/** Live sensor tilt plus the throw, limited to ±10° on each axis. */
export function sensorRecoilAngle(live: SensorTilt, offset: SensorTilt): SensorTilt {
  return {
    x: clamp(live.x + offset.x, SENSOR_RECOIL_MAX_DEG),
    y: clamp(live.y + offset.y, SENSOR_RECOIL_MAX_DEG),
  };
}
