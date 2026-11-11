/**
 * After the phone stays nearly still, treat that pose as the new zero
 * and ease the picture back to front. Noise must not restart the wait.
 */

import { SENSOR_REST, baselineForShown, smoothTilt, tiltFromPose, wrap180, type Pose, type SensorTilt } from "./device-tilt.ts";

export const SENSOR_STILL_MS = 2000;
/** Device-degree move that counts as a real tilt, not sensor noise. */
export const SENSOR_STILL_DEG = 2.4;
/** Ease time constant for the return to front. */
const STILL_EASE_MS = 360;

export type StillWatch = { anchor: Pose | null; since: number; settling: boolean };

export function freshStillWatch(): StillWatch {
  return { anchor: null, since: 0, settling: false };
}

export function poseShift(from: Pose, to: Pose): number {
  return Math.hypot(wrap180(to.beta - from.beta), wrap180(to.gamma - from.gamma));
}

export function easeStill(shown: SensorTilt, dtMs: number): SensorTilt {
  const dt = Math.max(0, Math.min(dtMs, 64));
  const factor = 1 - Math.exp(-dt / STILL_EASE_MS);
  return smoothTilt(shown, SENSOR_REST, factor);
}

export function applyStillTilt(input: { watch: StillWatch; baseline: Pose; shown: SensorTilt; pose: Pose; now: number; dt: number }): {
  watch: StillWatch;
  baseline: Pose;
  shown: SensorTilt;
  settling: boolean;
} {
  const { pose, now } = input;
  const watch = input.watch;
  if (!watch.anchor) {
    return { watch: { anchor: pose, since: now, settling: false }, baseline: input.baseline, shown: input.shown, settling: false };
  }
  const moved = poseShift(watch.anchor, pose) > SENSOR_STILL_DEG;
  if (moved) {
    const nextWatch = { anchor: pose, since: now, settling: false };
    if (watch.settling) {
      const baseline = baselineForShown(watch.anchor, input.shown);
      return { watch: nextWatch, baseline, shown: smoothTilt(input.shown, tiltFromPose(pose, baseline)), settling: false };
    }
    return { watch: nextWatch, baseline: input.baseline, shown: smoothTilt(input.shown, tiltFromPose(pose, input.baseline)), settling: false };
  }
  if (watch.settling || now - watch.since >= SENSOR_STILL_MS) {
    const anchor = watch.settling ? watch.anchor : pose;
    const shown = easeStill(input.shown, input.dt);
    if (Math.hypot(shown.x, shown.y) < 0.08) {
      return { watch: { anchor: pose, since: now, settling: false }, baseline: pose, shown: SENSOR_REST, settling: false };
    }
    return { watch: { anchor, since: watch.settling ? watch.since : now, settling: true }, baseline: anchor, shown, settling: true };
  }
  return { watch, baseline: input.baseline, shown: smoothTilt(input.shown, tiltFromPose(pose, input.baseline)), settling: false };
}
