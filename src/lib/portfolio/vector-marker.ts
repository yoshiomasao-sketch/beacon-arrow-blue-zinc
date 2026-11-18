/**
 * Vector markers stimulate an existing puru mesh. They never build a mesh of their own.
 * A vertex moves only where a deformable puru marker already reaches, and only by the
 * overlap with this marker's「普通」falloff. Playback hides the rings.
 */

import { clampRadius, clampUnit, clampView, influence, markerOff, markerView, puruDeformWeight, puruHaloBackground, puruKindFace, type PuruKind, type PuruMarker } from "./purupuru.ts";

export { puruDeformWeight };

export type VectorKind = "orbit" | "orbitBack" | "sway" | "push" | "hit" | "expand" | "shrink" | "react" | "buzz";
export type VectorPace = "slow" | "normal" | "fast";

export type VectorMarker = {
  id: number;
  kind: VectorKind;
  pace: VectorPace;
  u: number;
  v: number;
  radius: number;
  /** Drawn size relative to the radius. Missing means 1. Same meaning as a puru marker. */
  view?: number;
  /** Screen radians. 0 points right, clockwise is positive. */
  angle: number;
  /**
   * How far the stimulus travels, compared with the standard amplitude.
   * 1 is today's default. It does not change the circle. Missing means 1.
   */
  span?: number;
  /** Parked. Missing means the marker still stimulates the mesh. */
  off?: boolean;
  /**
   * Half a cycle ahead of the shared clock. Missing means the downbeat.
   * The offset is half of this marker's own period, not a fixed number of seconds.
   */
  backbeat?: boolean;
};

export type VectorPose = { x: number; y: number; rotate: number };

export const VECTOR_KINDS: { id: VectorKind; label: string; hint: string; color: string }[] = [
  { id: "orbit", label: "円", hint: "時計回り", color: "#3DABFF" },
  { id: "orbitBack", label: "逆円", hint: "反時計回り", color: "#8B7CFF" },
  { id: "sway", label: "揺れ", hint: "往復", color: "#3DDC97" },
  { id: "push", label: "プッシュ", hint: "押し出し", color: "#C8F54A" },
  { id: "hit", label: "打ち付け", hint: "打ち付け", color: "#FF5A7A" },
  { id: "expand", label: "膨張", hint: "中心から外へ", color: "#FF9B3D" },
  { id: "shrink", label: "縮小", hint: "外から中心へ", color: "#3EC6E0" },
  { id: "react", label: "反応", hint: "反応", color: "#F08A3C" },
  { id: "buzz", label: "バイブ", hint: "振動", color: "#E6C35C" },
];

export const VECTOR_PACES: { id: VectorPace; label: string }[] = [
  { id: "slow", label: "遅" },
  { id: "normal", label: "普通" },
  { id: "fast", label: "速" },
];

export type MarkerListEntry = {
  id: number;
  group: "ぷるぷる" | "ベクトル" | "エフェクト";
  name: string;
  pace: string | null;
  /** Same color as the marker ring. Not a separate palette. */
  color: string;
  /** Parked. The row stays, but the marker does not deform. */
  off: boolean;
  /** Half a period ahead. Puru rows stay on the downbeat. */
  backbeat: boolean;
};

/** Array order is the addition order. Position, size, angle, and kind changes must not sort this. */
export function puruListEntries(markers: readonly Pick<PuruMarker, "id" | "kind" | "off">[]): MarkerListEntry[] {
  return markers.map((marker) => {
    const face = puruKindFace(marker.kind as PuruKind);
    return {
      id: marker.id,
      group: "ぷるぷる",
      name: face.label,
      pace: null,
      color: face.color,
      off: markerOff(marker),
      backbeat: false,
    };
  });
}

export function vectorListEntries(markers: readonly Pick<VectorMarker, "id" | "kind" | "pace" | "off" | "backbeat">[]): MarkerListEntry[] {
  return markers.map((marker) => {
    const face = vectorKindFace(marker.kind);
    return {
      id: marker.id,
      group: "ベクトル",
      name: face.label,
      pace: VECTOR_PACES.find((pace) => pace.id === marker.pace)?.label ?? null,
      color: face.color,
      off: markerOff(marker),
      backbeat: marker.backbeat === true,
    };
  });
}

/**
 * Rings stay hidden after ■ stops vector playback, whether it started
 * from a favorite or from「マーカーを再生」. Editing is a separate mode.
 */
export function vectorShownAfterStop(_source: "favorite" | "marker", _phone: boolean, _count: number): boolean {
  return false;
}

