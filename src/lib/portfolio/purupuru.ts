/** Temporary local wobble. Display only — never written back to the photo. */

export type PuruKind = "firm" | "mid" | "soft" | "firm-weak" | "mid-weak" | "soft-weak" | "firm-low" | "mid-low" | "soft-low" | "still";

export type PuruMarker = {
  id: number;
  kind: PuruKind;
  /** 0–1 across the displayed image, origin at the top left. */
  u: number;
  v: number;
  /** Drawn circle, as a fraction of the shorter side, when view is 1. The ring the user resizes. */
  radius: number;
  /** Drawn size relative to the radius. 1 is the full circle, 0.5 is half. Missing means 1. */
  view?: number;
  /** Parked. Missing means the marker still deforms. */
  off?: boolean;
};

export type PuruBody = {
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  os: number;
  vs: number;
};

export type PuruDrive = { vx: number; vy: number; dScale: number };

export type PuruSample = { x: number; y: number; scale: number; t: number };

export const PURU_GRID = 28;
export const PURU_RADIUS = 0.28;
export const PURU_RADIUS_MIN = 0.12;
export const PURU_RADIUS_MAX = 0.5;
/** Drawn circle only. 1 matches the stored radius. A tenth is the smallest ring. */
export const PURU_VIEW_MIN = 0.1;
export const PURU_VIEW_MAX = 1;

/**
 * How far the wobble travels past the drawn circle.
 * Narrow stays almost inside the ring. Normal steps outside. Wide goes further.
 */
export const PURU_REACH = { narrow: 1.12, normal: 1.45, wide: 1.9 } as const;

export const PURU_KINDS: { id: PuruKind; label: string; short: string; lines: readonly string[]; hint: string; color: string }[] = [
  { id: "firm-low", label: "狭い・弱", short: "狭弱", lines: ["狭い", "弱"], hint: "円の内側だけ、弱く揺れる", color: "#3DDC97" },
  { id: "mid-low", label: "普通・弱", short: "普弱", lines: ["普通", "弱"], hint: "円の少し外側まで、弱く揺れる", color: "#3DABFF" },
  { id: "soft-low", label: "広い・弱", short: "広弱", lines: ["広い", "弱"], hint: "さらに外側まで、弱く揺れる", color: "#FF4F9A" },
  { id: "firm-weak", label: "狭い・中", short: "狭中", lines: ["狭い", "中"], hint: "円の内側だけ、中くらいに揺れる", color: "#3DDC97" },
  { id: "mid-weak", label: "普通・中", short: "普中", lines: ["普通", "中"], hint: "円の少し外側まで、中くらいに揺れる", color: "#3DABFF" },
  { id: "soft-weak", label: "広い・中", short: "広中", lines: ["広い", "中"], hint: "さらに外側まで、中くらいに揺れる", color: "#FF4F9A" },
  { id: "firm", label: "狭い・強", short: "狭強", lines: ["狭い", "強"], hint: "円の内側だけ、大きく揺れる", color: "#3DDC97" },
  { id: "mid", label: "普通・強", short: "普強", lines: ["普通", "強"], hint: "円の少し外側まで、大きく揺れる", color: "#3DABFF" },
  { id: "soft", label: "広い・強", short: "広強", lines: ["広い", "強"], hint: "さらに外側まで、大きく揺れる", color: "#FF4F9A" },
];

export const PURU_PC_KINDS = PURU_KINDS;

export const PURU_STILL: { id: "still"; label: string; short: string; lines: readonly string[]; hint: string; color: string } = {
  id: "still",
  label: "不動",
  short: "不動",
  lines: ["不動"],
  hint: "円の少し外側まで、動きを抑える",
  color: "#E6E1D6",
};

export function puruKindFace(kind: PuruKind, _phone?: boolean) {
  if (kind === "still") return PURU_STILL;
  return PURU_KINDS.find((entry) => entry.id === kind) ?? PURU_KINDS[0];
}

type Tune = { k: number; c: number; gain: number; max: number; sk: number; sc: number; sGain: number; sMax: number };

