/**
 * Shared GIF clock. Playback math stays in the animation modules.
 * This file only samples those functions on one fixed timeline.
 */

import { animationFrame, animationCycle, twistCycle, zoomOptionCycle, type AnimKind, type AnimSpeed, type OptionPace } from "./image-animation.ts";
import { effectCycle, effectOpacity, effectPhase, type EffectPace } from "./effect-marker.ts";
import {
  capShift,
  favoriteRecordMs,
  vectorCycle,
  vectorMotion,
  vectorOnMesh,
  type VectorKind,
  type VectorMarker,
  type VectorPace,
} from "./vector-marker.ts";
import {
  PURU_GRID,
  driveFromMotion,
  fillDisplacement,
  puruMotionSpace,
  stepBodies,
  stillHold,
  type PuruBody,
  type PuruMarker,
  type PuruSample,
} from "./purupuru.ts";
import type { ImagePlay } from "./types.ts";
import { averageCells, dotGrid, mapCells, paletteFromCells, snapDotColors } from "./dot-filter.ts";

/** 25fps is 40ms, which is 4 centiseconds. 15 and 24 do not land on an integer GIF delay inside the record. */
export const GIF_FPS = 25;
export const GIF_FRAME_MS = 40;
export const GIF_DELAY_MS = 40;
export const GIF_MAX_SIDE = 720;
export const GIF_COLORS = 256;
/** Integrator step. A GIF of the same favorite always steps this, from rest. */
export const GIF_STEP_MS = 1000 / 60;
/** One record of driving before the first frame, so the springs are already on their loop. */
export const GIF_WARMUP_LOOPS = 1;

export type GifMotion = Pick<ImagePlay, "kind" | "speed" | "reverse" | "zoom" | "twist" | "zoomPace" | "twistPace" | "tilt">;

export function dividesRecord(cycle: number, record = favoriteRecordMs()): boolean {
  if (!(cycle > 0) || !Number.isFinite(cycle)) return false;
  const loops = record / cycle;
  const rounded = Math.round(loops);
  return rounded >= 1 && Math.abs(loops - rounded) < 1e-6;
}

export function gifFramePlan(record = favoriteRecordMs()): { recordMs: number; fps: number; frameMs: number; delayMs: number; count: number; times: number[] } {
  const frames = record / GIF_FRAME_MS;
  if (Math.abs(frames - Math.round(frames)) > 1e-6) throw new Error("record is not an integer number of frames");
  const count = Math.round(frames);
  return {
    recordMs: record,
    fps: GIF_FPS,
    frameMs: GIF_FRAME_MS,
    delayMs: GIF_DELAY_MS,
    count,
    times: Array.from({ length: count }, (_, index) => index * GIF_FRAME_MS),
  };
}

/** Kept frames of the 128-frame record. 64 keeps every 2nd, 32 every 4th. */
export const GIF_EXPORT_COUNTS = [128, 64, 32] as const;
export type GifExportCount = (typeof GIF_EXPORT_COUNTS)[number];

/**
 * GIF delay is an integer number of centiseconds, and 0 is not a real hold.
 * Each gap is rounded, then leftover centiseconds go to the frames with the
 * largest remainder so the holds add up to the record.
 */
export function gifDelaysMs(times: readonly number[], recordMs: number): number[] {
  if (times.length === 0) return [];
  const ideals = times.map((time, index) => {
    const next = index + 1 < times.length ? (times[index + 1] ?? recordMs) : recordMs;
    return Math.max(0, next - time);
  });
  const target = Math.max(times.length, Math.round(recordMs / 10));
  const exact = ideals.map((ms) => ms / 10);
  const delays = exact.map((cs) => Math.max(1, Math.min(65535, Math.floor(cs))));
  let sum = delays.reduce((total, cs) => total + cs, 0);
  const byRemainder = exact
    .map((cs, index) => ({ index, frac: cs - Math.floor(cs) }))
    .sort((a, b) => b.frac - a.frac || b.index - a.index);
  let guard = 0;
  while (sum < target && guard < target + delays.length) {
    let moved = false;
    for (const slot of byRemainder) {
      if (sum >= target) break;
      if ((delays[slot.index] ?? 0) >= 65535) continue;
      delays[slot.index] = (delays[slot.index] ?? 0) + 1;
      sum += 1;
      moved = true;
    }
    if (!moved) break;
    guard += 1;
  }
  const lowFirst = [...byRemainder].reverse();
  while (sum > target && guard < target + delays.length * 2) {
    let moved = false;
    for (const slot of lowFirst) {
      if (sum <= target) break;
      if ((delays[slot.index] ?? 0) <= 1) continue;
      delays[slot.index] = (delays[slot.index] ?? 0) - 1;
      sum -= 1;
      moved = true;
    }
    if (!moved) break;
    guard += 1;
  }
  return delays.map((cs) => cs * 10);
}

