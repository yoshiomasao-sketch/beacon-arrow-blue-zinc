/**
 * Image effects placed on a photo.
 * A kind names the motion. An asset names one transparent sheet.
 * Splash fades a still sheet. 黄金 warps splash_03 as a stream pinned at the right nozzle.
 */

import { vectorCycle, wrapAngle, type MarkerListEntry } from "./vector-marker.ts";

export const EFFECT_KINDS = [
  { id: "splash", label: "スプラッシュ", color: "#7ec8ff" },
  { id: "gold", label: "黄金", color: "#f0c14a" },
] as const;

export type EffectKind = (typeof EFFECT_KINDS)[number]["id"];

export type EffectPace = "slow" | "normal" | "fast";

export const EFFECT_PACES: { id: EffectPace; label: string }[] = [
  { id: "slow", label: "遅" },
  { id: "normal", label: "普通" },
  { id: "fast", label: "速" },
];

/** File name without the extension. These are the sheets that exist under reference/effect-assets. */
export const EFFECT_ASSET_IDS = ["splash_01", "splash_02", "splash_03"] as const;

export type EffectAssetId = (typeof EFFECT_ASSET_IDS)[number];

/** Pixel size of each sheet, read from the file. Used only to keep the picture's aspect. */
export const EFFECT_SHEETS: Record<EffectAssetId, { width: number; height: number }> = {
  splash_01: { width: 1240, height: 1268 },
  splash_02: { width: 1536, height: 1024 },
  splash_03: { width: 1774, height: 887 },
};

/** Which sheets a kind may show. */
export const EFFECT_KIND_ASSETS: Record<EffectKind, readonly EffectAssetId[]> = {
  splash: ["splash_01"],
  gold: ["splash_03"],
};

export type EffectMarker = {
  id: number;
  kind: EffectKind;
  asset: EffectAssetId;
  pace: EffectPace;
  /** Center, as a fraction of the image. */
  u: number;
  v: number;
  /** Width as a fraction of the shorter image side. Height follows the sheet. */
  size: number;
  /** Radians around the center. 0 points right. */
  angle: number;
  /** Parked. Missing means the splash still plays. */
  off?: boolean;
  /**
   * Half a cycle ahead of the shared clock. Missing means the downbeat.
   * The offset is half of this marker's own period, including the hidden gap.
   */
  backbeat?: boolean;
  /** Horizontal mirror. Missing means the sheet faces the way it was drawn. */
  flip?: boolean;
};

export const EFFECT_SIZE_MIN = 0.06;
export const EFFECT_SIZE_MAX = 1.6;
export const EFFECT_SIZE_DEFAULT = 0.34;

/**
 * Shares of 打ち付け・遅, before the pace scale.
 * The drawn splash always uses the 速 length of these shares.
 * 遅 and 普通 keep their longer loops by waiting after the splash is gone.
 */
const SLOW_FADE_IN = 100;
const SLOW_HOLD = 200;
const SLOW_FADE_OUT = 300;

const KIND_IDS = new Set<string>(EFFECT_KINDS.map((kind) => kind.id));
const PACE_IDS = new Set<string>(EFFECT_PACES.map((pace) => pace.id));
const ASSET_IDS = new Set<string>(EFFECT_ASSET_IDS);

const HANDLE = 14;
const ANGLE_GAP = 22;

export function effectKindFace(kind: EffectKind) {
  return EFFECT_KINDS.find((entry) => entry.id === kind) ?? EFFECT_KINDS[0];
}

export function effectAssetAspect(asset: EffectAssetId): number {
  const sheet = EFFECT_SHEETS[asset];
  return sheet.height > 0 ? sheet.width / sheet.height : 1;
}

/** 遅 is one loop of 打ち付け・遅. 普通 is half of that. 速 is a quarter. */
export function effectCycle(pace: EffectPace): number {
  const slow = vectorCycle("hit", "slow");
  if (pace === "fast") return slow / 4;
  if (pace === "normal") return slow / 2;
  return slow;
}

/** Position in the loop, 0..1. Backbeat starts half a cycle ahead and stays there. */
export function effectPhase(pace: EffectPace, elapsedMs: number, backbeat = false): number {
  const cycle = effectCycle(pace);
  if (!(cycle > 0) || !Number.isFinite(elapsedMs)) return 0;
  let t = elapsedMs % cycle;
  if (t < 0) t += cycle;
  let phase = t / cycle;
  if (backbeat) phase = (phase + 0.5) % 1;
  return phase;
}

/** Splash performance is always the 速 length. Extra loop time is a clear wait. */
function splashPerformance(): { fadeIn: number; hold: number; fadeOut: number } {
  const slow = vectorCycle("hit", "slow");
  const scale = slow > 0 ? effectCycle("fast") / slow : 1;
  return {
    fadeIn: SLOW_FADE_IN * scale,
    hold: SLOW_HOLD * scale,
    fadeOut: SLOW_FADE_OUT * scale,
  };
}

