/**
 * Gallery thumbnail return. The float springs toward the card's home.
 * Overshoot is capped only while moving further away, never on the way in.
 */

export const RUBBER_MAX_SPEED = 1600;
export const RUBBER_STIFFNESS = 220;
export const RUBBER_DAMPING = 14;
export const RUBBER_SETTLE_DIST = 0.6;
export const RUBBER_SETTLE_SPEED = 24;
export const RUBBER_MAX_PAST = 72;
export const RUBBER_FADE_PX = 36;

export type RubberVec = { x: number; y: number; vx: number; vy: number };

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Pointer px/s. A fast flick cannot throw the clone off the screen. */
export function clampSpeed(vx: number, vy: number, max = RUBBER_MAX_SPEED): { vx: number; vy: number } {
  const x = finite(vx);
  const y = finite(vy);
  const cap = Number.isFinite(max) && max > 0 ? max : RUBBER_MAX_SPEED;
  const mag = Math.hypot(x, y);
  if (mag === 0 || mag <= cap) return { vx: x, vy: y };
  const scale = cap / mag;
  return { vx: x * scale, vy: y * scale };
}

/**
 * One underdamped step toward `home`. `dtMs` is capped so a stalled frame
 * cannot fling the clone. The 72px cap applies only when velocity still
 * points away from home.
 */
export function stepRubber(state: RubberVec, home: { x: number; y: number }, dtMs: number): RubberVec & { done: boolean } {
  const dt = Math.min(0.032, Math.max(0, finite(dtMs)) / 1000);
  const hx = finite(home.x);
  const hy = finite(home.y);
  const ax = -RUBBER_STIFFNESS * (finite(state.x) - hx) - RUBBER_DAMPING * finite(state.vx);
  const ay = -RUBBER_STIFFNESS * (finite(state.y) - hy) - RUBBER_DAMPING * finite(state.vy);
  let vx = finite(state.vx) + ax * dt;
  let vy = finite(state.vy) + ay * dt;
  let x = finite(state.x) + vx * dt;
  let y = finite(state.y) + vy * dt;
  let ox = x - hx;
  let oy = y - hy;
  let dist = Math.hypot(ox, oy);
  if (ox * vx + oy * vy > 0 && dist > RUBBER_MAX_PAST) {
    const scale = RUBBER_MAX_PAST / dist;
    x = hx + ox * scale;
    y = hy + oy * scale;
    ox *= scale;
    oy *= scale;
    dist = RUBBER_MAX_PAST;
    const nx = ox / dist;
    const ny = oy / dist;
    const radial = vx * nx + vy * ny;
    if (radial > 0) {
      vx -= radial * nx;
      vy -= radial * ny;
    }
  }
  const speed = Math.hypot(vx, vy);
  return {
    x,
    y,
    vx,
    vy,
    done: dist <= RUBBER_SETTLE_DIST && speed <= RUBBER_SETTLE_SPEED,
  };
}

/** Clone fades out as it covers the resting card, so the two are not both solid. */
export function rubberFade(distance: number, restOpacity = 0.55, fade = RUBBER_FADE_PX): { clone: number; card: number } {
  const span = Number.isFinite(fade) && fade > 0 ? fade : RUBBER_FADE_PX;
  const rest = Number.isFinite(restOpacity) ? Math.min(1, Math.max(0, restOpacity)) : 0.55;
  const dist = Number.isFinite(distance) ? Math.max(0, distance) : span;
  if (dist >= span) return { clone: 1, card: rest };
  const t = dist / span;
  return { clone: t, card: rest + (1 - rest) * (1 - t) };
}
