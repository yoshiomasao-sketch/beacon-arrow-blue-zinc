/**
 * Vector markers stimulate an existing puru mesh. They never build a mesh of their own.
 * A vertex moves only where a deformable puru marker already reaches, and only by the
 * overlap with this marker's「普通」falloff. Playback hides the rings.
 */

import { hitUnit } from "./image-animation.ts";
import { clampRadius, clampUnit, clampView, influence, markerView, puruDeformWeight, puruHaloBackground, puruKindFace, type PuruKind, type PuruMarker } from "./purupuru.ts";

export { puruDeformWeight };

export type VectorKind = "orbit" | "orbitBack" | "sway" | "hit" | "buzz";
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
};

export type VectorPose = { x: number; y: number; rotate: number };

export const VECTOR_KINDS: { id: VectorKind; label: string; hint: string; color: string }[] = [
  { id: "orbit", label: "円", hint: "時計回り", color: "#3DABFF" },
  { id: "orbitBack", label: "逆円", hint: "反時計回り", color: "#8B7CFF" },
  { id: "sway", label: "揺れ", hint: "往復", color: "#3DDC97" },
  { id: "hit", label: "打ち付け", hint: "打ち付け", color: "#FF5A7A" },
  { id: "buzz", label: "バイブ", hint: "振動", color: "#E6C35C" },
];

export const VECTOR_PACES: { id: VectorPace; label: string }[] = [
  { id: "slow", label: "遅" },
  { id: "normal", label: "普通" },
  { id: "fast", label: "速" },
];

export type MarkerListEntry = {
  id: number;
  group: "ぷるぷる" | "ベクトル";
  name: string;
  pace: string | null;
};

/** Array order is the addition order. Position, size, angle, and kind changes must not sort this. */
export function puruListEntries(markers: readonly Pick<PuruMarker, "id" | "kind">[]): MarkerListEntry[] {
  return markers.map((marker) => ({
    id: marker.id,
    group: "ぷるぷる",
    name: puruKindFace(marker.kind as PuruKind).label,
    pace: null,
  }));
}

export function vectorListEntries(markers: readonly Pick<VectorMarker, "id" | "kind" | "pace">[]): MarkerListEntry[] {
  return markers.map((marker) => ({
    id: marker.id,
    group: "ベクトル",
    name: vectorKindFace(marker.kind).label,
    pace: VECTOR_PACES.find((pace) => pace.id === marker.pace)?.label ?? null,
  }));
}

/**
 * Rings after ■ stops a running vector playback.
 * A favorite recall returns to the photo alone. A manual「マーカーを再生」shows the rings again, without entering placement.
 */
export function vectorShownAfterStop(source: "favorite" | "marker", phone: boolean, count: number): boolean {
  if (source === "favorite" || phone || !(count > 0)) return false;
  return true;
}

/** 「普通」matches the old fixed clock for 揺れ and 打ち付け. 「遅」is twice as long, 「速」is half. */
const PACE_TIME: Record<VectorPace, number> = { slow: 2, normal: 1, fast: 0.5 };

const CYCLE_MS: Record<Exclude<VectorKind, "buzz" | "orbit" | "orbitBack">, number> = {
  sway: 1600,
  hit: 1280,
};

/**
 * Orbit paces slide one step, and 逆円 shares them.
 * 遅 is the previous 普通: one turn in 2800ms, travel 0.34.
 * 普通 is the previous 速: one turn in 1400ms, travel 0.34.
 * 速 is a new wider circle at half that period, still one clean turn.
 */
const ORBIT_SLOW_MS = 2800;
const ORBIT_NORMAL_MS = 1400;
const ORBIT_FAST_MS = 700;
/** Fast path radius as a fraction of the drawn circle. Slow and normal stay at TRAVEL. */
const ORBIT_FAST_TRAVEL = 0.62;

/**
 * Buzz paces are not one waveform played slower.
 * 普通 is the previous 速: five swings in 520ms, amplitude unchanged.
 * 速 repeats that same swing faster, at a rate a 60fps mesh can still follow.
 * 遅 is one hard kick, an elastic return, then a full second of rest.
 */
const BUZZ_WAVES = 5;
const BUZZ_NORMAL_MS = 520;
const BUZZ_FAST_MS = 320;
const BUZZ_SLOW_PULSE_MS = 320;
const BUZZ_SLOW_WAIT_MS = 1000;
const BUZZ_SLOW_MS = BUZZ_SLOW_PULSE_MS + BUZZ_SLOW_WAIT_MS;
/** Kick peak relative to the shared 0.14 travel. About two and a half times 普通. */
const BUZZ_SLOW_GAIN = 2.5;