export function effectTimeline(pace: EffectPace): { cycle: number; fadeIn: number; hold: number; fadeOut: number; hidden: number } {
  const cycle = effectCycle(pace);
  const splash = splashPerformance();
  const play = splash.fadeIn + splash.hold + splash.fadeOut;
  if (!(cycle > 0)) return { cycle: 0, fadeIn: 0, hold: 0, fadeOut: 0, hidden: 0 };
  if (play > cycle && play > 0) {
    const fit = cycle / play;
    return {
      cycle,
      fadeIn: splash.fadeIn * fit,
      hold: splash.hold * fit,
      fadeOut: splash.fadeOut * fit,
      hidden: 0,
    };
  }
  return { cycle, fadeIn: splash.fadeIn, hold: splash.hold, fadeOut: splash.fadeOut, hidden: cycle - play };
}

/**
 * Opacity at `elapsedMs` after a shared start.
 * 0 at the seam, rises, holds, falls back to 0, then stays clear until the next loop.
 */
export function effectOpacity(pace: EffectPace, elapsedMs: number, backbeat = false): number {
  const span = effectTimeline(pace);
  if (!(span.cycle > 0) || !Number.isFinite(elapsedMs)) return 0;
  let t = elapsedMs % span.cycle;
  if (t < 0) t += span.cycle;
  if (backbeat) t = (t + span.cycle * 0.5) % span.cycle;
  if (t < span.fadeIn) return span.fadeIn > 0 ? t / span.fadeIn : 1;
  if (t < span.fadeIn + span.hold) return 1;
  const out = t - span.fadeIn - span.hold;
  if (out < span.fadeOut) return span.fadeOut > 0 ? 1 - out / span.fadeOut : 0;
  return 0;
}

export function clampEffectSize(value: number): number {
  if (!Number.isFinite(value)) return EFFECT_SIZE_DEFAULT;
  return Math.min(EFFECT_SIZE_MAX, Math.max(EFFECT_SIZE_MIN, value));
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

/** A press that travels at least 8px drops a marker at the release point. A click does not. */
export function effectDrop(dx: number, dy: number, u: number, v: number): { u: number; v: number } | null {
  if (![dx, dy, u, v].every((value) => Number.isFinite(value))) return null;
  if (Math.hypot(dx, dy) < 8) return null;
  return { u: clampUnit(u), v: clampUnit(v) };
}

/** Drawn width and height in pixels. The ratio is the sheet's, not the photo's. */
export function effectDrawSize(marker: Pick<EffectMarker, "asset" | "size">, frame: { width: number; height: number }): { w: number; h: number } {
  const minSide = Math.min(Math.max(0, frame.width), Math.max(0, frame.height));
  const w = clampEffectSize(marker.size) * minSide;
  const aspect = effectAssetAspect(marker.asset);
  return { w, h: aspect > 0 ? w / aspect : w };
}

export function effectListEntries(markers: readonly Pick<EffectMarker, "id" | "kind" | "pace" | "off" | "backbeat">[]): MarkerListEntry[] {
  return markers.map((marker) => {
    const face = effectKindFace(marker.kind);
    return {
      id: marker.id,
      group: "エフェクト",
      name: face.label,
      pace: EFFECT_PACES.find((pace) => pace.id === marker.pace)?.label ?? null,
      color: face.color,
      off: marker.off === true,
      backbeat: marker.backbeat === true,
    };
  });
}

export function nextEffectId(markers: readonly { id: number }[]): number {
  let max = 0;
  for (const marker of markers) if (marker.id > max) max = marker.id;
  return max + 1;
}

export function normalizeEffectMarkers(raw: unknown): EffectMarker[] | null {
  if (!raw || typeof raw !== "object") return null;
  const markers = Array.isArray(raw) ? raw : (raw as { markers?: unknown }).markers;
  if (!Array.isArray(markers)) return null;
  const out: EffectMarker[] = [];
  const seen = new Set<number>();
  for (const entry of markers) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { id?: unknown; kind?: unknown; asset?: unknown; pace?: unknown; u?: unknown; v?: unknown; size?: unknown; angle?: unknown; off?: unknown; backbeat?: unknown; flip?: unknown };
    if (typeof row.id !== "number" || !Number.isFinite(row.id) || seen.has(row.id)) continue;
    if (typeof row.kind !== "string" || !KIND_IDS.has(row.kind)) continue;
    const kind = row.kind as EffectKind;
    let asset = typeof row.asset === "string" ? row.asset : "";
    if (kind === "gold" && asset === "splash_02") asset = "splash_03";
    if (!ASSET_IDS.has(asset)) continue;
    if (!EFFECT_KIND_ASSETS[kind].includes(asset as EffectAssetId)) continue;
    if (typeof row.u !== "number" || typeof row.v !== "number" || typeof row.size !== "number") continue;
    if (![row.u, row.v, row.size].every((value) => Number.isFinite(value))) continue;
    seen.add(row.id);
    out.push({
      id: row.id,
      kind,
      asset: asset as EffectAssetId,
      pace: typeof row.pace === "string" && PACE_IDS.has(row.pace) ? (row.pace as EffectPace) : "normal",
      u: clampUnit(row.u),
      v: clampUnit(row.v),
      size: clampEffectSize(row.size),
      angle: wrapAngle(typeof row.angle === "number" ? row.angle : 0),
      ...(row.off === true ? { off: true } : {}),
      ...(row.backbeat === true ? { backbeat: true } : {}),
      ...(row.flip === true ? { flip: true } : {}),
    });
  }
  return out;
}