/** Normal amplitude is 75% of the previous firm spring. Softer kinds still widen the reach, not this. */
const FIRM_TUNE: Tune = { k: 280, c: 30, gain: 0.315, max: 13.5, sk: 220, sc: 26, sGain: 0.135, sMax: 0.0375 };
/** Saved「弱」is now「中」. Only the shake size changes; the spring stays. */
const WEAK_SCALE = (0.175 / 0.75) * 1.3;
const WEAK_TUNE: Tune = {
  k: FIRM_TUNE.k,
  c: FIRM_TUNE.c,
  gain: FIRM_TUNE.gain * WEAK_SCALE,
  max: FIRM_TUNE.max * WEAK_SCALE,
  sk: FIRM_TUNE.sk,
  sc: FIRM_TUNE.sc,
  sGain: FIRM_TUNE.sGain * WEAK_SCALE,
  sMax: FIRM_TUNE.sMax * WEAK_SCALE,
};
/** New「弱」is 70% of the previous weak spring. Reach and spring stay with「中」. */
const LOW_SCALE = 0.7;
const LOW_TUNE: Tune = {
  k: WEAK_TUNE.k,
  c: WEAK_TUNE.c,
  gain: WEAK_TUNE.gain * LOW_SCALE,
  max: WEAK_TUNE.max * LOW_SCALE,
  sk: WEAK_TUNE.sk,
  sc: WEAK_TUNE.sc,
  sGain: WEAK_TUNE.sGain * LOW_SCALE,
  sMax: WEAK_TUNE.sMax * LOW_SCALE,
};
const TUNE: Record<Exclude<PuruKind, "still">, Tune> = {
  firm: FIRM_TUNE,
  mid: FIRM_TUNE,
  soft: FIRM_TUNE,
  "firm-weak": WEAK_TUNE,
  "mid-weak": WEAK_TUNE,
  "soft-weak": WEAK_TUNE,
  "firm-low": LOW_TUNE,
  "mid-low": LOW_TUNE,
  "soft-low": LOW_TUNE,
};

type PuruRange = keyof typeof PURU_REACH;

/** Reach follows the range only. Strength must not pull that reach in or out. */
const RANGE: Record<Exclude<PuruKind, "still">, PuruRange> = {
  firm: "narrow",
  "firm-weak": "narrow",
  "firm-low": "narrow",
  mid: "normal",
  "mid-weak": "normal",
  "mid-low": "normal",
  soft: "wide",
  "soft-weak": "wide",
  "soft-low": "wide",
};

const REST_DRIVE: PuruDrive = { vx: 0, vy: 0, dScale: 0 };
const KIND_IDS = new Set<string>([...PURU_KINDS.map((kind) => kind.id), "still"]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampUnit(value: number): number {
  return clamp(value, 0, 1);
}

export function clampRadius(value: number): number {
  return clamp(value, PURU_RADIUS_MIN, PURU_RADIUS_MAX);
}

export function clampView(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return clamp(value, PURU_VIEW_MIN, PURU_VIEW_MAX);
}

export function markerView(marker: Pick<PuruMarker, "view">): number {
  return clampView(marker.view ?? 1);
}

/** True only when this marker was parked. Older saves have no flag and stay active. */
export function markerOff(marker: { off?: boolean } | null | undefined): boolean {
  return marker?.off === true;
}

export function normalizePuruMarkers(raw: unknown): PuruMarker[] | null {
  if (!raw || typeof raw !== "object") return null;
  const markers = (raw as { markers?: unknown }).markers;
  if (!Array.isArray(markers)) return null;
  const out: PuruMarker[] = [];
  const seen = new Set<number>();
  for (const entry of markers) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { id?: unknown; kind?: unknown; u?: unknown; v?: unknown; radius?: unknown; view?: unknown; off?: unknown };
    if (typeof row.id !== "number" || !Number.isFinite(row.id) || seen.has(row.id)) continue;
    if (typeof row.kind !== "string" || !KIND_IDS.has(row.kind)) continue;
    if (typeof row.u !== "number" || typeof row.v !== "number" || typeof row.radius !== "number") continue;
    if (!Number.isFinite(row.u) || !Number.isFinite(row.v) || !Number.isFinite(row.radius)) continue;
    seen.add(row.id);
    const marker: PuruMarker = {
      id: row.id,
      kind: row.kind as PuruKind,
      u: clampUnit(row.u),
      v: clampUnit(row.v),
      radius: clampRadius(row.radius),
    };
    if (typeof row.view === "number" && Number.isFinite(row.view)) marker.view = clampView(row.view);
    if (row.off === true) marker.off = true;
    out.push(marker);
  }
  return out;
}

export function nextPuruId(markers: readonly { id: number }[]): number {
  let max = 0;
  for (const marker of markers) if (marker.id > max) max = marker.id;
  return max + 1;
}

export function imagePoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { u: number; v: number; inside: boolean } {
  if (!(rect.width > 0) || !(rect.height > 0)) return { u: 0, v: 0, inside: false };
  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top) / rect.height;
  const inside = u >= 0 && u <= 1 && v >= 0 && v <= 1;
  return { u: clampUnit(u), v: clampUnit(v), inside };
}

/**
 * PC lightbox separates a click from a pull at this distance.
 * A press that stays under it is a click. Reaching it arms the drag and must not also click.
 */
export const PURU_DRAG_PX = 6;

export function pointerIsClick(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < PURU_DRAG_PX;
}