/** 「打ち付け」の普通。遅はその2倍の時間、速はその半分。速度比は遅:普通:速 = 1:2:4。 */
const HIT_NORMAL_MS = 1280;
/** 所要時間の倍率。速度はその逆数。 */
const PACE_TIME: Record<VectorPace, number> = { slow: 2, normal: 1, fast: 0.5 };

/**
 * 円・逆円・揺れ・打ち付け・膨張・縮小が共有する1ループ。
 * 軌道は変えず、ループの長さだけを打ち付けに揃える。
 */
function sharedCycle(pace: VectorPace): number {
  return HIT_NORMAL_MS * PACE_TIME[pace];
}

/**
 * 円の速だけ半径が広い。遅・普通は TRAVEL のまま。時間を揃えてもこの半径は変えない。
 * 逆円も同じ半径を使う。
 */
const ORBIT_FAST_TRAVEL = 0.62;

/**
 * バイブは、以前のバイブ・普通の5往復を基準にする。
 * 遅はその半分の速度、速は遅の4倍（普通の2倍）。
 * 普通は 512ms。打ち付け・遅の2ループ（5120ms）に、遅5回・普通10回・速20回で収まる。
 * 反応は、以前のバイブ・遅のキックと休み。普通は遅の2倍、速は遅の4倍。
 */
const BUZZ_WAVES = 5;
const BUZZ_NORMAL_MS = 512;
const BUZZ_SLOW_KICK_SHARE = 320;
const BUZZ_SLOW_REST_SHARE = 1000;
/** Kick peak relative to the shared 0.14 travel. About two and a half times 普通. */
const BUZZ_SLOW_GAIN = 2.5;
/**
 * Saved vector lists without this mark still store バイブ・遅 for the kick.
 * Reading one of those moves that marker to 反応・遅. New saves write the mark,
 * so a バイブ・遅 placed after this change stays a バイブ.
 */
export const VECTOR_VIBE = 2;

/** How far the center travels, as a fraction of the drawn radius. Buzz and react stay small; the react kick is louder. */
const TRAVEL: Record<Exclude<VectorKind, "expand" | "shrink">, number> = {
  orbit: 0.34,
  orbitBack: 0.34,
  sway: 0.46,
  push: 0.5,
  hit: 0.52,
  buzz: 0.14,
  react: 0.14,
};

/**
 * 膨張・縮小の強さ。点の移動量は、中心からの距離にこの倍率を掛け、既存の減衰を掛ける。
 * 中心では距離が 0 なので動かず、向きは決まらない。
 */
const RADIAL_GAIN = 0.85;

function radialKind(kind: VectorKind): kind is "expand" | "shrink" {
  return kind === "expand" || kind === "shrink";
}

/** One outward or inward pull. 0 at both ends of the cycle, 1 in the middle, flat slope at the seam. */
function radialPulse(phase: number): number {
  const t = ((phase % 1) + 1) % 1;
  const s = Math.sin(Math.PI * t);
  return s * s;
}

const KIND_IDS = new Set<string>(VECTOR_KINDS.map((kind) => kind.id));
const PACE_IDS = new Set<string>(VECTOR_PACES.map((pace) => pace.id));

/** Diamond sits this far past the length, so it stays off the resize handles. */
const DIAMOND_GAP = 22;
const SPAN_MIN = 0.2;
const SPAN_MAX = 2.5;

export function clampSpan(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(SPAN_MAX, Math.max(SPAN_MIN, value));
}

/** Missing span is the standard amplitude. The stored pace words are left alone. */
export function vectorSpan(marker: { span?: number }): number {
  return clampSpan(marker.span ?? 1);
}

/** Length from the center-to-pointer distance. The circle rim is span 1. */
export function spanFromDistance(dist: number, drawn: number): number {
  if (!(drawn > 0)) return 1;
  return clampSpan((dist - DIAMOND_GAP) / drawn);
}

export function vectorKindFace(kind: VectorKind) {
  return VECTOR_KINDS.find((entry) => entry.id === kind) ?? VECTOR_KINDS[0];
}

export function vectorCycle(kind: VectorKind, pace: VectorPace): number {
  if (kind === "buzz") {
    if (pace === "slow") return BUZZ_NORMAL_MS * 2;
    if (pace === "fast") return BUZZ_NORMAL_MS / 2;
    return BUZZ_NORMAL_MS;
  }
  if (kind === "react") {
    const slow = sharedCycle("normal");
    if (pace === "normal") return slow / 2;
    if (pace === "fast") return slow / 4;
    return slow;
  }
  return sharedCycle(pace);
}