type Frame = { left: number; top: number; width: number; height: number };

function centerOf(marker: EffectMarker, rect: { width: number; height: number }) {
  return { x: marker.u * rect.width, y: marker.v * rect.height };
}

function toLocal(marker: EffectMarker, x: number, y: number, rect: { width: number; height: number }) {
  const center = centerOf(marker, rect);
  const dx = x - center.x;
  const dy = y - center.y;
  const cos = Math.cos(marker.angle);
  const sin = Math.sin(marker.angle);
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

function toScreen(marker: EffectMarker, lx: number, ly: number, rect: { width: number; height: number }) {
  const center = centerOf(marker, rect);
  const cos = Math.cos(marker.angle);
  const sin = Math.sin(marker.angle);
  return { x: center.x + lx * cos - ly * sin, y: center.y + lx * sin + ly * cos };
}

/** Diamond sits just past the right edge, in the marker's own axes. */
export function effectAngleHandle(marker: EffectMarker, rect: { width: number; height: number }): { x: number; y: number } {
  const draw = effectDrawSize(marker, rect);
  return toScreen(marker, draw.w / 2 + ANGLE_GAP, 0, rect);
}

export function effectCorners(marker: EffectMarker, rect: { width: number; height: number }): { x: number; y: number }[] {
  const draw = effectDrawSize(marker, rect);
  const hw = draw.w / 2;
  const hh = draw.h / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([lx, ly]) => toScreen(marker, lx!, ly!, rect));
}

/**
 * Grows or shrinks from the center. Width and height stay in the sheet's ratio.
 * The center and the angle do not move.
 */
export function effectResize(marker: EffectMarker, clientX: number, clientY: number, rect: Frame): EffectMarker {
  if (!(rect.width > 0) || !(rect.height > 0)) return marker;
  const draw = effectDrawSize(marker, rect);
  const half = Math.hypot(draw.w, draw.h) / 2;
  if (!(half > 1)) return marker;
  const center = centerOf(marker, rect);
  const dist = Math.hypot(clientX - rect.left - center.x, clientY - rect.top - center.y);
  const size = clampEffectSize(marker.size * (dist / half));
  return { ...marker, size };
}

/** Turns around the center. Position and size stay. */
export function effectTurn(marker: EffectMarker, clientX: number, clientY: number, rect: Frame): EffectMarker {
  if (!(rect.width > 0) || !(rect.height > 0)) return marker;
  const center = centerOf(marker, rect);
  const angle = wrapAngle(Math.atan2(clientY - rect.top - center.y, clientX - rect.left - center.x));
  return { ...marker, angle };
}

export function effectEditHit(
  markers: readonly EffectMarker[],
  selectedId: number | null,
  clientX: number,
  clientY: number,
  rect: Frame,
): { action: "angle" | "resize" | "move"; id: number } | null {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  if (selectedId !== null) {
    const marker = markers.find((entry) => entry.id === selectedId);
    if (marker) {
      const handle = effectAngleHandle(marker, rect);
      if (Math.hypot(x - handle.x, y - handle.y) <= HANDLE) return { action: "angle", id: marker.id };
      for (const corner of effectCorners(marker, rect)) {
        if (Math.hypot(x - corner.x, y - corner.y) <= HANDLE) return { action: "resize", id: marker.id };
      }
    }
  }
  for (let i = markers.length - 1; i >= 0; i--) {
    const marker = markers[i];
    if (!marker) continue;
    const local = toLocal(marker, x, y, rect);
    const draw = effectDrawSize(marker, rect);
    if (Math.abs(local.x) <= draw.w / 2 && Math.abs(local.y) <= draw.h / 2) return { action: "move", id: marker.id };
  }
  return null;
}