export type ImagePose = {
  width: number;
  height: number;
  /** Viewport top-left of the untransformed frame. */
  left: number;
  top: number;
  /** Parent perspective in pixels. 0 is orthographic. */
  perspective: number;
  pullX: number;
  pullY: number;
  /** Degrees. Same CSS order as the tilt element: translate, then rotateX, then rotateY. */
  rx: number;
  ry: number;
  shakeX: number;
  shakeY: number;
  shakeR: number;
  fxX: number;
  fxY: number;
  fxR: number;
  /** 1 is unscaled. The motion layer scales around the center before it rotates and moves. */
  fxS: number;
};

type Vec3 = { x: number; y: number; z: number };

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function rad(deg: number): number {
  return (finite(deg) * Math.PI) / 180;
}

function rot2(x: number, y: number, angle: number): { x: number; y: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: c * x - s * y, y: s * x + c * y };
}

function mulRotateY(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: c * p.x + s * p.z, y: p.y, z: -s * p.x + c * p.z };
}

function mulRotateX(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x, y: c * p.y - s * p.z, z: s * p.y + c * p.z };
}

function poseScale(pose: ImagePose): number {
  return pose.fxS > 0.02 ? pose.fxS : 0;
}

/** Viewport position of an image-local pixel after the lightbox CSS transforms. Null when it faces away. */
export function projectImagePoint(px: number, py: number, pose: ImagePose): { x: number; y: number } | null {
  if (!(pose.width > 0) || !(pose.height > 0)) return null;
  const scale = poseScale(pose);
  if (!(scale > 0)) return null;
  let x = (px - pose.width / 2) * scale;
  let y = (py - pose.height / 2) * scale;
  const spun = rot2(x, y, rad(pose.fxR));
  x = spun.x + finite(pose.fxX);
  y = spun.y + finite(pose.fxY);
  const shaken = rot2(x, y, rad(pose.shakeR));
  x = shaken.x + finite(pose.shakeX);
  y = shaken.y + finite(pose.shakeY);
  let p = mulRotateY({ x, y, z: 0 }, rad(pose.ry));
  p = mulRotateX(p, rad(pose.rx));
  p = { x: p.x + finite(pose.pullX), y: p.y + finite(pose.pullY), z: p.z };
  let projX = p.x;
  let projY = p.y;
  if (pose.perspective > 0) {
    const w = 1 - p.z / pose.perspective;
    if (!(w > 0.02)) return null;
    projX = p.x / w;
    projY = p.y / w;
  }
  return { x: pose.left + pose.width / 2 + projX, y: pose.top + pose.height / 2 + projY };
}

function unprojectPlane(sx: number, sy: number, pose: ImagePose): { x: number; y: number } | null {
  const a = rad(-pose.rx);
  const b = rad(-pose.ry);
  const cx = Math.cos(a);
  const sxr = Math.sin(a);
  const cy = Math.cos(b);
  const syr = Math.sin(b);
  const finish = (x: number, y: number, z: number) => {
    const y1 = cx * y - sxr * z;
    const z1 = sxr * y + cx * z;
    return { x: cy * x + syr * z1, y: y1 };
  };
  if (!(pose.perspective > 0)) {
    const denom = cy * cx;
    if (Math.abs(denom) < 1e-5) return null;
    const x = sx - finite(pose.pullX);
    const y = sy - finite(pose.pullY);
    const z = (syr * x - cy * sxr * y) / denom;
    if (!Number.isFinite(z)) return null;
    return finish(x, y, z);
  }
  const d = pose.perspective;
  const ax = sx;
  const bx = -finite(pose.pullX);
  const ay = sy;
  const by = -finite(pose.pullY);
  const az = -d;
  const bz = d;
  const slope = -syr * ax + cy * sxr * ay + cy * cx * az;
  const intercept = -syr * bx + cy * sxr * by + cy * cx * bz;
  if (Math.abs(slope) < 1e-8) return null;
  const t = -intercept / slope;
  if (!(t > 0.02) || !Number.isFinite(t)) return null;
  return finish(ax * t + bx, ay * t + by, az * t + bz);
}

function undoLayer(x: number, y: number, rotDeg: number, tx: number, ty: number, scale: number): { x: number; y: number } | null {
  if (!(scale > 0.02)) return null;
  const shifted = rot2(x - tx, y - ty, rad(-rotDeg));
  return { x: shifted.x / scale, y: shifted.y / scale };
}

/**
 * Map a viewport click back into the image.
 * Undoes perspective, tilt, pull, shake, and the animation move / turn / scale
 * so the mesh dent lands on the pixel under the pointer.
 */
