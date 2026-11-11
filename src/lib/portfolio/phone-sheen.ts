/**
 * Gloss on the phone lightbox. It only reads the tilt and shake already on screen.
 * The position comes from those same degrees, not from the PC 5° gloss scale.
 */

import { SHAKE_MAX_DEG, SHAKE_MAX_PX, type ShakePose } from "./device-shake.ts";
import { SENSOR_MAX_DEG } from "./device-tilt.ts";
import { SENSOR_RECOIL_MAX_DEG } from "./sensor-recoil.ts";
import { SHEEN_REST, SHEEN_TRAVEL_X, SHEEN_TRAVEL_Y, type Sheen } from "./lightbox-tilt.ts";

/** Cap. Same starting point as the PC highlight. */
export const PHONE_SHEEN_OPACITY = 0.55;
/** Highlight travel, in percent, at a full shake. */
export const PHONE_SHAKE_TRAVEL_X = 14;
export const PHONE_SHAKE_TRAVEL_Y = 10;
/** Extra band rotation, in degrees, at a full shake twist. */
export const PHONE_SHAKE_TURN = 8;

function unit(value: number, max: number): number {
  if (!Number.isFinite(value) || !(max > 0)) return 0;
  return Math.min(1, Math.max(-1, value / max));
}

function lean(angle: number): number {
  if (!Number.isFinite(angle) || !(SENSOR_MAX_DEG > 0)) return 0;
  const ratio = angle / SENSOR_MAX_DEG;
  const limit = SENSOR_RECOIL_MAX_DEG / SENSOR_MAX_DEG;
  return Math.min(limit, Math.max(-limit, ratio));
}

/**
 * Same degrees that rotate the picture.
 * Positive rotateY (right side back) moves the light right.
 * Positive rotateX (top side back) moves the light up.
 * A recoil past ±10° keeps moving the light. Opacity still stops at the cap.
 */
export function phoneSheen(tilt: { x: number; y: number }, shake: ShakePose): Sheen {
  const nx = lean(tilt.y);
  const ny = lean(tilt.x);
  const sx = unit(shake.x, SHAKE_MAX_PX);
  const sy = unit(shake.y, SHAKE_MAX_PX);
  const sr = unit(shake.r, SHAKE_MAX_DEG);
  const tiltMag = Math.min(1, Math.hypot(nx, ny));
  const shakeMag = Math.min(1, Math.hypot(sx, sy, sr * 0.65));
  const opacity = Math.min(PHONE_SHEEN_OPACITY, tiltMag * PHONE_SHEEN_OPACITY + shakeMag * PHONE_SHEEN_OPACITY);
  if (opacity <= 0) return SHEEN_REST;
  const x = (nx === 0 ? 0 : nx * SHEEN_TRAVEL_X) + sx * PHONE_SHAKE_TRAVEL_X;
  const y = (ny === 0 ? 0 : -ny * SHEEN_TRAVEL_Y) + sy * PHONE_SHAKE_TRAVEL_Y;
  return {
    x,
    y,
    opacity,
    turn: (nx === 0 ? 0 : nx * 12) - (ny === 0 ? 0 : ny * 6) + sr * PHONE_SHAKE_TURN,
  };
}