/** GIFの収録時間。打ち付け・遅の2ループ。周期を変えるときはここから取る。 */
export function favoriteRecordMs(): number {
  return vectorCycle("hit", "slow") * 2;
}

export function wrapAngle(rad: number): number {
  if (!Number.isFinite(rad)) return 0;
  const turn = Math.PI * 2;
  const wrapped = rad % turn;
  return wrapped < 0 ? wrapped + turn : wrapped;
}

/** Same weight as a puru「普通」circle. 1 at the center, still alive just outside, 0 at the reach. */
export function vectorWeight(dist: number, drawn: number): number {
  return influence(dist, drawn, "mid");
}

export function vectorHalo(color: string): string {
  return puruHaloBackground(color, "mid");
}

/**
 * Phase inside one loop, from 0 up to but not including 1.
 * A backbeat marker is half a cycle ahead and stays there on every later loop.
 * Changing the period changes the offset with it. It is not a stored delay in milliseconds.
 */
export function cyclePhase(elapsedMs: number, cycle: number, backbeat = false): number {
  if (!(cycle > 0) || !Number.isFinite(elapsedMs)) return backbeat ? 0.5 : 0;
  const t = elapsedMs % cycle;
  const phase = (t < 0 ? t + cycle : t) / cycle;
  return backbeat ? (phase + 0.5) % 1 : phase;
}

/**
 * One 遅 kick. 0 at rest, 1 at the top of a fast rise, then a small elastic
 * dip back to 0. The rest after the kick is not part of this curve.
 */
function buzzKick(u: number): number {
  if (!(u > 0) || u >= 1) return 0;
  const attack = 0.18;
  if (u < attack) {
    const s = u / attack;
    return 1 - (1 - s) * (1 - s);
  }
  const w = (u - attack) / (1 - attack);
  let back = Math.exp(-2.6 * w) * Math.cos(w * Math.PI * 1.02);
  if (w > 0.78) back *= 1 - (w - 0.78) / 0.22;
  return back;
}

/** バイブは5往復。反応は以前のバイブ・遅と同じキックのあと休み。速度は周期だけを変える。 */
function buzzUnit(kind: "buzz" | "react", phase: number): number {
  if (kind === "react") {
    const pulse = BUZZ_SLOW_KICK_SHARE / (BUZZ_SLOW_KICK_SHARE + BUZZ_SLOW_REST_SHARE);
    if (!(phase < pulse)) return 0;
    return buzzKick(phase / pulse) * BUZZ_SLOW_GAIN;
  }
  return Math.sin(phase * Math.PI * 2 * BUZZ_WAVES);
}

/** One push from the center and back. 0 at both ends, 1 halfway, flat at the seam. */
function pushUnit(phase: number): number {
  const t = ((phase % 1) + 1) % 1;
  const s = Math.sin(Math.PI * t);
  return s * s;
}

/** Pull, a short hold, then a slam back to the center. The last piece is the impact stop. */
const HIT_PULL_END = 0.46;
const HIT_HOLD_END = 0.58;
const HIT_SLAM_END = 0.78;

function hitVectorUnit(phase: number): number {
  const t = ((phase % 1) + 1) % 1;
  if (t < HIT_PULL_END) {
    const u = t / HIT_PULL_END;
    return u * u * (3 - 2 * u);
  }
  if (t < HIT_HOLD_END) return 1;
  if (t < HIT_SLAM_END) {
    const u = (t - HIT_HOLD_END) / (HIT_SLAM_END - HIT_HOLD_END);
    return 1 - u * u * u;
  }
  return 0;
}

/**
 * Motion of the marker center, in pixels, at full strength.
 * Orbit spins clockwise. Orbit-back only flips that spin.
 * Angle is a direction for sway, push, hit, and buzz, and a phase offset for the circles.
 * Sway still travels both ways. Push and hit leave the center along the angle and come back.
 */
