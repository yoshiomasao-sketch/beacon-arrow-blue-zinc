/**
 * One shared tilt and shake for every visible thumbnail.
 * The values are separate from the cursor tilt on the inner layer.
 */

import { SHAKE_REST, type ShakePose } from "./device-shake.ts";
import { SENSOR_REST, smoothTilt, tiltFromPose, type Pose, type SensorTilt } from "./device-tilt.ts";

/** Gallery cards travel far enough that the whole row looks shoved aside. */
export const GALLERY_SHAKE_MAX_PX = 96;
export const GALLERY_SHAKE_MAX_DEG = 8;
/** Slower than the lightbox wobble, so the return is visible before a shuffle. */
const GALLERY_SHAKE_DECAY = 0.9;

export const SHUFFLE_FADE_MS = 180;
export const SHUFFLE_SLIDE_MS = 360;
export const SHUFFLE_ROW_MS = 200;

let held = false;

export function galleryTiltStep(shown: SensorTilt, pose: Pose, baseline: Pose | null): { shown: SensorTilt; baseline: Pose } {
  if (!baseline) return { shown: SENSOR_REST, baseline: pose };
  return { shown: smoothTilt(shown, tiltFromPose(pose, baseline)), baseline };
}

export function galleryImpulse(power: number, flip: boolean): ShakePose {
  if (!Number.isFinite(power) || power <= 0) return SHAKE_REST;
  const amount = Math.min(1, power);
  const sign = flip ? -1 : 1;
  return {
    x: sign * GALLERY_SHAKE_MAX_PX * amount,
    y: -sign * GALLERY_SHAKE_MAX_PX * 0.38 * amount,
    r: -sign * GALLERY_SHAKE_MAX_DEG * amount,
  };
}

export function galleryDecay(pose: ShakePose, dtMs: number): ShakePose {
  const steps = Math.max(0, dtMs) / 16;
  const factor = GALLERY_SHAKE_DECAY ** steps;
  const next = { x: pose.x * factor, y: pose.y * factor, r: pose.r * factor };
  if (Math.hypot(next.x, next.y) < 0.8 && Math.abs(next.r) < 0.2) return SHAKE_REST;
  return next;
}

export function armGalleryShuffle(armed: boolean, busy: boolean): boolean {
  if (busy || armed) return armed;
  return true;
}

export function finishGalleryShake(armed: boolean): { armed: boolean; shuffle: boolean } {
  if (!armed) return { armed: false, shuffle: false };
  return { armed: false, shuffle: true };
}

/** Row index for cards inside the view. -1 stays put, off screen. */
export function shuffleEnterRows(cards: { top: number; bottom: number }[], viewTop: number, viewBottom: number): number[] {
  const rows: number[] = [];
  for (const card of cards) {
    if (card.bottom <= viewTop || card.top >= viewBottom) continue;
    if (!rows.some((top) => Math.abs(top - card.top) < 12)) rows.push(card.top);
  }
  rows.sort((a, b) => a - b);
  return cards.map((card) => {
    if (card.bottom <= viewTop || card.top >= viewBottom) return -1;
    return rows.findIndex((top) => Math.abs(top - card.top) < 12);
  });
}

/** Desktop travel, so a card starts just outside the right edge of the gallery. */
export function shuffleEnterShift(cardLeft: number, viewRight: number, cardWidth: number): number {
  const width = Number.isFinite(cardWidth) && cardWidth > 0 ? cardWidth : 0;
  const gap = Number.isFinite(viewRight) && Number.isFinite(cardLeft) ? viewRight - cardLeft : 0;
  return Math.max(width, Math.ceil(gap + 32));
}

export function holdGallerySensor() {
  held = true;
  const node = document.querySelector(".gallery-flow");
  if (node instanceof HTMLElement) clearGalleryMotion(node);
}

export function releaseGallerySensor() {
  held = false;
}

export function gallerySensorHeld(): boolean {
  return held;
}

export function paintGalleryTilt(node: HTMLElement, tilt: SensorTilt) {
  if (held) return;
  node.classList.add("is-sensing");
  node.style.setProperty("--gallery-rx", `${tilt.x.toFixed(2)}deg`);
  node.style.setProperty("--gallery-ry", `${tilt.y.toFixed(2)}deg`);
}

export function paintGalleryShake(node: HTMLElement, shake: ShakePose) {
  if (held) return;
  const moving = shake.x !== 0 || shake.y !== 0 || shake.r !== 0;
  node.classList.toggle("is-gallery-shake", moving);
  if (!moving) {
    node.style.removeProperty("--gallery-sx");
    node.style.removeProperty("--gallery-sy");
    node.style.removeProperty("--gallery-sr");
    return;
  }
  node.style.setProperty("--gallery-sx", `${shake.x.toFixed(2)}px`);
  node.style.setProperty("--gallery-sy", `${shake.y.toFixed(2)}px`);
  node.style.setProperty("--gallery-sr", `${shake.r.toFixed(2)}deg`);
}

export function paintGalleryMotion(node: HTMLElement, tilt: SensorTilt, shake: ShakePose) {
  paintGalleryTilt(node, tilt);
  paintGalleryShake(node, shake);
}

export function clearGalleryMotion(node: HTMLElement) {
  node.classList.remove("is-sensing", "is-gallery-shake");
  node.style.removeProperty("--gallery-rx");
  node.style.removeProperty("--gallery-ry");
  node.style.removeProperty("--gallery-sx");
  node.style.removeProperty("--gallery-sy");
  node.style.removeProperty("--gallery-sr");
}

export function markCardsOnScreen(flow: HTMLElement, view: HTMLElement) {
  const box = view.getBoundingClientRect();
  const margin = 80;
  for (const card of flow.querySelectorAll(".shot-card")) {
    const rect = card.getBoundingClientRect();
    const on = rect.bottom > box.top - margin && rect.top < box.bottom + margin && rect.right > box.left && rect.left < box.right;
    card.classList.toggle("is-on-screen", on);
  }
}

export { SHAKE_REST };