/** Same sample clock as `gifFramePlan`. Fewer frames keep the record length by holding longer. */
export function gifExportPlan(count: GifExportCount = 128, record = favoriteRecordMs()): {
  recordMs: number;
  fps: number;
  frameMs: number;
  delayMs: number;
  count: number;
  times: number[];
  delays: number[];
  stride: number;
  sourceCount: number;
} {
  const full = gifFramePlan(record);
  if (full.count % count !== 0) throw new Error("frame count does not divide the record");
  const stride = full.count / count;
  const times = full.times.filter((_, index) => index % stride === 0);
  const delays = gifDelaysMs(times, full.recordMs);
  return {
    recordMs: full.recordMs,
    fps: full.fps,
    frameMs: full.frameMs,
    delayMs: full.delayMs,
    count: times.length,
    times,
    delays,
    stride,
    sourceCount: full.count,
  };
}

/** Long side at most `maxSide`. The ratio of the source is kept. */
export function gifPixelSize(width: number, height: number, maxSide = GIF_MAX_SIDE): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const long = Math.max(w, h);
  const scale = long > maxSide ? maxSide / long : 1;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * Dot-by-dot GIF size. The working frame is the usual export size, then the
 * same cell grid as the dot slider. One cell is one stored pixel — not a
 * mosaic painted back into the large frame.
 */
export function gifDotPixelSize(width: number, height: number, cols: number): { width: number; height: number } {
  const fitted = gifPixelSize(width, height);
  const grid = dotGrid(fitted.width, fitted.height, cols);
  return { width: grid.cols, height: grid.rows };
}

/**
 * Box-average finished frames down to the dot grid.
 * Color reduction, when asked, uses one palette for every frame so the
 * animation does not flicker. Clear cells stay clear.
 */
export function gifDotFrames(
  frames: readonly { rgba: Uint8Array | Uint8ClampedArray; width: number; height: number }[],
  cols: number,
  colors: number | null,
): { rgba: Uint8ClampedArray; width: number; height: number }[] {
  const fields = frames.map((frame) => averageCells(frame.rgba, frame.width, frame.height, cols));
  if (colors != null && fields.length > 0) {
    const palette = paletteFromCells(fields, snapDotColors(colors));
    for (const field of fields) mapCells(field, palette);
  }
  return fields.map((field) => ({ rgba: field.rgba, width: field.cols, height: field.rows }));
}