export function vectorMotion(marker: Pick<VectorMarker, "kind" | "pace" | "angle" | "span" | "backbeat">, elapsedMs: number, drawn: number): VectorPose {
  const angle = wrapAngle(marker.angle);
  if (radialKind(marker.kind)) {
    return { x: 0, y: 0, rotate: (angle * 180) / Math.PI };
  }
  const radius = Math.max(0, drawn);
  const cycle = vectorCycle(marker.kind, marker.pace);
  const phase = cyclePhase(elapsedMs, cycle, marker.backbeat === true);
  const travelScale = (marker.kind === "orbit" || marker.kind === "orbitBack") && marker.pace === "fast" ? ORBIT_FAST_TRAVEL : TRAVEL[marker.kind];
  const travel = radius * travelScale * vectorSpan(marker);
  if (marker.kind === "orbit" || marker.kind === "orbitBack") {
    const dir = marker.kind === "orbit" ? 1 : -1;
    const spin = angle + dir * phase * Math.PI * 2;
    return {
      x: Math.cos(spin) * travel,
      y: Math.sin(spin) * travel,
      rotate: (spin * 180) / Math.PI,
    };
  }
  const along =
    marker.kind === "hit"
      ? hitVectorUnit(phase) * travel
      : marker.kind === "push"
        ? pushUnit(phase) * travel
        : marker.kind === "buzz" || marker.kind === "react"
          ? buzzUnit(marker.kind, phase) * travel
          : Math.sin(phase * Math.PI * 2) * travel;
  return {
    x: Math.cos(angle) * along,
    y: Math.sin(angle) * along,
    rotate: (angle * 180) / Math.PI,
  };
}

/** Full center motion times the「普通」falloff at `dist` pixels from the marker. */
export function vectorShift(marker: Pick<VectorMarker, "kind" | "pace" | "angle" | "span" | "backbeat">, elapsedMs: number, dist: number, drawn: number): { x: number; y: number } {
  const pose = vectorMotion(marker, elapsedMs, drawn);
  const weight = vectorWeight(dist, drawn);
  return { x: pose.x * weight, y: pose.y * weight };
}

/**
 * Mesh displacement from every vector marker at one picture pixel.
 * Overlapping markers share the motion instead of stacking past full strength.
 * Outside the「普通」reach the shift is zero.
 */
export function vectorMeshShift(
  markers: readonly Pick<VectorMarker, "kind" | "pace" | "angle" | "span" | "u" | "v" | "radius" | "view" | "off" | "backbeat">[],
  elapsedMs: number,
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (!(width > 0) || !(height > 0) || markers.length === 0) return { x: 0, y: 0 };
  const minSide = Math.min(width, height);
  let dx = 0;
  let dy = 0;
  let weight = 0;
  for (const marker of markers) {
    if (markerOff(marker)) continue;
    const drawn = marker.radius * markerView(marker) * minSide;
    if (!(drawn > 0)) continue;
    const dist = Math.hypot(x - marker.u * width, y - marker.v * height);
    const w = vectorWeight(dist, drawn);
    if (w <= 0) continue;
    if (radialKind(marker.kind)) {
      const phase = cyclePhase(elapsedMs, vectorCycle(marker.kind, marker.pace), marker.backbeat === true);
      const gain = RADIAL_GAIN * vectorSpan(marker) * radialPulse(phase);
      const dir = marker.kind === "shrink" ? -1 : 1;
      const ox = x - marker.u * width;
      const oy = y - marker.v * height;
      dx += dir * ox * gain * w;
      dy += dir * oy * gain * w;
      weight += w;
      continue;
    }
    const pose = vectorMotion(marker, elapsedMs, drawn);
    dx += pose.x * w;
    dy += pose.y * w;
    weight += w;
  }
  if (weight > 1) {
    dx /= weight;
    dy /= weight;
  }
  return { x: dx, y: dy };
}

/**
 * Vector stimulus for one mesh vertex.
 * Zero unless a puru marker already deforms that spot. The two falloffs multiply,
 * so a wide vector circle cannot pull pixels the puru mesh does not cover.
 */
export function vectorOnMesh(
  vectors: readonly Pick<VectorMarker, "kind" | "pace" | "angle" | "span" | "u" | "v" | "radius" | "view" | "off" | "backbeat">[],
  puru: readonly Pick<PuruMarker, "kind" | "u" | "v" | "radius" | "view" | "off">[],
  elapsedMs: number,
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const presence = puruDeformWeight(puru, x, y, width, height);
  if (presence <= 0) return { x: 0, y: 0 };
  const shift = vectorMeshShift(vectors, elapsedMs, x, y, width, height);
  return { x: shift.x * presence, y: shift.y * presence };
}

/** Combined puru and vector shift. A lone source is left as it is. The sum cannot pass `cap`. */
export function capShift(shift: { x: number; y: number }, cap: number): { x: number; y: number } {
  const mag = Math.hypot(shift.x, shift.y);
  if (!(cap > 0) || !(mag > cap)) return { x: shift.x, y: shift.y };
  const scale = cap / mag;
  return { x: shift.x * scale, y: shift.y * scale };
}