export function imagePointFromPose(clientX: number, clientY: number, pose: ImagePose): { u: number; v: number; inside: boolean } {
  if (!(pose.width > 0) || !(pose.height > 0) || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return { u: 0, v: 0, inside: false };
  const sx = clientX - (pose.left + pose.width / 2);
  const sy = clientY - (pose.top + pose.height / 2);
  const plane = unprojectPlane(sx, sy, pose);
  if (!plane) return { u: 0, v: 0, inside: false };
  const unshaken = undoLayer(plane.x, plane.y, pose.shakeR, finite(pose.shakeX), finite(pose.shakeY), 1);
  if (!unshaken) return { u: 0, v: 0, inside: false };
  const local = undoLayer(unshaken.x, unshaken.y, pose.fxR, finite(pose.fxX), finite(pose.fxY), poseScale(pose));
  if (!local) return { u: 0, v: 0, inside: false };
  const u = (local.x + pose.width / 2) / pose.width;
  const v = (local.y + pose.height / 2) / pose.height;
  const inside = u >= -0.001 && v >= -0.001 && u <= 1.001 && v <= 1.001;
  return { u: clampUnit(u), v: clampUnit(v), inside };
}

/** Pinch distance scales the selected marker only, and stays inside the radius limits. */
export function pinchRadius(startRadius: number, startDist: number, dist: number): number {
  if (!(startDist > 0) || !(dist > 0)) return clampRadius(startRadius);
  return clampRadius((startRadius * dist) / startDist);
}

export function restBody(): PuruBody {
  return { ox: 0, oy: 0, vx: 0, vy: 0, os: 0, vs: 0 };
}

/** Smooth falloff: 1 at the marker, 0 at the rim, no hard edge. */
export function falloff(dist: number, radius: number): number {
  if (radius <= 0 || dist >= radius) return 0;
  if (dist <= 0) return 1;
  const remain = 1 - dist / radius;
  return remain * remain * (3 - 2 * remain);
}

/** How many times the drawn circle the effect still reaches. A pin uses the normal range. */
export function puruReach(kind: PuruKind): number {
  if (kind === "still") return PURU_REACH.normal;
  return PURU_REACH[RANGE[kind]];
}

/**
 * Distance weight for this marker. 1 at the center, 0 at the reach, the same curve for every kind.
 * A pin uses it to hold the mesh still. The others use it to spread the wobble.
 */
export function influence(dist: number, drawn: number, kind: PuruKind): number {
  return falloff(dist, drawn * puruReach(kind));
}

function rgba(color: string, alpha: number): string {
  const n = Number.parseInt(color.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

/** Halo for the influence outside the circle. About 40% at the rim, fading to nothing at the real edge. */
export function puruHaloBackground(color: string, kind: PuruKind): string {
  const spread = puruReach(kind);
  const rim = 1 / spread;
  const base = falloff(rim, 1);
  const stops = [`transparent ${Math.max(0, rim * 100 - 0.8).toFixed(2)}%`];
  for (let i = 0; i <= 4; i++) {
    const t = rim + ((1 - rim) * i) / 4;
    const weight = base > 0 ? falloff(Math.min(t, 0.999999), 1) / base : 0;
    stops.push(`${rgba(color, i === 4 ? 0 : 0.4 * weight)} ${(t * 100).toFixed(2)}%`);
  }
  return `radial-gradient(circle, ${stops.join(", ")})`;
}

export function stepBody(body: PuruBody, kind: PuruKind, drive: PuruDrive, dt: number, space = 1): PuruBody {
  if (kind === "still") return restBody();
  const tune = TUNE[kind];
  const step = clamp(dt, 0, 0.05);
  const reach = tune.max * (space > 0 ? space : 1);
  const tx = clamp(-drive.vx * tune.gain, -reach, reach);
  const ty = clamp(-drive.vy * tune.gain, -reach, reach);
  const ts = clamp(-drive.dScale * tune.sGain, -tune.sMax, tune.sMax);
  const vx = body.vx + (tune.k * (tx - body.ox) - tune.c * body.vx) * step;
  const vy = body.vy + (tune.k * (ty - body.oy) - tune.c * body.vy) * step;
  const vs = body.vs + (tune.sk * (ts - body.os) - tune.sc * body.vs) * step;
  return { ox: body.ox + vx * step, oy: body.oy + vy * step, os: body.os + vs * step, vx, vy, vs };
}

export function stepBodies(markers: PuruMarker[], bodies: Map<number, PuruBody>, drive: PuruDrive, dt: number, space = 1): PuruBody[] {
  const live = new Set<number>();
  const next: PuruBody[] = [];
  for (const marker of markers) {
    live.add(marker.id);
    if (markerOff(marker)) {
      const parked = restBody();
      bodies.set(marker.id, parked);
      next.push(parked);
      continue;
    }
    const stepped = stepBody(bodies.get(marker.id) ?? restBody(), marker.kind, drive, dt, space);
    bodies.set(marker.id, stepped);
    next.push(stepped);
  }
  for (const id of bodies.keys()) if (!live.has(id)) bodies.delete(id);
  return next;
}

/**
 * The pixel spring cap was balanced on a picture about this short side.
 * Animation travel grows with the picture. PC frames are larger, so the cap has to grow with them
 * or the deformation saturates and no longer follows the motion. Phone keeps a space of 1.
 */
export const PURU_MOTION_REF = 360;

export function puruMotionSpace(minSide: number, followSize: boolean): number {
  if (!followSize || !(minSide > 0)) return 1;
  return minSide / PURU_MOTION_REF;
}

/**
 * Velocity of the whole-image animation, in the image's own pixels.
 * A stopped or jumped clock contributes nothing, so the springs can settle.
 */
export function driveFromMotion(prev: PuruSample | null, next: PuruSample, now: number): PuruDrive {
  if (!prev || next.t <= 0 || now - next.t > 48 || next.t <= prev.t) return REST_DRIVE;
  const dt = (next.t - prev.t) / 1000;
  if (dt <= 0.001 || dt >= 0.08) return REST_DRIVE;
  let vx = (next.x - prev.x) / dt;
  let vy = (next.y - prev.y) / dt;
  let dScale = (next.scale - prev.scale) / dt;
  if (Math.hypot(vx, vy) > 2800) {
    vx = 0;
    vy = 0;
  }
  if (Math.abs(dScale) > 6) dScale = 0;
  return { vx, vy, dScale };
}

export function sampleShift(
  markers: PuruMarker[],
  bodies: PuruBody[],
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const minSide = Math.min(width, height);
  let dx = 0;
  let dy = 0;
  let weight = 0;
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const body = bodies[i];
    if (!marker || !body || markerOff(marker)) continue;
    const mx = marker.u * width;
    const my = marker.v * height;
    const drawn = Math.max(1, markerDrawnRadius(marker, minSide));
    const dist = Math.hypot(x - mx, y - my);
    if (marker.kind === "still") continue;
    const w = influence(dist, drawn, marker.kind);
    if (w <= 0) continue;
    dx += w * (body.ox + (x - mx) * body.os);
    dy += w * (body.oy + (y - my) * body.os);
    weight += w;
  }
  if (weight > 1) {
    dx /= weight;
    dy /= weight;
  }
  const cap = minSide * 0.3;
  const mag = Math.hypot(dx, dy);
  if (mag > cap && mag > 0) {
    const scale = cap / mag;
    dx *= scale;
    dy *= scale;
  }
  const hold = stillHold(markers, x, y, width, height);
  if (hold > 0) {
    const open = 1 - hold;
    dx *= open;
    dy *= open;
  }
  return { x: dx, y: dy };
}

/** Strongest deformable marker here. Pins and empty space are 0, so nothing invents a mesh. */
export function puruDeformWeight(
  markers: readonly Pick<PuruMarker, "kind" | "u" | "v" | "radius" | "view" | "off">[],
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  if (!(width > 0) || !(height > 0) || markers.length === 0) return 0;
  const minSide = Math.min(width, height);
  let weight = 0;
  for (const marker of markers) {
    if (marker.kind === "still" || markerOff(marker)) continue;
    const drawn = marker.radius * markerView(marker) * minSide;
    if (!(drawn > 0)) continue;
    const next = influence(Math.hypot(x - marker.u * width, y - marker.v * height), drawn, marker.kind);
    if (next > weight) weight = next;
  }
  return weight;
}

export type PuruView = {
  /** Same signs as the lightbox tilt: +rx lifts the top, +ry presses the right. */
  rx: number;
  ry: number;
  /** Rubber pull in screen pixels. Independent of the tilt. */
  pullX: number;
  pullY: number;
  /** Where the pointer grabbed, 0–1. */
  grabU: number;
  grabV: number;
  /** Pull and tilt speed. Optional. A fast gesture pushes harder, then the spring settles. */
  vx?: number;
  vy?: number;
  drx?: number;
  dry?: number;
};

export const PURU_VIEW_REST: PuruView = { rx: 0, ry: 0, pullX: 0, pullY: 0, grabU: 0.5, grabV: 0.5 };

export type PuruViewBody = PuruView & { vrx: number; vry: number; vpx: number; vpy: number };

export function restViewBody(): PuruViewBody {
  return { rx: 0, ry: 0, pullX: 0, pullY: 0, grabU: 0.5, grabV: 0.5, vrx: 0, vry: 0, vpx: 0, vpy: 0 };
}

function springAxis(pos: number, vel: number, goal: number, omega: number, step: number): { p: number; v: number } {
  const zeta = 0.48;
  const accel = -2 * zeta * omega * vel - omega * omega * (pos - goal);
  const v = vel + accel * step;
  return { p: pos + v * step, v };
}

/** Tilt and pull each chase their own target, slower than the picture, so the mesh lags. */
export function stepView(body: PuruViewBody, target: PuruView, dt: number): PuruViewBody {
  const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
  const rx = springAxis(body.rx, body.vrx, Number.isFinite(target.rx) ? target.rx : 0, 12, step);
  const ry = springAxis(body.ry, body.vry, Number.isFinite(target.ry) ? target.ry : 0, 12, step);
  const pullX = springAxis(body.pullX, body.vpx, Number.isFinite(target.pullX) ? target.pullX : 0, 7.2, step);
  const pullY = springAxis(body.pullY, body.vpy, Number.isFinite(target.pullY) ? target.pullY : 0, 7.2, step);
  return {
    rx: rx.p,
    ry: ry.p,
    pullX: pullX.p,
    pullY: pullY.p,
    grabU: clampUnit(target.grabU),
    grabV: clampUnit(target.grabV),
    vrx: rx.v,
    vry: ry.v,
    vpx: pullX.v,
    vpy: pullY.v,
  };
}

/** Strongest pin at this point. Overlapping pins do not stack past the nearer one. */
export function stillHold(markers: readonly PuruMarker[], x: number, y: number, width: number, height: number): number {
  const minSide = Math.min(width, height);
  let hold = 0;
  for (const marker of markers) {
    if (marker.kind !== "still" || markerOff(marker)) continue;
    const drawn = markerDrawnRadius(marker, minSide);
    if (!(drawn > 0)) continue;
    const weight = influence(Math.hypot(x - marker.u * width, y - marker.v * height), drawn, marker.kind);
    if (weight > hold) hold = weight;
  }
  return hold;
}

/**
 * Extra mesh shift for the PC lightbox pose.
 * Tilt squashes toward the pressed side. Pull stretches from the grab, fading out,
 * and marker reach/strength scales it. Still circles are left to the caller.
 */
export function viewShift(
  markers: readonly PuruMarker[],
  view: PuruView,
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (!(width > 0) || !(height > 0)) return { x: 0, y: 0 };
  const presence = puruDeformWeight(markers, x, y, width, height);
  if (presence <= 0) return { x: 0, y: 0 };
  const minSide = Math.min(width, height);
  const nx = (x / width - 0.5) * 2;
  const ny = (y / height - 0.5) * 2;
  const tiltY = clamp(view.ry, -12, 12) / 8;
  const tiltX = clamp(view.rx, -12, 12) / 8;
  let dx = -tiltY * nx * minSide * 0.045 + -tiltX * nx * ny * minSide * 0.01;
  let dy = -tiltX * ny * minSide * 0.045 + tiltY * nx * ny * minSide * 0.01;
  const grabX = clampUnit(view.grabU) * width;
  const grabY = clampUnit(view.grabV) * height;
  const local = falloff(Math.hypot(x - grabX, y - grabY), minSide * 0.85);
  let gain = 0.28;
  let sum = 0;
  for (const marker of markers) {
    if (marker.kind === "still" || markerOff(marker)) continue;
    const drawn = Math.max(1, markerDrawnRadius(marker, minSide));
    const weight = influence(Math.hypot(x - marker.u * width, y - marker.v * height), drawn, marker.kind);
    sum += weight * (TUNE[marker.kind].gain / FIRM_TUNE.gain);
  }
  gain += 0.72 * Math.min(1.15, sum);
  dx += (Number.isFinite(view.pullX) ? view.pullX : 0) * 0.42 * local * gain;
  dy += (Number.isFinite(view.pullY) ? view.pullY : 0) * 0.42 * local * gain;
  const vx = Number.isFinite(view.vx) ? clamp(view.vx ?? 0, -1600, 1600) : 0;
  const vy = Number.isFinite(view.vy) ? clamp(view.vy ?? 0, -1600, 1600) : 0;
  const drx = Number.isFinite(view.drx) ? clamp(view.drx ?? 0, -160, 160) : 0;
  const dry = Number.isFinite(view.dry) ? clamp(view.dry ?? 0, -160, 160) : 0;
  const rush = Math.min(1.6, Math.hypot(vx, vy) / 700);
  dx += vx * 0.016 * (0.45 + rush);
  dy += vy * 0.016 * (0.45 + rush);
  dx += dry * 0.09;
  dy += drx * 0.09;
  dx *= presence;
  dy *= presence;
  const cap = minSide * 0.18;
  const mag = Math.hypot(dx, dy);
  if (mag > cap && mag > 0) {
    const scale = cap / mag;
    dx *= scale;
    dy *= scale;
  }
  return { x: dx, y: dy };
}

/**
 * One click poke on the mesh. Display only — never written with the markers.
 * Positive amp pushes neighbors outward from (u, v). The spring then swings back through rest.
 */
export type PuruHit = {
  u: number;
  v: number;
  amp: number;
  vel: number;
  age: number;
};

/** How many pokes can overlap. Older, weaker ones drop off past this. */
export const PURU_HIT_LIMIT = 5;
/** Falloff radius as a fraction of the shorter side. Same smooth curve as a marker, not a hard cut. */
export const PURU_HIT_REACH = 0.48;
const HIT_K = 190;
const HIT_C = 8.2;
const HIT_LIFE = 2.2;

export function hitKick(minSide: number): number {
  return Math.max(1, minSide) * 1.85;
}

function hitEnergy(hit: PuruHit): number {
  return hit.amp * hit.amp + (hit.vel * hit.vel) / (HIT_K * HIT_K);
}

function trimHits(hits: readonly PuruHit[]): PuruHit[] {
  const finiteHits = hits.filter((hit) => Number.isFinite(hit.amp) && Number.isFinite(hit.vel) && Number.isFinite(hit.u) && Number.isFinite(hit.v));
  if (finiteHits.length <= PURU_HIT_LIMIT) return finiteHits;
  const ranked = finiteHits.map((hit, index) => ({ hit, index, energy: hitEnergy(hit) }));
  ranked.sort((a, b) => a.energy - b.energy);
  const drop = new Set(ranked.slice(0, finiteHits.length - PURU_HIT_LIMIT).map((row) => row.index));
  return finiteHits.filter((_, index) => !drop.has(index));
}

/** Add a click. A second poke on the same spot stacks into that spring, with a cap, instead of resetting it. */
export function enqueueHit(hits: readonly PuruHit[], u: number, v: number, minSide: number): PuruHit[] {
  const kick = hitKick(minSide);
  const cap = kick * 1.45;
  const next = hits.map((hit) => ({ ...hit }));
  const u1 = clampUnit(u);
  const v1 = clampUnit(v);
  const near = Math.max(18, minSide * 0.035);
  const live = next.find((hit) => Math.hypot((hit.u - u1) * minSide, (hit.v - v1) * minSide) <= near);
  if (live) live.vel = clamp(live.vel + kick, -cap, cap);
  else next.push({ u: u1, v: v1, amp: 0, vel: kick, age: 0 });
  return trimHits(next);
}

export function stepHits(hits: readonly PuruHit[], dt: number, minSide: number): PuruHit[] {
  const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
  if (!(step > 0)) return trimHits(hits);
  const ampCap = Math.max(8, Math.max(1, minSide) * 0.12);
  const out: PuruHit[] = [];
  for (const hit of hits) {
    if (!Number.isFinite(hit.amp) || !Number.isFinite(hit.vel)) continue;
    const accel = -HIT_K * hit.amp - HIT_C * hit.vel;
    let vel = hit.vel + accel * step;
    let amp = hit.amp + vel * step;
    if (Math.abs(amp) > ampCap) {
      amp = Math.sign(amp) * ampCap;
      vel *= 0.35;
    }
    const age = hit.age + step;
    if (age > HIT_LIFE) continue;
    if (Math.abs(amp) < 0.35 && Math.abs(vel) < 12) continue;
    out.push({ u: hit.u, v: hit.v, amp, vel, age });
  }
  return out;
}

/** Outward ripple around a click. Only the puru mesh that already exists can move, and it fades past the circle. */
export function impulseShift(
  hits: readonly PuruHit[],
  x: number,
  y: number,
  width: number,
  height: number,
  markers: readonly PuruMarker[] = [],
): { x: number; y: number } {
  if (!hits.length || !(width > 0) || !(height > 0)) return { x: 0, y: 0 };
  const presence = puruDeformWeight(markers, x, y, width, height);
  if (presence <= 0) return { x: 0, y: 0 };
  const minSide = Math.min(width, height);
  let dx = 0;
  let dy = 0;
  for (const hit of hits) {
    if (!Number.isFinite(hit.amp) || hit.amp === 0) continue;
    const hx = clampUnit(hit.u) * width;
    const hy = clampUnit(hit.v) * height;
    const ox = x - hx;
    const oy = y - hy;
    const dist = Math.hypot(ox, oy);
    if (dist < 0.001) continue;
    const spread = 1 + 0.35 * Math.min(Math.max(hit.age, 0), 1.4);
    const drawn = Math.max(12, minSide * 0.2) * spread;
    const weight = influence(dist, drawn, "mid");
    if (weight <= 0) continue;
    dx += (ox / dist) * weight * hit.amp;
    dy += (oy / dist) * weight * hit.amp;
  }
  dx *= presence;
  dy *= presence;
  const cap = minSide * 0.16;
  const mag = Math.hypot(dx, dy);
  if (mag > cap && mag > 0) {
    const scale = cap / mag;
    dx *= scale;
    dy *= scale;
  }
  return { x: dx, y: dy };
}

export function fillDisplacement(
  markers: PuruMarker[],
  bodies: PuruBody[],
  width: number,
  height: number,
  out: Float32Array,
  view: PuruView | null = null,
  hits: readonly PuruHit[] | null = null,
): void {
  const cols = PURU_GRID;
  const liveHits = hits && hits.length ? hits : null;
  for (let row = 0; row < cols; row++) {
    const y = (row / (cols - 1)) * height;
    for (let col = 0; col < cols; col++) {
      const x = (col / (cols - 1)) * width;
      const base = sampleShift(markers, bodies, x, y, width, height);
      let dx = base.x;
      let dy = base.y;
      if (view || liveHits) {
        const open = 1 - stillHold(markers, x, y, width, height);
        if (view) {
          const extra = viewShift(markers, view, x, y, width, height);
          dx += extra.x * open;
          dy += extra.y * open;
        }
        if (liveHits) {
          const poke = impulseShift(liveHits, x, y, width, height, markers);
          dx += poke.x * open;
          dy += poke.y * open;
        }
      }
      const index = (row * cols + col) * 2;
      out[index] = dx;
      out[index + 1] = dy;
    }
  }
}

/** Nearest marker handle in screen pixels, or null when the tap is empty. */
export function pickMarker(markers: PuruMarker[], u: number, v: number, width: number, height: number): number | null {
  const minSide = Math.min(width, height);
  let best: { id: number; dist: number } | null = null;
  for (const marker of markers) {
    const dist = Math.hypot((marker.u - u) * width, (marker.v - v) * height);
    const handle = Math.max(28, marker.radius * minSide * 0.45);
    if (dist <= handle && (!best || dist < best.dist)) best = { id: marker.id, dist };
  }
  return best?.id ?? null;
}

/** Drawn radius in pixels. View only changes the ring, not a separate stored size. */
export function markerDrawnRadius(marker: PuruMarker, minSide: number): number {
  return marker.radius * markerView(marker) * minSide;
}

/** Influence radius whose drawn rim is `dist` pixels from the center. */
export function radiusAtRim(dist: number, view: number, minSide: number): number {
  const scale = markerView({ view }) * minSide;
  if (!(scale > 0) || !(dist > 0)) return clampRadius(PURU_RADIUS_MIN);
  return clampRadius(dist / scale);
}

/** View whose drawn rim is `dist` pixels from the center. */
export function viewAtRim(dist: number, radius: number, minSide: number): number {
  const scale = radius * minSide;
  if (!(scale > 0) || !(dist > 0)) return PURU_VIEW_MIN;
  return clampView(dist / scale);
}

/** Resize on the rim of the selected marker. Anywhere else on a marker moves it. */
export function puruEditHit(
  markers: readonly PuruMarker[],
  selectedId: number | null,
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { action: "resize" | "move"; id: number } | null {
  const minSide = Math.min(rect.width, rect.height);
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (selectedId !== null) {
    const marker = markers.find((entry) => entry.id === selectedId);
    if (marker) {
      const drawn = markerDrawnRadius(marker, minSide);
      const dist = Math.hypot(x - marker.u * rect.width, y - marker.v * rect.height);
      if (drawn > 0 && Math.abs(dist - drawn) <= 14) return { action: "resize", id: marker.id };
    }
  }
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  const id = pickMarker(markers as PuruMarker[], x / rect.width, y / rect.height, rect.width, rect.height);
  return id === null ? null : { action: "move", id };
}

/** White streak matching `.lightbox-sheen`, in image UV. 0 outside the band. */
export function meshSheen(u: number, v: number, x: number, y: number, opacity: number, turnDeg: number): number {
  if (!(opacity > 0) || !Number.isFinite(u) || !Number.isFinite(v)) return 0;
  const rad = ((Number.isFinite(turnDeg) ? turnDeg : 0) * Math.PI) / 180;
  const tx = ((Number.isFinite(x) ? x : 0) / 100) * 1.84;
  const ty = ((Number.isFinite(y) ? y : 0) / 100) * 1.84;
  const px = u - 0.5 - tx;
  const py = v - 0.5 - ty;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const ex = (c * px + s * py) / 1.84 + 0.5;
  const ey = (-s * px + c * py) / 1.84 + 0.5;
  const ang = (108 * Math.PI) / 180;
  const dirX = Math.sin(ang);
  const dirY = -Math.cos(ang);
  const extent = 0.5 * (Math.abs(dirX) + Math.abs(dirY));
  const g = ((ex - 0.5) * dirX + (ey - 0.5) * dirY) / (2 * extent) + 0.5;
  const d = Math.abs(g - 0.5);
  let band = 0;
  if (d < 0.04) band = 0.5 + (0.16 - 0.5) * (d / 0.04);
  else if (d < 0.14) band = 0.16 * (1 - (d - 0.04) / 0.1);
  return band * opacity;
}