export function gifSuggestedName(name: string): string {
  const stem = name.replace(/\.[^.\\/]+$/, "").replace(/[\\/:*?"<>|]/g, "").trim();
  return `${stem || "お気に入り"}.gif`;
}

export function motionAt(play: GifMotion, elapsedMs: number, frame: { width: number; height: number }) {
  return animationFrame(
    play.kind,
    play.speed,
    elapsedMs,
    frame,
    play.reverse,
    {
      zoom: play.zoom,
      twist: play.twist,
      tilt: play.tilt,
      zoomPace: play.zoomPace,
      twistPace: play.twistPace,
    },
  );
}

function samplePose(play: GifMotion, elapsedMs: number, frame: { width: number; height: number }, stamp: number): PuruSample {
  const pose = motionAt(play, elapsedMs, frame);
  return { x: pose.x, y: pose.y, scale: pose.scale, t: stamp };
}

function paintMesh(
  markers: PuruMarker[],
  bodies: PuruBody[],
  vectors: readonly VectorMarker[],
  vectorElapsed: number,
  width: number,
  height: number,
): Float32Array {
  const disp = new Float32Array(PURU_GRID * PURU_GRID * 2);
  fillDisplacement(markers, bodies, width, height, disp, null, null);
  if (!vectors.length) return disp;
  const cap = Math.min(width, height) * 0.34;
  const cols = PURU_GRID;
  for (let row = 0; row < cols; row += 1) {
    const y = (row / (cols - 1)) * height;
    for (let col = 0; col < cols; col += 1) {
      const x = (col / (cols - 1)) * width;
      const extra = vectorOnMesh(vectors, markers, vectorElapsed, x, y, width, height);
      if (extra.x === 0 && extra.y === 0) continue;
      const open = 1 - stillHold(markers, x, y, width, height);
      const index = (row * cols + col) * 2;
      const mixed = capShift({ x: (disp[index] ?? 0) + extra.x * open, y: (disp[index + 1] ?? 0) + extra.y * open }, cap);
      disp[index] = mixed.x;
      disp[index + 1] = mixed.y;
    }
  }
  return disp;
}

/**
 * One displacement grid per GIF frame, or null when the photo is not warped.
 * Springs start at rest. They are driven for one whole record, on the same
 * 1/60 steps the frames use, before frame 0 is kept.
 */
export function meshFrames(args: {
  play: GifMotion;
  puru: readonly PuruMarker[];
  vectors: readonly VectorMarker[];
  width: number;
  height: number;
  /** Kept frames. The springs still step the full 40ms record, then extra poses are dropped. */
  count?: GifExportCount;
}): { frames: Float32Array[]; seam: number } | null {
  const deformable = args.puru.some((marker) => marker.off !== true && marker.kind !== "still");
  const vectors = args.vectors.filter((marker) => marker.off !== true);
  const moves = args.play.kind !== null || args.play.zoom || args.play.twist;
  if (!deformable || (!moves && vectors.length === 0)) return null;

  const plan = gifFramePlan();
  const kept = gifExportPlan(args.count ?? 128);
  const stride = kept.stride;
  const markers = args.puru.map((marker) => ({ ...marker }));
  const space = puruMotionSpace(Math.min(args.width, args.height), true);
  const bodies = new Map<number, PuruBody>();
  const record = plan.recordMs;
  const warmup = record * GIF_WARMUP_LOOPS;
  let stamp = 0;
  let prev = samplePose(args.play, 0, args, 0);
  let posed: PuruBody[] = markers.map(() => ({ ox: 0, oy: 0, os: 0, vx: 0, vy: 0, vs: 0 }));
  const reach = (target: number) => {
    while (stamp + 1e-3 < target) {
      const nextStamp = Math.min(stamp + GIF_STEP_MS, target);
      if (nextStamp <= stamp) return;
      const next = samplePose(args.play, nextStamp, args, nextStamp);
      const drive = driveFromMotion(prev, next, next.t);
      posed = stepBodies(markers, bodies, drive, (next.t - prev.t) / 1000, space);
      stamp = nextStamp;
      prev = next;
    }
  };
  const marks: number[] = [];
  for (let loop = 0; loop < GIF_WARMUP_LOOPS; loop += 1) {
    for (let index = 1; index <= plan.count; index += 1) marks.push(loop * record + index * plan.frameMs);
  }
  for (let index = 1; index < plan.count; index += 1) marks.push(warmup + index * plan.frameMs);
  marks.push(warmup + record);
  const frames: Float32Array[] = [];
  let seen = 0;
  for (const at of marks) {
    reach(at);
    if (at + 1e-3 >= warmup && at < warmup + record - 1e-3) {
      if (seen % stride === 0) frames.push(paintMesh(markers, posed, vectors, stamp - warmup, args.width, args.height));
      seen += 1;
    }
  }
  const endMesh = paintMesh(markers, posed, vectors, record, args.width, args.height);
  const start = frames[0] ?? endMesh;
  let seam = 0;
  for (let i = 0; i < start.length; i += 1) seam = Math.max(seam, Math.abs((start[i] ?? 0) - (endMesh[i] ?? 0)));
  return frames.length === kept.count ? { frames, seam } : null;
}

export function imageCyclesDivide(record = favoriteRecordMs()): boolean {
  const kinds: AnimKind[] = ["swayX", "hitX", "swayY", "hitY", "orbit", "zoom", "buzz"];
  const speeds: AnimSpeed[] = ["slow", "normal", "fast", "rapid", "ultra"];
  for (const kind of kinds) for (const speed of speeds) if (!dividesRecord(animationCycle(kind, speed), record)) return false;
  const paces: OptionPace[] = ["slow", "normal", "fast"];
  for (const pace of paces) {
    if (!dividesRecord(twistCycle(pace), record)) return false;
    if (!dividesRecord(zoomOptionCycle(pace), record)) return false;
  }
  return true;
}

export function vectorCyclesDivide(record = favoriteRecordMs()): boolean {
  const kinds: VectorKind[] = ["orbit", "orbitBack", "sway", "push", "hit", "expand", "shrink", "react", "buzz"];
  const paces: VectorPace[] = ["slow", "normal", "fast"];
  for (const kind of kinds) for (const pace of paces) if (!dividesRecord(vectorCycle(kind, pace), record)) return false;
  return true;
}

export function effectCyclesDivide(record = favoriteRecordMs()): boolean {
  const paces: EffectPace[] = ["slow", "normal", "fast"];
  return paces.every((pace) => dividesRecord(effectCycle(pace), record));
}

/** Same pose at the start and at the end of the record, downbeat and backbeat. */
export function vectorSeam(kind: VectorKind, pace: VectorPace, record = favoriteRecordMs()): number {
  const marker = { kind, pace, angle: 0.4, span: 1, backbeat: false as boolean };
  const cycle = vectorCycle(kind, pace);
  const drawn = 120;
  let gap = 0;
  for (const backbeat of [false, true]) {
    const a = vectorMotion({ ...marker, backbeat }, 0, drawn);
    const b = vectorMotion({ ...marker, backbeat }, record, drawn);
    gap = Math.max(gap, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    if (backbeat) {
      const mid = vectorMotion({ ...marker, backbeat: true }, cycle / 2, drawn);
      const down = vectorMotion({ ...marker, backbeat: false }, 0, drawn);
      gap = Math.max(gap, Math.abs(mid.x - down.x), Math.abs(mid.y - down.y));
    }
  }
  return gap;
}

export function effectSeam(pace: EffectPace, record = favoriteRecordMs()): number {
  let gap = 0;
  for (const backbeat of [false, true]) {
    gap = Math.max(gap, Math.abs(effectOpacity(pace, 0, backbeat) - effectOpacity(pace, record, backbeat)));
    gap = Math.max(gap, Math.abs(effectPhase(pace, 0, backbeat) - effectPhase(pace, record, backbeat)));
  }
  return gap;
}