export function vectorGeometry(
  marker: Pick<VectorMarker, "u" | "v" | "radius" | "view" | "angle" | "span">,
  rect: { width: number; height: number },
): { cx: number; cy: number; drawn: number; hx: number; hy: number } {
  const minSide = Math.min(rect.width, rect.height);
  const drawn = marker.radius * markerView({ view: marker.view }) * minSide;
  const cx = marker.u * rect.width;
  const cy = marker.v * rect.height;
  const reach = drawn * vectorSpan(marker) + DIAMOND_GAP;
  return {
    cx,
    cy,
    drawn,
    hx: cx + Math.cos(marker.angle) * reach,
    hy: cy + Math.sin(marker.angle) * reach,
  };
}

export function angleFromPoint(cx: number, cy: number, x: number, y: number): number {
  return wrapAngle(Math.atan2(y - cy, x - cx));
}

/** Diamond first, then the rim, then the inside of a circle. Angle and size never share a hit. */
export function vectorEditHit(
  markers: readonly VectorMarker[],
  selectedId: number | null,
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { action: "angle" | "resize" | "move"; id: number } | null {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (selectedId !== null) {
    const marker = markers.find((entry) => entry.id === selectedId);
    if (marker && rect.width > 0 && rect.height > 0) {
      const geo = vectorGeometry(marker, rect);
      if (Math.hypot(x - geo.hx, y - geo.hy) <= 13) return { action: "angle", id: marker.id };
      if (geo.drawn > 0 && Math.abs(Math.hypot(x - geo.cx, y - geo.cy) - geo.drawn) <= 12) return { action: "resize", id: marker.id };
    }
  }
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  let best: { id: number; dist: number } | null = null;
  for (const marker of markers) {
    const geo = vectorGeometry(marker, rect);
    const dist = Math.hypot(x - geo.cx, y - geo.cy);
    if (dist <= Math.max(18, geo.drawn * 0.72) && (!best || dist < best.dist)) best = { id: marker.id, dist };
  }
  return best ? { action: "move", id: best.id } : null;
}

export function nextVectorId(markers: readonly { id: number }[]): number {
  let max = 0;
  for (const marker of markers) if (marker.id > max) max = marker.id;
  return max + 1;
}

export function retargetVector(marker: VectorMarker, kind: VectorKind, pace: VectorPace): VectorMarker {
  return { ...marker, kind, pace };
}

export function normalizeVectorMarkers(raw: unknown): VectorMarker[] | null {
  if (!raw || typeof raw !== "object") return null;
  const markers = (raw as { markers?: unknown }).markers;
  if (!Array.isArray(markers)) return null;
  const out: VectorMarker[] = [];
  const seen = new Set<number>();
  for (const entry of markers) {
    if (!entry || typeof entry !== "object") continue;
    const legacy = (raw as { vibe?: unknown }).vibe !== VECTOR_VIBE;
    const row = entry as { id?: unknown; kind?: unknown; pace?: unknown; u?: unknown; v?: unknown; radius?: unknown; view?: unknown; angle?: unknown; span?: unknown; off?: unknown; backbeat?: unknown };
    if (typeof row.id !== "number" || !Number.isFinite(row.id) || seen.has(row.id)) continue;
    if (typeof row.kind !== "string" || !KIND_IDS.has(row.kind)) continue;
    if (typeof row.u !== "number" || typeof row.v !== "number" || typeof row.radius !== "number") continue;
    if (!Number.isFinite(row.u) || !Number.isFinite(row.v) || !Number.isFinite(row.radius)) continue;
    seen.add(row.id);
    let kind = row.kind as VectorKind;
    const pace = typeof row.pace === "string" && PACE_IDS.has(row.pace) ? (row.pace as VectorPace) : "normal";
    if (legacy && kind === "buzz" && pace === "slow") kind = "react";
    const marker: VectorMarker = {
      id: row.id,
      kind,
      pace,
      u: clampUnit(row.u),
      v: clampUnit(row.v),
      radius: clampRadius(row.radius),
      angle: wrapAngle(typeof row.angle === "number" ? row.angle : 0),
      span: clampSpan(typeof row.span === "number" ? row.span : 1),
    };
    if (typeof row.view === "number" && Number.isFinite(row.view)) marker.view = clampView(row.view);
    if (row.off === true) marker.off = true;
    if (row.backbeat === true) marker.backbeat = true;
    out.push(marker);
  }
  return out;
}
