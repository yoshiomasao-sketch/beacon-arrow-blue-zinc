/**
 * PC lightbox rubber pull. Position and tilt are a temporary offset on top of
 * the framed picture. They always settle back to zero.
 */

export const RUBBER_MAX_PX = 168;
const PULL_LEAN = 6;
const TILT_CAP = 12;
const OMEGA = 16;
const ZETA = 0.42;
const MAX_SPEED = 2200;
const MAX_SPIN = 120;

export type RubberPoint = { x: number; y: number };

export type RubberPose = { x: number; y: number; rx: number; ry: number };

export type RubberState = RubberPose & { vx: number; vy: number; rvx: number; rvy: number };

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

/** Close to the pointer at first, then resists so the picture stays on screen. */
export function rubberOffset(dx: number, dy: number, max = RUBBER_MAX_PX): RubberPoint {
  const axis = (delta: number) => {
    if (!Number.isFinite(delta) || !Number.isFinite(max) || max <= 0) return 0;
    const mag = Math.abs(delta);
    return Math.sign(delta) * max * (1 - Math.exp(-mag / max));
  };
  return { x: axis(dx), y: axis(dy) };
}

/** Keep the hover angle and lean a little further toward the pull. */
export function rubberDragTilt(base: RubberPoint, pull: RubberPoint, max = RUBBER_MAX_PX): RubberPoint {
  const span = Number.isFinite(max) && max > 0 ? max : RUBBER_MAX_PX;
  return {
    x: clamp((Number.isFinite(base.x) ? base.x : 0) - ((Number.isFinite(pull.y) ? pull.y : 0) / span) * PULL_LEAN, -TILT_CAP, TILT_CAP),
    y: clamp((Number.isFinite(base.y) ? base.y : 0) + ((Number.isFinite(pull.x) ? pull.x : 0) / span) * PULL_LEAN, -TILT_CAP, TILT_CAP),
  };
}

/** `speed` is pointer px per millisecond. A slow release stays near the pose. */
export function rubberRelease(pose: RubberPose, speed: RubberPoint): RubberState {
  const vx = clamp((Number.isFinite(speed.x) ? speed.x : 0) * 1000, -MAX_SPEED, MAX_SPEED);
  const vy = clamp((Number.isFinite(speed.y) ? speed.y : 0) * 1000, -MAX_SPEED, MAX_SPEED);
  return {
    x: Number.isFinite(pose.x) ? pose.x : 0,
    y: Number.isFinite(pose.y) ? pose.y : 0,
    rx: Number.isFinite(pose.rx) ? pose.rx : 0,
    ry: Number.isFinite(pose.ry) ? pose.ry : 0,
    vx,
    vy,
    rvx: clamp(-vx * 0.025, -MAX_SPIN, MAX_SPIN),
    rvy: clamp(vy * 0.025, -MAX_SPIN, MAX_SPIN),
  };
}

function stepAxis(position: number, velocity: number, dt: number): { p: number; v: number } {
  const accel = -2 * ZETA * OMEGA * velocity - OMEGA * OMEGA * position;
  const v = velocity + accel * dt;
  return { p: position + v * dt, v };
}

/** Underdamped step. `dtMs` is capped so a stalled frame cannot fling the picture. */
export function rubberStep(state: RubberState, dtMs: number): RubberState {
  const dt = Math.min(0.032, Math.max(0, Number.isFinite(dtMs) ? dtMs : 0) / 1000);
  const x = stepAxis(state.x, state.vx, dt);
  const y = stepAxis(state.y, state.vy, dt);
  const rx = stepAxis(state.rx, state.rvx, dt);
  const ry = stepAxis(state.ry, state.rvy, dt);
  return { x: x.p, y: y.p, vx: x.v, vy: y.v, rx: rx.p, ry: ry.p, rvx: rx.v, rvy: ry.v };
}

export function rubberResting(state: RubberState): boolean {
  return (
    Math.hypot(state.x, state.y) < 0.4 &&
    Math.hypot(state.vx, state.vy) < 14 &&
    Math.hypot(state.rx, state.ry) < 0.15 &&
    Math.hypot(state.rvx, state.rvy) < 6
  );
}

export function rubberRun(state: RubberState, ms = 1200, frame = 16): { end: RubberState; minX: number; minY: number } {
  let current = state;
  let minX = state.x;
  let minY = state.y;
  const steps = Math.ceil(ms / frame);
  for (let i = 0; i < steps; i += 1) {
    current = rubberStep(current, frame);
    minX = Math.min(minX, current.x);
    minY = Math.min(minY, current.y);
  }
  return { end: current, minX, minY };
}