/** How far the center travels, as a fraction of the drawn radius. Buzz stays small except for its slow kick. */
const TRAVEL: Record<VectorKind, number> = {
  orbit: 0.34,
  orbitBack: 0.34,
  sway: 0.46,
  hit: 0.52,
  buzz: 0.14,
};

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
    if (pace === "slow") return BUZZ_SLOW_MS;
    if (pace === "fast") return BUZZ_FAST_MS;
    return BUZZ_NORMAL_MS;
  }
  if (kind === "orbit" || kind === "orbitBack") {
    if (pace === "slow") return ORBIT_SLOW_MS;
    if (pace === "fast") return ORBIT_FAST_MS;
    return ORBIT_NORMAL_MS;
  }
  return CYCLE_MS[kind] * PACE_TIME[pace];
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

function phaseOf(elapsedMs: number, cycle: number): number {
  if (!(cycle > 0)) return 0;
  const t = elapsedMs % cycle;
  return (t < 0 ? t + cycle : t) / cycle;
}

/**
 * One 遅 kick. 0 at rest, 1 at the top of a fast rise, then a small elastic
 * dip back to 0. The second of silence is not part of this curve.
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

/** 普通 and 速 share five swings. 遅 is the kick, then exact rest. Span is applied by the caller. */
function buzzUnit(pace: VectorPace, phase: number): number {
  if (pace === "slow") {
    const pulse = BUZZ_SLOW_PULSE_MS / BUZZ_SLOW_MS;
    if (!(phase < pulse)) return 0;
    return buzzKick(phase / pulse) * BUZZ_SLOW_GAIN;
  }
  return Math.sin(phase * Math.PI * 2 * BUZZ_WAVES);
}

/**
 * Motion of the marker center, in pixels, at full strength.
 * Orbit spins clockwise. Orbit-back only flips that spin.
 * Angle is a direction for sway, hit, and buzz, and a phase offset for the circles.
 */
export function vectorMotion(marker: Pick<VectorMarker, "kind" | "pace" | "angle" | "span">, elapsedMs: number, drawn: number): VectorPose {
  const radius = Math.max(0, drawn);
  const cycle = vectorCycle(marker.kind, marker.pace);
  const phase = phaseOf(elapsedMs, cycle);
  const travelScale = (marker.kind === "orbit" || marker.kind === "orbitBack") && marker.pace === "fast" ? ORBIT_FAST_TRAVEL : TRAVEL[marker.kind];
  const travel = radius * travelScale * vectorSpan(marker);
  const angle = wrapAngle(marker.angle);
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
      ? hitUnit(phase) * travel
      : marker.kind === "buzz"
        ? buzzUnit(marker.pace, phase) * travel
        : Math.sin(phase * Math.PI * 2) * travel;
  return {
    x: Math.cos(angle) * along,
    y: Math.sin(angle) * along,
    rotate: (angle * 180) / Math.PI,
  };
}

/** Full center motion times the「普通」falloff at `dist` pixels from the marker. */
export function vectorShift(marker: Pick<VectorMarker, "kind" | "pace" | "angle" | "span">, elapsedMs: number, dist: number, drawn: number): { x: number; y: number } {
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
  markers: readonly Pick<VectorMarker, "kind" | "pace" | "angle" | "span" | "u" | "v" | "radius" | "view">[],
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
    const drawn = marker.radius * markerView(marker) * minSide;
    if (!(drawn > 0)) continue;
    const dist = Math.hypot(x - marker.u * width, y - marker.v * height);
    const w = vectorWeight(dist, drawn);
    if (w <= 0) continue;
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
  vectors: readonly Pick<VectorMarker, "kind" | "pace" | "angle" | "span" | "u" | "v" | "radius" | "view">[],
  puru: readonly Pick<PuruMarker, "kind" | "u" | "v" | "radius" | "view">[],
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
    const row = entry as { id?: unknown; kind?: unknown; pace?: unknown; u?: unknown; v?: unknown; radius?: unknown; view?: unknown; angle?: unknown; span?: unknown };
    if (typeof row.id !== "number" || !Number.isFinite(row.id) || seen.has(row.id)) continue;
    if (typeof row.kind !== "string" || !KIND_IDS.has(row.kind)) continue;
    if (typeof row.u !== "number" || typeof row.v !== "number" || typeof row.radius !== "number") continue;
    if (!Number.isFinite(row.u) || !Number.isFinite(row.v) || !Number.isFinite(row.radius)) continue;
    seen.add(row.id);
    const marker: VectorMarker = {
      id: row.id,
      kind: row.kind as VectorKind,
      pace: typeof row.pace === "string" && PACE_IDS.has(row.pace) ? (row.pace as VectorPace) : "normal",
      u: clampUnit(row.u),
      v: clampUnit(row.v),
      radius: clampRadius(row.radius),
      angle: wrapAngle(typeof row.angle === "number" ? row.angle : 0),
      span: clampSpan(typeof row.span === "number" ? row.span : 1),
    };
    if (typeof row.view === "number" && Number.isFinite(row.view)) marker.view = clampView(row.view);
    out.push(marker);
  }
  return out;
}
