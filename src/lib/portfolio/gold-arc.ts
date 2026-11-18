/**
 * Mesh pose for the 黄金 effect.
 * The sheet is splash_03.png, 1774×887. The beer leaves a thin nozzle on the right
 * and falls away to the left. That nozzle is the root: its image position never moves.
 * Force bends the stream from the root. A traveling shiver runs along the beer and is
 * zero on the nozzle. Phase 0 and 1 are the untouched sheet.
 */

export const GOLD_SHEET_W = 1774;
export const GOLD_SHEET_H = 887;

/** Image u at which the thin nozzle begins. This column and everything to its right stay put. */
export const GOLD_PIN_U = 1694 / GOLD_SHEET_W;

/** Room around the sheet so a higher arc is not cut by the marker box. */
export const GOLD_PAD_X = 0.1;
export const GOLD_PAD_Y = 0.24;

export const GOLD_COLS = 24;
export const GOLD_ROWS = 10;

const TIP_U = 48 / GOLD_SHEET_W;
const PIN_V = 326 / GOLD_SHEET_H;
const TIP_V = 711 / GOLD_SHEET_H;
const EASE = 0.2;
const RAISE = 0.09;
const BELLY = 0.07;
const SAG = 0.62;
const SWAY = 0.022;
const WAVE_Y = 0.011;
const WAVE_X = 0.004;

/**
 * Center of the beer, sampled from splash_03.png.
 * x is a fraction of 1774, y is a fraction of 887. y grows downward.
 */
const CENTER: readonly [number, number][] = [
  [0.02706, 0.80158],
  [0.08117, 0.68828],
  [0.13529, 0.54735],
  [0.1894, 0.4566],
  [0.24352, 0.39121],
  [0.29763, 0.33315],
  [0.35175, 0.29932],
  [0.40586, 0.25423],
  [0.45998, 0.22943],
  [0.51409, 0.22041],
  [0.56821, 0.20462],
  [0.62232, 0.19166],
  [0.67644, 0.20462],
  [0.73055, 0.21082],
  [0.78467, 0.23224],
  [0.83878, 0.26043],
  [0.8929, 0.30271],
  [0.94701, 0.35851],
  [0.97407, 0.39628],
];

/** 0 on the nozzle, 1 once the stream has left the ease, flat slope at the pin. */
export function goldFlex(u: number): number {
  if (!(u < GOLD_PIN_U)) return 0;
  const start = GOLD_PIN_U - EASE;
  if (u <= start) return 1;
  const t = (GOLD_PIN_U - u) / EASE;
  return t * t * (3 - 2 * t);
}

/** 0 at the nozzle, 1 at the falling tip. */
function along(u: number): number {
  const span = GOLD_PIN_U - TIP_U;
  if (!(span > 0) || !(u < GOLD_PIN_U)) return 0;
  return Math.min(1, Math.max(0, (GOLD_PIN_U - u) / span));
}

function centerY(u: number): number {
  const first = CENTER[0] ?? [0, 0];
  const last = CENTER[CENTER.length - 1] ?? first;
  if (u <= first[0]) return first[1];
  if (u >= last[0]) return last[1];
  for (let i = 1; i < CENTER.length; i += 1) {
    const right = CENTER[i];
    const left = CENTER[i - 1];
    if (!right || !left || u > right[0]) continue;
    const span = right[0] - left[0];
    const t = span > 0 ? (u - left[0]) / span : 0;
    return left[1] + (right[1] - left[1]) * t;
  }
  return last[1];
}

function chordY(u: number): number {
  return PIN_V + (TIP_V - PIN_V) * along(u);
}

function wrapPhase(phase: number): number {
  if (!Number.isFinite(phase)) return 0;
  const wrapped = phase % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

/**
 * Offset of one image point, in fractions of the sheet (x of width, y of height).
 * Positive y is down. The nozzle shift is exactly zero at every phase.
 */
export function goldShift(u: number, v: number, phase: number): { dx: number; dy: number } {
  const flex = goldFlex(u);
  if (flex === 0) return { dx: 0, dy: 0 };
  const turn = wrapPhase(phase) * Math.PI * 2;
  const height = Math.sin(turn);
  const sway = Math.sin(turn * 2);
  const t = along(u);
  const belly = Math.sin(Math.PI * t);
  const sag = height < 0 ? -height * SAG : 0;
  const lift = height > 0 ? height * (RAISE + BELLY * belly) : 0;
  const wave = Math.sin(turn * 5 + t * 4.6 + v * 0.4) - Math.sin(t * 4.6 + v * 0.4);
  const waveX = Math.sin(turn * 5 + t * 3.2 + 0.7) - Math.sin(t * 3.2 + 0.7);
  return {
    dx: flex * (sway * SWAY + waveX * WAVE_X),
    dy: flex * ((chordY(u) - centerY(u)) * sag - lift + wave * WAVE_Y),
  };
}

/** Clip-space position of a mesh vertex. Texture uv stays on the original sheet. */
export function goldVertex(
  col: number,
  row: number,
  phase: number,
  cols = GOLD_COLS,
  rows = GOLD_ROWS,
): { x: number; y: number; u: number; v: number } {
  const u = cols > 0 ? col / cols : 0;
  const v = rows > 0 ? row / rows : 0;
  const shift = u + 1e-6 >= GOLD_PIN_U ? { dx: 0, dy: 0 } : goldShift(u, v, phase);
  const spanX = 1 + GOLD_PAD_X * 2;
  const spanY = 1 + GOLD_PAD_Y * 2;
  const px = (u + shift.dx + GOLD_PAD_X) / spanX;
  const py = (v + shift.dy + GOLD_PAD_Y) / spanY;
  return { x: px * 2 - 1, y: 1 - py * 2, u, v };
}
