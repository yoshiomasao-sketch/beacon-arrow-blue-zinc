/** Screen-only liquid images. Never written onto the photo. */

export const LIQUID_SOURCE_IDS = [
  "liquid_cutout_test",
  "liquid_cutout_test_02",
  "liquid_cutout_test_03",
  "liquid_cutout_test_04",
  "liquid_cutout_test_05",
  "liquid_cutout_test_06",
  "liquid_cutout_test_07",
] as const;

export const LIQUID_ASSET_IDS = LIQUID_SOURCE_IDS;

export type LiquidAssetId = (typeof LIQUID_ASSET_IDS)[number];

/** Width / height of the five 768×1376 sheets. 06 and 07 differ; use {@link liquidSheetAspect}. */
export const LIQUID_SHEET_ASPECT = 768 / 1376;

const LIQUID_SHEET_SIZE: Record<LiquidAssetId, { width: number; height: number }> = {
  liquid_cutout_test: { width: 768, height: 1376 },
  liquid_cutout_test_02: { width: 768, height: 1376 },
  liquid_cutout_test_03: { width: 768, height: 1376 },
  liquid_cutout_test_04: { width: 768, height: 1376 },
  liquid_cutout_test_05: { width: 768, height: 1376 },
  liquid_cutout_test_06: { width: 572, height: 1024 },
  liquid_cutout_test_07: { width: 587, height: 1024 },
};

export function liquidSheetAspect(id: LiquidAssetId): number {
  const size = LIQUID_SHEET_SIZE[id];
  return size.width / size.height;
}

/**
 * Droplet overlay is for any still or animated picture, including a playing GIF.
 * Video is not a picture. The native GIF clock is left alone; liquid steps on its own.
 */
export function acceptsLiquidImage(item: { mime: string } | null | undefined): boolean {
  return !!item && item.mime.startsWith("image/");
}

/** One launch box, as fractions of the image. Angle is radians, clockwise, around the box center. Lean and pitch are a separate perspective tilt, used until a free quad is stored. `quad` is four corners in the box's own axes, before the heading, so a corner, a face, and a turn can be combined without snapping back to a rectangle. `id` keeps one box apart from the others. */
export type LiquidPoint = { x: number; y: number };
export type LiquidQuad = readonly [LiquidPoint, LiquidPoint, LiquidPoint, LiquidPoint];
export type LiquidRange = { id?: number; x: number; y: number; w: number; h: number; angle?: number; lean?: number; pitch?: number; quad?: LiquidQuad };

/** A box thinner than this, on either side, is not a range. Wider than this is not stored. */
export const LIQUID_RANGE_MIN = 0.04;
const LIQUID_RANGE_MAX = 8;
/** Perspective tilt stops here. Past this the face would turn edge-on. */
export const LIQUID_TILT_LIMIT = (75 * Math.PI) / 180;
/** Focal length in image fractions. Larger is a flatter tilt. */
const LIQUID_TILT_FOCUS = 2.2;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function roundTilt(value: number): number {
  const capped = clampTilt(value);
  let rounded = Math.round(capped * 100000) / 100000;
  if (rounded > LIQUID_TILT_LIMIT) rounded = Math.trunc(LIQUID_TILT_LIMIT * 100000) / 100000;
  if (rounded < -LIQUID_TILT_LIMIT) rounded = -Math.trunc(LIQUID_TILT_LIMIT * 100000) / 100000;
  return Math.abs(rounded) < 1e-6 ? 0 : rounded;
}

function clampTilt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value > LIQUID_TILT_LIMIT) return LIQUID_TILT_LIMIT;
  if (value < -LIQUID_TILT_LIMIT) return -LIQUID_TILT_LIMIT;
  return Math.abs(value) < 1e-6 ? 0 : value;
}

export function liquidRangeAngle(range: LiquidRange): number {
  const angle = range.angle;
  if (typeof angle !== "number" || !Number.isFinite(angle)) return 0;
  const wrapped = Math.atan2(Math.sin(angle), Math.cos(angle));
  return Math.abs(wrapped) < 1e-6 ? 0 : wrapped;
}

/** Positive lean pushes the local left edge back and brings the right edge forward. */
export function liquidRangeLean(range: LiquidRange): number {
  return clampTilt(range.lean);
}

/** Positive pitch pushes the local top edge back and brings the bottom edge forward. */
export function liquidRangePitch(range: LiquidRange): number {
  return clampTilt(range.pitch);
}

function rangeCenter(range: LiquidRange) {
  return { x: range.x + range.w / 2, y: range.y + range.h / 2 };
}

function imageAspect(aspect: number): number {
  return aspect > 0.05 ? aspect : 1;
}

/**
 * Spins a pre-heading point around the center in pixel space.
 * `sx` and `sy` are image fractions. Aspect 1 matches a plain fraction rotation.
 */
function spinPoint(angle: number, aspect: number, sx: number, sy: number, cx: number, cy: number) {
  const safe = imageAspect(aspect);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const ax = sx;
  const ay = sy / safe;
  const rx = ax * cos - ay * sin;
  const ry = ax * sin + ay * cos;
  return { x: cx + rx, y: cy + ry * safe };
}

/** Pixel heading of a point around a center. Aspect 1 is `atan2(v - cy, u - cx)`. */
export function liquidRangeHeading(u: number, v: number, cx: number, cy: number, aspect = 1): number {
  const safe = imageAspect(aspect);
  return Math.atan2((v - cy) / safe, u - cx);
}

/** Inverse of {@link spinPoint}. Result is still in image fractions, before tilt is undone. */
function unspin(angle: number, aspect: number, u: number, v: number, cx: number, cy: number) {
  const safe = imageAspect(aspect);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const ax = u - cx;
  const ay = (v - cy) / safe;
  return { x: ax * cos + ay * sin, y: (-ax * sin + ay * cos) * safe };
}

/** Corners of the flat box, before perspective. Geometry and the saved rectangle use these. */
export function liquidRangeCorners(range: LiquidRange, aspect = 1): { x: number; y: number }[] {
  const angle = liquidRangeAngle(range);
  const center = rangeCenter(range);
  const hw = range.w / 2;
  const hh = range.h / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([lx, ly]) => spinPoint(angle, aspect, lx!, ly!, center.x, center.y));
}

/**
 * A point on the drawn face, in image fractions.
 * A free quad is bilinear in the box's own axes, then spun by the heading.
 * Otherwise lean and pitch tilt the card in its own axes. Heading then spins that face
 * around the center in pixel space, so the depth stays glued to the card.
 * Zero tilt and no quad is the flat box. The perspective face does not flip inside the tilt limit.
 */
export function liquidRangeFace(range: LiquidRange, lx: number, ly: number, aspect = 1): { x: number; y: number; scale: number } {
  if (range.quad) {
    const local = quadLocal(range, lx, ly);
    const center = rangeCenter(range);
    const spun = spinPoint(liquidRangeAngle(range), aspect, local.x, local.y, center.x, center.y);
    return { x: spun.x, y: spun.y, scale: 1 };
  }
  const lean = liquidRangeLean(range);
  const pitch = liquidRangePitch(range);
  const x1 = lx * Math.cos(lean);
  const z1 = lx * Math.sin(lean);
  const y2 = ly * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = ly * Math.sin(pitch) + z1 * Math.cos(pitch);
  const scale = LIQUID_TILT_FOCUS / Math.max(0.35, LIQUID_TILT_FOCUS - z2);
  const sx = x1 * scale;
  const sy = y2 * scale;
  const center = rangeCenter(range);
  const spun = spinPoint(liquidRangeAngle(range), aspect, sx, sy, center.x, center.y);
  return { x: spun.x, y: spun.y, scale };
}

/** The face as drawn, after tilt. With no tilt this matches {@link liquidRangeCorners}. */
export function liquidRangeViewCorners(range: LiquidRange, aspect = 1): { x: number; y: number; scale: number }[] {
  const hw = range.w / 2;
  const hh = range.h / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([lx, ly]) => liquidRangeFace(range, lx!, ly!, aspect));
}

/** Semicircle handle, just inside the matching edge so it sits next to that diamond. */
export function liquidRangeLeanPoint(
  range: LiquidRange,
  edge: 0 | 1 | 2 | 3,
  aspect = 1,
  insetX = 0.03,
  insetY = 0.03,
): { x: number; y: number; scale: number } {
  if (range.quad) {
    const corners = liquidRangeViewCorners(range, aspect);
    const a = corners[edge]!;
    const b = corners[(edge + 1) % 4]!;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const center = liquidRangeFace(range, 0, 0, aspect);
    const dx = center.x - mid.x;
    const dy = center.y - mid.y;
    const dist = Math.hypot(dx, dy);
    if (!(dist > 1e-6)) return { x: mid.x, y: mid.y, scale: 1 };
    const ix = leanInset(range.w / 2, insetX);
    const iy = leanInset(range.h / 2, insetY);
    const step = Math.min(dist * 0.42, Math.max(dist * 0.12, (ix + iy) * 0.5));
    return { x: mid.x + (dx / dist) * step, y: mid.y + (dy / dist) * step, scale: 1 };
  }
  const hw = range.w / 2;
  const hh = range.h / 2;
  const ix = leanInset(hw, insetX);
  const iy = leanInset(hh, insetY);
  const local =
    edge === 0 ? { x: 0, y: -hh + iy } : edge === 1 ? { x: hw - ix, y: 0 } : edge === 2 ? { x: 0, y: hh - iy } : { x: -hw + ix, y: 0 };
  return liquidRangeFace(range, local.x, local.y, aspect);
}

/** Keeps the tilt handle near the edge, and off the center on a tiny box. */
function leanInset(half: number, wanted: number): number {
  if (!(half > 0)) return 0;
  const ask = Number.isFinite(wanted) && wanted > 0 ? wanted : Math.min(0.03, half * 0.2);
  return Math.min(half * 0.65, Math.max(half * 0.08, ask));
}

/** Point in the box's own axes, before tilt. X is toward the right edge, Y is toward the bottom edge. */
export function liquidRangeLocal(range: LiquidRange, u: number, v: number, aspect = 1): { x: number; y: number } {
  const center = rangeCenter(range);
  return unspin(liquidRangeAngle(range), aspect, u, v, center.x, center.y);
}

export function liquidRangeInside(range: LiquidRange, slack = 1e-4): boolean {
  if (!(range.w > 0) || !(range.h > 0)) return false;
  return liquidRangeCorners(range).every((point) => point.x >= -slack && point.y >= -slack && point.x <= 1 + slack && point.y <= 1 + slack);
}

function roundRange(range: LiquidRange): LiquidRange {
  const round = (value: number) => Math.round(value * 10000) / 10000;
  const angle = liquidRangeAngle(range);
  const next: LiquidRange = {
    x: round(range.x),
    y: round(range.y),
    w: round(range.w),
    h: round(range.h),
    angle: Math.round(angle * 100000) / 100000,
  };
  if (range.quad && range.quad.length === 4) {
    next.quad = range.quad.map((point) => ({
      x: round(Math.min(LIQUID_RANGE_MAX, Math.max(-LIQUID_RANGE_MAX, point.x))),
      y: round(Math.min(LIQUID_RANGE_MAX, Math.max(-LIQUID_RANGE_MAX, point.y))),
    })) as unknown as LiquidQuad;
  } else {
    const lean = roundTilt(liquidRangeLean(range));
    const pitch = roundTilt(liquidRangePitch(range));
    if (lean !== 0) next.lean = lean;
    if (pitch !== 0) next.pitch = pitch;
  }
  if (typeof range.id === "number" && Number.isFinite(range.id)) next.id = range.id;
  return next;
}

function readQuad(raw: unknown): LiquidQuad | undefined {
  if (!Array.isArray(raw) || raw.length !== 4) return undefined;
  const points: LiquidPoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return undefined;
    const x = (item as { x?: unknown }).x;
    const y = (item as { y?: unknown }).y;
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    if (Math.abs(x) > LIQUID_RANGE_MAX || Math.abs(y) > LIQUID_RANGE_MAX) return undefined;
    points.push({ x, y });
  }
  return points as unknown as LiquidQuad;
}

function quadIsPlain(quad: LiquidQuad, w: number, h: number): boolean {
  const hw = w / 2;
  const hh = h / 2;
  const expected = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  return quad.every((point, index) => Math.abs(point.x - expected[index]!.x) < 5e-4 && Math.abs(point.y - expected[index]!.y) < 5e-4);
}

/** Keeps a usable box. Position may sit outside the picture; drawing clips to the picture later. */
export function normalizeLiquidRange(raw: unknown): LiquidRange | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { x?: unknown; y?: unknown; w?: unknown; h?: unknown; angle?: unknown; lean?: unknown; pitch?: unknown; quad?: unknown };
  if (typeof row.x !== "number" || typeof row.y !== "number" || typeof row.w !== "number" || typeof row.h !== "number") return null;
  if (![row.x, row.y, row.w, row.h].every((value) => Number.isFinite(value))) return null;
  const angle = liquidRangeAngle({ x: row.x, y: row.y, w: row.w, h: row.h, angle: typeof row.angle === "number" ? row.angle : 0 });
  const quad = readQuad(row.quad);
  const lean = quad ? 0 : clampTilt(row.lean);
  const pitch = quad ? 0 : clampTilt(row.pitch);
  const box = roundRange({ x: row.x, y: row.y, w: row.w, h: row.h, angle, lean, pitch, quad });
  if (box.quad && quadIsPlain(box.quad, box.w, box.h)) delete box.quad;
  if (box.w < LIQUID_RANGE_MIN || box.h < LIQUID_RANGE_MIN) return null;
  if (box.w > LIQUID_RANGE_MAX || box.h > LIQUID_RANGE_MAX) return null;
  if (Math.abs(box.x) > LIQUID_RANGE_MAX || Math.abs(box.y) > LIQUID_RANGE_MAX) return null;
  return box;
}

/** One saved box, or the older single-object favorite, becomes a list. Empty means the whole picture. Order is the saved order. */
export function normalizeLiquidRanges(raw: unknown): LiquidRange[] {
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  const out: LiquidRange[] = [];
  let nextId = 1;
  for (const row of rows) {
    const box = normalizeLiquidRange(row);
    if (!box) continue;
    const given = row && typeof row === "object" && typeof (row as { id?: unknown }).id === "number" ? (row as { id: number }).id : 0;
    let id = Number.isFinite(given) && given > 0 ? Math.round(given) : nextId;
    while (out.some((entry) => entry.id === id)) id += 1;
    nextId = Math.max(nextId, id + 1);
    out.push({ ...box, id });
  }
  return out;
}

export function nextLiquidRangeId(ranges: LiquidRange[]): number {
  let next = 1;
  for (const range of ranges) if (typeof range.id === "number" && range.id >= next) next = range.id + 1;
  return next;
}

/** A hole in the liquid only. The photo underneath is not touched. Circle radius is the box, in the same fractions as a launch range. */
export type LiquidHideShape = "circle" | "rect";
export type LiquidHide = LiquidRange & { shape: LiquidHideShape };

/** Outside-edge fade of a hide, as a fraction of the shorter image side. Half of the previous band; the inside of the marker is still fully hidden. */
export const LIQUID_HIDE_BAND = 0.0175;

function hideBandPx(width: number, height: number): number {
  return LIQUID_HIDE_BAND * Math.min(width, height);
}

function rectPixelDistance(local: { x: number; y: number }, hide: LiquidRange, width: number, height: number): number {
  const dx = Math.abs(local.x) * width - (hide.w / 2) * width;
  const dy = Math.abs(local.y) * height - (hide.h / 2) * height;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside;
}

/** Radial pixel distance outside the ellipse. Negative inside. A pixel circle is the special case. */
function ellipsePixelDistance(local: { x: number; y: number }, hide: LiquidRange, width: number, height: number): number {
  const px = local.x * width;
  const py = local.y * height;
  const radX = Math.max(1e-4, (hide.w / 2) * width);
  const radY = Math.max(1e-4, (hide.h / 2) * height);
  const radial = Math.hypot(px / radX, py / radY);
  const pixel = Math.hypot(px, py);
  if (!(radial > 1e-8)) return -Math.min(radX, radY);
  return pixel - pixel / radial;
}

/**
 * 0 inside the shape, 1 once the narrow outside band is passed.
 * Measured at this canvas pixel, after undoing the shape's tilt and heading.
 */
export function liquidHideVisibility(x: number, y: number, hide: LiquidHide, width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 1;
  const local = liquidRangeUnface(hide, x / width, y / height, width / height);
  if (!local) return 1;
  const dist = hide.shape === "circle" ? ellipsePixelDistance(local, hide, width, height) : rectPixelDistance(local, hide, width, height);
  if (!(dist > 0)) return 0;
  const band = hideBandPx(width, height);
  if (!(band > 0.5) || dist >= band) return 1;
  return smooth01(dist / band);
}

/** Strongest hide wins. Overlap never brings liquid back. */
export function liquidHidesVisibility(x: number, y: number, hides: readonly LiquidHide[], width: number, height: number): number {
  let vis = 1;
  for (const hide of hides) {
    const next = liquidHideVisibility(x, y, hide, width, height);
    if (next < vis) vis = next;
    if (vis <= 0) return 0;
  }
  return vis;
}

export function liquidHidePixelBounds(hide: LiquidHide, width: number, height: number): { x: number; y: number; w: number; h: number } {
  const corners = liquidRangeViewCorners(hide, height > 0 ? width / height : 1);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (const point of corners) {
    const x = point.x * width;
    const y = point.y * height;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const band = Math.ceil(hideBandPx(width, height)) + 3;
  const x0 = Math.max(0, Math.floor(minX) - band);
  const y0 = Math.max(0, Math.floor(minY) - band);
  const x1 = Math.min(width, Math.ceil(maxX) + band);
  const y1 = Math.min(height, Math.ceil(maxY) + band);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/**
 * Lowers alpha where liquid should disappear. The buffer must already be opaque.
 * RGB is unused. A later `destination-in` multiplies this with the sheet and the range fade.
 * Overlapping hides keep the lower alpha.
 */
export function writeLiquidHideMask(pixels: Uint8ClampedArray, width: number, height: number, hides: readonly LiquidHide[]): void {
  if (!(width > 0) || !(height > 0) || pixels.length < width * height * 4 || hides.length === 0) return;
  for (const hide of hides) {
    const bounds = liquidHidePixelBounds(hide, width, height);
    if (!(bounds.w > 0) || !(bounds.h > 0)) continue;
    const x1 = bounds.x + bounds.w;
    const y1 = bounds.y + bounds.h;
    for (let y = bounds.y; y < y1; y++) {
      const row = y * width;
      for (let x = bounds.x; x < x1; x++) {
        const vis = liquidHideVisibility(x + 0.5, y + 0.5, hide, width, height);
        if (!(vis < 1)) continue;
        const alpha = Math.round(vis * 255);
        const i = (row + x) * 4 + 3;
        if (alpha < (pixels[i] ?? 255)) pixels[i] = alpha;
      }
    }
  }
}

function circleBounds(source: LiquidRange, cx: number, cy: number, rad: number, aspect: number): LiquidRange {
  const safe = imageAspect(aspect);
  let hw = Math.max(LIQUID_RANGE_MIN / 2, rad);
  let hh = hw * safe;
  if (hh < LIQUID_RANGE_MIN / 2) {
    hh = LIQUID_RANGE_MIN / 2;
    hw = hh / safe;
  }
  hw = Math.min(hw, LIQUID_RANGE_MAX / 2);
  hh = Math.min(hh, LIQUID_RANGE_MAX / 2);
  if (hw > hh / safe) hw = hh / safe;
  if (hh > hw * safe) hh = hw * safe;
  hw = cappedHalf(cx, hw);
  hh = cappedHalf(cy, hh);
  if (hw > hh / safe) hw = hh / safe;
  if (hh > hw * safe) hh = hw * safe;
  return roundRange({
    id: source.id,
    x: cx - hw,
    y: cy - hh,
    w: hw * 2,
    h: hh * 2,
    angle: liquidRangeAngle(source),
    lean: source.lean,
    pitch: source.pitch,
  });
}

/** Radius follows the pointer. The center stays, and the outline stays a circle in pixels. */
export function liquidCircleResize(range: LiquidRange, _corner: 0 | 1 | 2 | 3, u: number, v: number, aspect = 1): LiquidRange {
  const local = liquidRangeUnface(range, u, v, aspect);
  if (!local) return range;
  const safe = imageAspect(aspect);
  const center = rangeCenter(range);
  const rad = Math.hypot(local.x, local.y / safe);
  return circleBounds(range, center.x, center.y, rad, safe);
}

export function liquidHideResize(hide: LiquidHide, corner: 0 | 1 | 2 | 3, u: number, v: number, aspect = 1): LiquidHide {
  const next = hide.shape === "circle" ? liquidCircleResize(hide, corner, u, v, aspect) : liquidRangeResize(hide, corner, u, v, aspect);
  return { ...next, id: hide.id ?? next.id, shape: hide.shape };
}

/** Circle in pixel space, from a drag box. `aspect` is image width / height. Too-small drags are dropped later. */
export function liquidHideCircle(u0: number, v0: number, u1: number, v1: number, aspect = 1): LiquidHide {
  const safe = imageAspect(aspect);
  const cx = (u0 + u1) / 2;
  const cy = (v0 + v1) / 2;
  const rad = Math.max(0, Math.abs(u1 - u0) / 2, Math.abs(v1 - v0) / 2 / safe);
  const hw = rad;
  const hh = rad * safe;
  return { shape: "circle", x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2, angle: 0 };
}

export function normalizeLiquidHide(raw: unknown): LiquidHide | null {
  if (!raw || typeof raw !== "object") return null;
  const shape = (raw as { shape?: unknown }).shape;
  if (shape !== "circle" && shape !== "rect") return null;
  const box = normalizeLiquidRange(raw);
  if (!box) return null;
  const given = typeof (raw as { id?: unknown }).id === "number" ? (raw as { id: number }).id : 0;
  const next: LiquidHide = { ...box, shape };
  delete next.quad;
  if (Number.isFinite(given) && given > 0) next.id = Math.round(given);
  return next;
}

/** Saved holes, in order. Missing or broken entries are dropped. Older favorites have none. */
export function normalizeLiquidHides(raw: unknown): LiquidHide[] {
  if (!Array.isArray(raw)) return [];
  const out: LiquidHide[] = [];
  let nextId = 1;
  for (const row of raw) {
    const hide = normalizeLiquidHide(row);
    if (!hide) continue;
    let id = typeof hide.id === "number" && hide.id > 0 ? hide.id : nextId;
    while (out.some((entry) => entry.id === id)) id += 1;
    nextId = Math.max(nextId, id + 1);
    out.push({ ...hide, id });
  }
  return out;
}

/**
 * Where one sheet sits.
 * No range: full image width, top on the image top, same as placement.
 * A range: the sheet keeps its aspect and is fitted to the box's longer side.
 * A wide box matches the width. A tall box matches the height. The rest is clipped, not stretched.
 * The sheet stays pinned to the top of the box and turns with it.
 */
export function liquidSheetBox(
  asset: LiquidAssetId,
  aspect: number,
  range: LiquidRange | null,
): { u: number; v: number; w: number; h: number; angle: number } {
  const imageAspect = aspect > 0.05 ? aspect : 1;
  const sheetAspect = liquidSheetAspect(asset);
  if (!range) {
    const h = imageAspect / sheetAspect;
    return { u: 0.5, v: h / 2, w: 1, h, angle: 0 };
  }
  const wide = range.w * imageAspect >= range.h;
  const w = wide ? range.w : (range.h * sheetAspect) / imageAspect;
  const h = wide ? (range.w * imageAspect) / sheetAspect : range.h;
  const angle = liquidRangeAngle(range);
  const center = rangeCenter(range);
  const ly = -range.h / 2 + h / 2;
  const ay = ly / imageAspect;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { u: center.x - ay * sin, v: center.y + ay * cos * imageAspect, w, h, angle };
}

function smooth01(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

/**
 * Edge fade for a point in canvas pixels, on the flat box.
 * Bands are fractions of the whole image, not of the box: top 8%, bottom 6%, each side 3%.
 * Smoothstep, then the nearer edge wins, so a corner is not darkened twice.
 * The rim follows the box angle. This is the value at that exact pixel, not a whole mesh cell.
 */
export function liquidRangeFade(x: number, y: number, range: LiquidRange, width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 0;
  const local = liquidRangeLocal(range, x / width, y / height, width / height);
  return liquidRangeFadeAt(local.x, local.y, range, width, height);
}

/** Fade from a point already in the box's own axes. Outside the flat face is 0. */
export function liquidRangeFadeAt(lx: number, ly: number, range: LiquidRange, width: number, height: number): number {
  const hw = range.w / 2;
  const hh = range.h / 2;
  if (!(width > 0) || !(height > 0) || !(hw > 0) || !(hh > 0)) return 0;
  if (lx < -hw || ly < -hh || lx > hw || ly > hh) return 0;
  const fade = (dist: number, band: number) => (band > 0.5 ? smooth01(dist / band) : 1);
  return Math.min(fade((lx + hw) * width, width * 0.03), fade((hw - lx) * width, width * 0.03), fade((ly + hh) * height, height * 0.08), fade((hh - ly) * height, height * 0.06));
}

/**
 * Inverse of {@link liquidRangeFace}.
 * A finished canvas pixel maps back to the face point that was drawn there.
 * No tilt: same as {@link liquidRangeLocal}.
 */
export function liquidRangeUnface(range: LiquidRange, u: number, v: number, aspect = 1): { x: number; y: number } | null {
  const center = rangeCenter(range);
  const flat = unspin(liquidRangeAngle(range), aspect, u, v, center.x, center.y);
  if (range.quad) {
    const st = invBilinear(flat, range.quad[0], range.quad[1], range.quad[2], range.quad[3]);
    if (!st) return null;
    return { x: (st.s - 0.5) * range.w, y: (st.t - 0.5) * range.h };
  }
  const lean = liquidRangeLean(range);
  const pitch = liquidRangePitch(range);
  if (Math.abs(lean) < 1e-6 && Math.abs(pitch) < 1e-6) return flat;
  const sx = flat.x;
  const sy = flat.y;
  const cL = Math.cos(lean);
  const sL = Math.sin(lean);
  const cP = Math.cos(pitch);
  const sP = Math.sin(pitch);
  if (Math.abs(cL) < 1e-4 || Math.abs(cP) < 1e-4) return null;
  const k = 1 + (sy * sP + (sx * sL) / cL) / (LIQUID_TILT_FOCUS * cP);
  if (!(k > 1e-6) || !Number.isFinite(k)) return null;
  const lx = sx / (cL * k);
  const ly = (sy / k + lx * sL * sP) / cP;
  if (!Number.isFinite(lx) || !Number.isFinite(ly)) return null;
  return { x: lx, y: ly };
}

/**
 * Fade at one finished canvas pixel.
 * Same bands as {@link liquidRangeFade}. Tilt is undone first, so the rim is the face that was drawn,
 * not the mesh cell and not the flat rectangle the tilt grew out of.
 */
export function liquidRangePixelFade(x: number, y: number, range: LiquidRange, width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 0;
  const local = liquidRangeUnface(range, x / width, y / height, width / height);
  if (!local) return 0;
  return liquidRangeFadeAt(local.x, local.y, range, width, height);
}

/** Pixel bounds of the drawn face, padded so an antialiased rim still gets a fade sample. */
export function liquidFadePixelBounds(range: LiquidRange, width: number, height: number): { x: number; y: number; w: number; h: number } {
  const corners = liquidRangeViewCorners(range, height > 0 ? width / height : 1);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (const point of corners) {
    const x = point.x * width;
    const y = point.y * height;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const x0 = Math.max(0, Math.floor(minX) - 2);
  const y0 = Math.max(0, Math.floor(minY) - 2);
  const x1 = Math.min(width, Math.ceil(maxX) + 2);
  const y1 = Math.min(height, Math.ceil(maxY) + 2);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/**
 * White mask. Alpha is the per-pixel rim fade. The buffer must start at 0.
 * RGB is unused; `destination-in` reads alpha and multiplies whatever was already drawn.
 */
export function writeLiquidFadeMask(pixels: Uint8ClampedArray, width: number, height: number, range: LiquidRange): void {
  if (!(width > 0) || !(height > 0) || pixels.length < width * height * 4) return;
  const bounds = liquidFadePixelBounds(range, width, height);
  if (!(bounds.w > 0) || !(bounds.h > 0)) return;
  const x1 = bounds.x + bounds.w;
  const y1 = bounds.y + bounds.h;
  for (let y = bounds.y; y < y1; y++) {
    const row = y * width;
    for (let x = bounds.x; x < x1; x++) {
      const alpha = liquidRangePixelFade(x + 0.5, y + 0.5, range, width, height);
      if (!(alpha > 0)) continue;
      const i = (row + x) * 4;
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
      pixels[i + 3] = Math.round(alpha * 255);
    }
  }
}

const RESIZE_SIGN = [
  { w: -1, h: -1 },
  { w: 1, h: -1 },
  { w: 1, h: 1 },
  { w: -1, h: 1 },
] as const;

/** Half-size that stays at least the minimum and still normalizes around `center`. */
function cappedHalf(center: number, requested: number): number {
  const min = Math.max(LIQUID_RANGE_MIN / 2, center - LIQUID_RANGE_MAX);
  const max = Math.min(LIQUID_RANGE_MAX / 2, center + LIQUID_RANGE_MAX);
  const ask = Math.max(LIQUID_RANGE_MIN / 2, requested);
  if (!(max >= min)) return Math.min(LIQUID_RANGE_MAX / 2, ask);
  return Math.min(max, Math.max(min, ask));
}

/** Slides the box. The picture edge does not stop it. Drawing clips later. */
export function liquidRangeMove(range: LiquidRange, du: number, dv: number): LiquidRange {
  return roundRange({ ...range, x: range.x + du, y: range.y + dv });
}

/**
 * Stretches one corner away from the center.
 * The center, heading, lean, and pitch stay. Width and height change on their own.
 * The pointer is read on the tilted face, so the corner follows the finger.
 */
export function liquidRangeResize(range: LiquidRange, corner: 0 | 1 | 2 | 3, u: number, v: number, aspect = 1): LiquidRange {
  const sign = RESIZE_SIGN[corner];
  const local = liquidRangeUnface(range, u, v, aspect);
  if (!local) return range;
  const center = rangeCenter(range);
  const halfW = cappedHalf(center.x, sign.w * local.x);
  const halfH = cappedHalf(center.y, sign.h * local.y);
  const w = halfW * 2;
  const h = halfH * 2;
  return roundRange({
    id: range.id,
    x: center.x - w / 2,
    y: center.y - h / 2,
    w,
    h,
    angle: liquidRangeAngle(range),
    lean: range.lean,
    pitch: range.pitch,
  });
}

/** Turns the tilted face around its center. Leaving the picture is allowed. */
export function liquidRangeTurn(range: LiquidRange, angle: number): LiquidRange | null {
  if (!Number.isFinite(angle)) return null;
  return roundRange({ ...range, angle });
}

/** True when the launch box is a free quad rather than a rectangle plus tilt. */
export function liquidRangeDeformed(range: LiquidRange): boolean {
  return Array.isArray(range.quad) && range.quad.length === 4;
}

/** Rotation pivot. A free quad turns around the average of its corners. A rectangle keeps the box center. */
export function liquidRangePivot(range: LiquidRange, aspect = 1): { x: number; y: number } {
  if (!range.quad) return rangeCenter(range);
  const corners = liquidRangeViewCorners(range, aspect);
  return {
    x: (corners[0]!.x + corners[1]!.x + corners[2]!.x + corners[3]!.x) / 4,
    y: (corners[0]!.y + corners[1]!.y + corners[2]!.y + corners[3]!.y) / 4,
  };
}

/** Copies the drawn corners into a quad so the next drag does not jump, and drops perspective once that copy exists. */
export function liquidRangeBake(range: LiquidRange, aspect = 1): LiquidRange {
  if (range.quad) return range;
  const angle = liquidRangeAngle(range);
  const center = rangeCenter(range);
  const view = liquidRangeViewCorners(range, aspect);
  const quad = view.map((point) => unspin(angle, aspect, point.x, point.y, center.x, center.y)) as unknown as LiquidQuad;
  return roundRange({ ...range, lean: 0, pitch: 0, quad });
}

/** Moves one corner to the pointer. The other three corners stay where they are. */
export function liquidRangeCorner(range: LiquidRange, corner: 0 | 1 | 2 | 3, u: number, v: number, aspect = 1): LiquidRange {
  const baked = liquidRangeBake(range, aspect);
  if (!baked.quad) return range;
  const center = rangeCenter(baked);
  const local = unspin(liquidRangeAngle(baked), aspect, u, v, center.x, center.y);
  const quad = baked.quad.map((point, index) => (index === corner ? { x: local.x, y: local.y } : { x: point.x, y: point.y })) as unknown as LiquidQuad;
  return roundRange({ ...baked, lean: 0, pitch: 0, quad });
}

/**
 * Slides one face along its outward normal.
 * Both corners of that face share the move, so the edge length stays. The opposite face stays put.
 * `originU` and `originV` are the pointer at the start of the drag. The face is measured on `range`, not on an earlier frame.
 */
export function liquidRangeEdge(
  range: LiquidRange,
  edge: 0 | 1 | 2 | 3,
  u: number,
  v: number,
  originU: number,
  originV: number,
  aspect = 1,
): LiquidRange {
  const baked = liquidRangeBake(range, aspect);
  if (!baked.quad) return range;
  const center = rangeCenter(baked);
  const angle = liquidRangeAngle(baked);
  const image = baked.quad.map((point) => spinPoint(angle, aspect, point.x, point.y, center.x, center.y));
  const i0 = edge;
  const i1 = (edge + 1) % 4;
  const a = image[i0]!;
  const b = image[i1]!;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const pivot = {
    x: (image[0]!.x + image[1]!.x + image[2]!.x + image[3]!.x) / 4,
    y: (image[0]!.y + image[1]!.y + image[2]!.y + image[3]!.y) / 4,
  };
  const safe = imageAspect(aspect);
  const px = b.x - a.x;
  const py = (b.y - a.y) / safe;
  const plen = Math.hypot(px, py);
  if (!(plen > 1e-8)) return baked;
  let ix = -py / plen;
  let iy = (px / plen) * safe;
  const nlen = Math.hypot(ix, iy);
  if (!(nlen > 1e-8)) return baked;
  ix /= nlen;
  iy /= nlen;
  if ((mid.x - pivot.x) * ix + (mid.y - pivot.y) * iy < 0) {
    ix = -ix;
    iy = -iy;
  }
  const along = (u - originU) * ix + (v - originV) * iy;
  const moved = image.map((point, index) =>
    index === i0 || index === i1 ? { x: point.x + ix * along, y: point.y + iy * along } : { x: point.x, y: point.y },
  );
  const quad = moved.map((point) => unspin(angle, aspect, point.x, point.y, center.x, center.y)) as unknown as LiquidQuad;
  return roundRange({ ...baked, lean: 0, pitch: 0, quad });
}

/**
 * Turns the whole face around its center by `delta` radians.
 * A free quad keeps its edge lengths and turns around the corner average.
 * A rectangle, including one that still has perspective, uses {@link liquidRangeTurn}.
 */
export function liquidRangeSpin(range: LiquidRange, delta: number, aspect = 1): LiquidRange | null {
  if (!Number.isFinite(delta)) return null;
  if (!range.quad) return liquidRangeTurn(range, liquidRangeAngle(range) + delta);
  if (Math.abs(delta) < 1e-8) return roundRange(range);
  const center = rangeCenter(range);
  const angle = liquidRangeAngle(range);
  const image = range.quad.map((point) => spinPoint(angle, aspect, point.x, point.y, center.x, center.y));
  const pivot = {
    x: (image[0]!.x + image[1]!.x + image[2]!.x + image[3]!.x) / 4,
    y: (image[0]!.y + image[1]!.y + image[2]!.y + image[3]!.y) / 4,
  };
  const safe = imageAspect(aspect);
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  const spun = image.map((point) => {
    const ax = point.x - pivot.x;
    const ay = (point.y - pivot.y) / safe;
    const rx = ax * cos - ay * sin;
    const ry = ax * sin + ay * cos;
    return { x: pivot.x + rx, y: pivot.y + ry * safe };
  });
  const quad = spun.map((point) => unspin(angle, aspect, point.x, point.y, center.x, center.y)) as unknown as LiquidQuad;
  return roundRange({ ...range, lean: 0, pitch: 0, quad });
}

function quadLocal(range: LiquidRange, lx: number, ly: number): LiquidPoint {
  const quad = range.quad!;
  const hw = range.w / 2;
  const hh = range.h / 2;
  const s = hw > 1e-8 ? (lx + hw) / (hw * 2) : 0.5;
  const t = hh > 1e-8 ? (ly + hh) / (hh * 2) : 0.5;
  const w00 = (1 - s) * (1 - t);
  const w10 = s * (1 - t);
  const w11 = s * t;
  const w01 = (1 - s) * t;
  return {
    x: w00 * quad[0].x + w10 * quad[1].x + w11 * quad[2].x + w01 * quad[3].x,
    y: w00 * quad[0].y + w10 * quad[1].y + w11 * quad[2].y + w01 * quad[3].y,
  };
}

function cross2(a: LiquidPoint, b: LiquidPoint): number {
  return a.x * b.y - a.y * b.x;
}

/** Inverse bilinear. `a` is corner 0, `b` corner 1, `c` corner 2, `d` corner 3. `s` runs to `b`, `t` runs to `d`. */
function invBilinear(p: LiquidPoint, a: LiquidPoint, b: LiquidPoint, c: LiquidPoint, d: LiquidPoint): { s: number; t: number } | null {
  const e = { x: b.x - a.x, y: b.y - a.y };
  const f = { x: d.x - a.x, y: d.y - a.y };
  const g = { x: a.x - b.x + c.x - d.x, y: a.y - b.y + c.y - d.y };
  const h = { x: p.x - a.x, y: p.y - a.y };
  const k2 = cross2(g, f);
  const k1 = cross2(e, f) + cross2(h, g);
  const k0 = cross2(h, e);
  const pick = (v: number) => {
    const denx = e.x + g.x * v;
    const deny = e.y + g.y * v;
    const u = Math.abs(denx) >= Math.abs(deny) ? (Math.abs(denx) < 1e-8 ? NaN : (h.x - f.x * v) / denx) : (h.y - f.y * v) / deny;
    return { s: u, t: v };
  };
  let hit: { s: number; t: number };
  if (Math.abs(k2) < 1e-8) {
    if (Math.abs(k1) < 1e-8) return null;
    hit = pick(-k0 / k1);
  } else {
    const disc = k1 * k1 - 4 * k0 * k2;
    if (disc < 0) return null;
    const w = Math.sqrt(disc);
    const ik2 = 0.5 / k2;
    hit = pick((-k1 - w) * ik2);
    if (hit.s < -0.05 || hit.s > 1.05 || hit.t < -0.05 || hit.t > 1.05) hit = pick((-k1 + w) * ik2);
  }
  if (!Number.isFinite(hit.s) || !Number.isFinite(hit.t)) return null;
  return hit;
}

export type LiquidRangeHit =
  | { kind: "move" }
  | { kind: "corner"; corner: 0 | 1 | 2 | 3 }
  | { kind: "edge"; edge: 0 | 1 | 2 | 3 }
  | { kind: "lean"; edge: 0 | 1 | 2 | 3 }
  | { kind: "inside" }
  | { kind: "outside" };

function pointInFace(u: number, v: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > v === b.y > v) continue;
    const x = ((b.x - a.x) * (v - a.y)) / (b.y - a.y) + a.x;
    if (u < x) inside = !inside;
  }
  return inside;
}

/** padU and padV are the handle radius in image fractions. The center square wins, then corners, then the tilt semicircles, then the diamonds. */
export function liquidRangeHit(
  range: LiquidRange,
  u: number,
  v: number,
  padU: number,
  padV: number,
  aspect = 1,
  insetX = 0.03,
  insetY = 0.03,
): LiquidRangeHit {
  const corners = liquidRangeViewCorners(range, aspect);
  const near = (x: number, y: number, scale = 1) => {
    const dx = padU > 0 ? (u - x) / (padU * scale) : u - x;
    const dy = padV > 0 ? (v - y) / (padV * scale) : v - y;
    return dx * dx + dy * dy <= 1;
  };
  const center = liquidRangeFace(range, 0, 0, aspect);
  if (near(center.x, center.y, 0.4)) return { kind: "move" };
  for (let i = 0; i < corners.length; i++) {
    if (near(corners[i]!.x, corners[i]!.y)) return { kind: "corner", corner: i as 0 | 1 | 2 | 3 };
  }
  for (let i = 0; i < 4; i++) {
    const handle = liquidRangeLeanPoint(range, i as 0 | 1 | 2 | 3, aspect, insetX, insetY);
    if (near(handle.x, handle.y, 0.46)) return { kind: "lean", edge: i as 0 | 1 | 2 | 3 };
  }
  const edges = [0, 1, 2, 3].map((edge) => {
    const a = corners[edge]!;
    const b = corners[(edge + 1) % 4]!;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  });
  for (let i = 0; i < edges.length; i++) {
    if (near(edges[i]!.x, edges[i]!.y)) return { kind: "edge", edge: i as 0 | 1 | 2 | 3 };
  }
  if (pointInFace(u, v, corners)) return { kind: "inside" };
  return { kind: "outside" };
}

/** Same handles as a launch box. A circle's interior is the ellipse, not the corner box. */
export function liquidShapeHit(
  range: LiquidRange,
  shape: LiquidHideShape | "rect",
  u: number,
  v: number,
  padU: number,
  padV: number,
  aspect = 1,
  insetX = 0.03,
  insetY = 0.03,
): LiquidRangeHit {
  const hit = liquidRangeHit(range, u, v, padU, padV, aspect, insetX, insetY);
  if (shape !== "circle" || hit.kind !== "inside") return hit;
  const local = liquidRangeUnface(range, u, v, aspect);
  if (!local || !(range.w > 0) || !(range.h > 0)) return { kind: "outside" };
  const nx = (local.x * 2) / range.w;
  const ny = (local.y * 2) / range.h;
  return nx * nx + ny * ny <= 1 ? hit : { kind: "outside" };
}

/**
 * Drag one semicircle. Left and right change lean. Top and bottom change pitch.
 * Dragging outward pushes that side back. Dragging inward brings it forward.
 * The other tilt is left alone, and neither axis passes the limit.
 */
export function liquidRangeLeanDrag(range: LiquidRange, edge: 0 | 1 | 2 | 3, du: number, dv: number, aspect = 1): LiquidRange {
  const local = unspin(liquidRangeAngle(range), aspect, du, dv, 0, 0);
  const gain = LIQUID_TILT_LIMIT / 0.22;
  const lean = edge === 1 || edge === 3 ? clampTilt(liquidRangeLean(range) - local.x * gain) : liquidRangeLean(range);
  const pitch = edge === 0 || edge === 2 ? clampTilt(liquidRangePitch(range) - local.y * gain) : liquidRangePitch(range);
  return roundRange({ ...range, lean, pitch });
}

/**
 * Average time for the bottom to gain one initial height.
 * The rate waves around this. Same value on PC and phone. Tune here.
 */
export const LIQUID_EXTEND_SECONDS = 6;
/** How fast the stretch speeds up and slows down, in cycles per second. */
export const LIQUID_WAVE_HZ = 0.65;
/** The top edge stays put. The bottom carries the stretch. */
export const LIQUID_TOP_RATIO = 0;
/** Above this fraction, the mesh stays pinned to the top edge. Only a thin lip — a tall sheet would hide a deep hinge below the photo. */
export const LIQUID_HINGE = 0.08;
/** Below this, the tip keeps its shape and only drops. */
export const LIQUID_TIP = 0.86;
/** Full strength until this many seconds after the sheet appears. Tune here. */
export const LIQUID_FADE_DELAY = 5;
/** Then this many seconds to fade to nothing. Tune here. */
export const LIQUID_FADE_SECONDS = 3;

export const LIQUID_FLASH = {
  /** Two short blinks, then one solid white blink of about half a second. */
  ons: [0.12, 0.12, 0.5],
  gap: 0.08,
  /** Peak of the two short blinks. The last blink ignores this and is solid white. */
  alpha: 0.55,
};

export type LiquidSprite = {
  id: number;
  asset: LiquidAssetId;
  /** Center, as a fraction of the image. */
  u: number;
  v: number;
  /** Size, as a fraction of the image. */
  w: number;
  h: number;
  rotation: number;
  flip: boolean;
  /** Bottom extension divided by the sprite's initial height. Stops at 1. Shared clock, before the per-band speed scale. */
  extend: number;
  /**
   * Speed scale for each vertical fifth, from 0.8 to 1.2.
   * Chosen once when the sheet is placed. Not rolled again while it plays.
   */
  paces: number[];
  /** Extend clock for each vertical fifth. The shared rate, multiplied by `paces`. */
  bands: number[];
  showAt: number;
  /** Which launch box this sheet follows. Missing means the whole image. */
  rangeId?: number;
};

export type LiquidGroup = {
  id: number;
  sprites: LiquidSprite[];
  /** World time when the flash started. */
  started: number;
  /** World time when the sheet becomes visible. Fade and drip are measured from here. */
  showAt: number;
};

export type LiquidWorld = {
  groups: LiquidGroup[];
  time: number;
  seed: number;
  phone: boolean;
  /** Image width / height. */
  aspect: number;
  /** Launch boxes for this image. Empty uses the whole image. */
  ranges: LiquidRange[];
  seq: number;
  spraying: boolean;
  aimU: number;
  aimV: number;
};

export function liquidGroupCap(phone: boolean): number {
  return phone ? 8 : 12;
}

export function meshRows(phone: boolean): number {
  return phone ? 12 : 16;
}

export function meshColumns(phone: boolean): number {
  return phone ? 18 : 24;
}

/** Vertical parts that may drip at slightly different speeds. Not a marker grid. */
export const LIQUID_PACE_BANDS = 5;
export const LIQUID_PACE_MIN = 0.8;
export const LIQUID_PACE_MAX = 1.2;

let paceRandom: () => number = Math.random;

/** Tests only. The sheet uses this when it is placed, then keeps the result. */
export function setLiquidPaceRandom(random: () => number): void {
  paceRandom = random;
}

function rollPaceSet(random: () => number): number[] {
  const span = LIQUID_PACE_MAX - LIQUID_PACE_MIN;
  const paces: number[] = [];
  for (let i = 0; i < LIQUID_PACE_BANDS; i++) {
    const value = LIQUID_PACE_MIN + random() * span;
    paces.push(Math.min(LIQUID_PACE_MAX, Math.max(LIQUID_PACE_MIN, value)));
  }
  return paces;
}

/**
 * Five scales, each in [0.8, 1.2].
 * If one roll comes out almost flat, roll once more. The second result is kept either way.
 */
export function rollLiquidPaces(random: () => number = paceRandom): number[] {
  const first = rollPaceSet(random);
  let min = first[0] ?? 1;
  let max = min;
  for (const value of first) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (max - min < 0.05) return rollPaceSet(random);
  return first;
}

export function liquidFreeRatio(groupCount: number, phone: boolean): number {
  const cap = liquidGroupCap(phone);
  if (!(cap > 0)) return 0;
  const room = cap - groupCount;
  if (!(room > 0)) return 0;
  return room / cap;
}

export function emptyLiquid(phone = false): LiquidWorld {
  return {
    groups: [],
    time: 0,
    seed: 1,
    phone,
    aspect: 1,
    ranges: [],
    seq: 1,
    spraying: false,
    aimU: 0.5,
    aimV: 0.5,
  };
}

export function clearLiquid(world: LiquidWorld) {
  world.groups.length = 0;
  world.spraying = false;
}

export function liquidFlashDuration(flash = LIQUID_FLASH): number {
  if (flash.ons.length === 0) return 0;
  return flash.ons.reduce((sum, on) => sum + on, 0) + Math.max(0, flash.ons.length - 1) * flash.gap;
}

/** Start of the last blink. The sheet is shown during that blink. */
export function liquidShowDelay(flash = LIQUID_FLASH): number {
  if (flash.ons.length === 0) return 0;
  let time = 0;
  for (let i = 0; i < flash.ons.length - 1; i++) time += flash.ons[i] + flash.gap;
  return time;
}

/** 0 outside a pulse. Short blinks rise and fall. The last blink stays solid, then fades across its final 0.3s. */
export function liquidFlashAlpha(elapsed: number, flash = LIQUID_FLASH): number {
  if (!(elapsed >= 0) || flash.ons.length === 0) return 0;
  let time = 0;
  for (let i = 0; i < flash.ons.length; i++) {
    const on = flash.ons[i];
    if (!(on > 0)) continue;
    if (elapsed < time + on) {
      const local = elapsed - time;
      if (i === flash.ons.length - 1) {
        const tail = Math.min(0.3, on);
        const solid = on - tail;
        if (local <= solid) return 1;
        const u = (local - solid) / tail;
        const fade = u * u * (3 - 2 * u);
        return 1 - fade;
      }
      return flash.alpha * Math.sin((local / on) * Math.PI);
    }
    time += on;
    if (i < flash.ons.length - 1) {
      if (elapsed < time + Math.max(0, flash.gap)) return 0;
      time += Math.max(0, flash.gap);
    }
  }
  return 0;
}

export function liquidOverlayFlash(world: LiquidWorld, flash = LIQUID_FLASH): number {
  let max = 0;
  for (const group of world.groups) {
    const alpha = liquidFlashAlpha(world.time - group.started, flash);
    if (alpha > max) max = alpha;
  }
  return max;
}

export function liquidBusy(world: LiquidWorld): boolean {
  return world.groups.length > 0;
}

export function liquidLife(delay = LIQUID_FADE_DELAY, fade = LIQUID_FADE_SECONDS): number {
  return Math.max(0, delay) + Math.max(0, fade);
}

/**
 * 1 until {@link LIQUID_FADE_DELAY} after the sheet appears,
 * then a smooth fall to 0 across {@link LIQUID_FADE_SECONDS}.
 * `displayAge` is seconds since the sheet became visible.
 */
export function liquidTimeFade(displayAge: number, delay = LIQUID_FADE_DELAY, fade = LIQUID_FADE_SECONDS): number {
  if (!(displayAge > 0)) return 1;
  if (!(fade > 0)) return displayAge >= delay ? 0 : 1;
  if (displayAge <= delay) return 1;
  const u = (displayAge - delay) / fade;
  if (u >= 1) return 0;
  return Math.cos(u * Math.PI * 0.5);
}

/**
 * Separate from the clock fade. The attachment stays dense.
 * Strands lose opacity toward the tip, in a smooth ramp.
 */
export function liquidTipAlpha(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  const start = 0.2;
  if (u <= start) return 1;
  const x = (u - start) / (1 - start);
  const s = x * x * (3 - 2 * x);
  return 1 - s * 0.88;
}

/** Extension speed at `elapsed` seconds after the sheet appears. Averages to 1 / {@link LIQUID_EXTEND_SECONDS}. */
export function liquidExtendRate(elapsed: number, seconds = LIQUID_EXTEND_SECONDS, hz = LIQUID_WAVE_HZ): number {
  const base = seconds > 0 ? 1 / seconds : 0;
  const wave = 1 + 0.38 * Math.sin(Math.max(0, elapsed) * hz * Math.PI * 2);
  return base * wave;
}

export function meshEdges(extend: number, height: number) {
  const stretch = strandStretch(extend, 1);
  const extra = stretch * height;
  return {
    extend: Math.min(1, Math.max(0, extend)),
    extra,
    top: 0,
    bottom: height + extra,
  };
}

/**
 * How far one strand has stretched, as a fraction of the initial height.
 * `extend` is the shared clock (0 to 1). `gain` is this strand's own cap, at most 1.
 * The result only increases as `extend` increases, and it never passes one height.
 */
export function strandStretch(extend: number, gain: number): number {
  const g = Math.min(1, Math.max(0, gain));
  const u = Math.min(1, Math.max(0, extend));
  if (!(g > 0) || !(u > 0)) return 0;
  const exp = 0.68 + 0.7 * (1 - g);
  return g * Math.pow(u, exp);
}

/** Stable 0.42–1 mix so neighboring strands lengthen by different amounts. */
export function strandGain(column: number, columns: number, salt: number): number {
  const cols = Math.max(1, columns);
  const n = Math.abs(Math.sin((column + 0.5) * 12.9898 + (salt % 97) * 0.618 + cols * 0.013));
  const wave = 0.5 + 0.5 * Math.sin(((column + 0.5) / cols) * Math.PI * 3 + (salt % 13));
  return 0.42 + 0.58 * (0.62 * n + 0.38 * wave);
}

/**
 * Local Y of source fraction `t` (0 = top of the file, 1 = bottom).
 * The top lip stays put. The middle stretches. The tip drops without squashing.
 * `stretch` is already the strand's own extension, capped at 1.
 */
export function strandY(t: number, height: number, stretch: number): number {
  const clampedT = Math.min(1, Math.max(0, t));
  const extra = Math.min(1, Math.max(0, stretch)) * height;
  const bottom = height + extra;
  if (clampedT <= LIQUID_HINGE) return clampedT * height;
  if (clampedT >= LIQUID_TIP) return bottom - (1 - clampedT) * height;
  const y0 = LIQUID_HINGE * height;
  const mid0 = (LIQUID_TIP - LIQUID_HINGE) * height;
  const u = (clampedT - LIQUID_HINGE) / (LIQUID_TIP - LIQUID_HINGE);
  return y0 + u * mid0 + extra * Math.pow(u, 0.6);
}

/**
 * Longest strand (gain 1). Source top stays at local Y 0.
 * There is no vertical flip: increasing `t` moves down the canvas.
 */
export function meshY(t: number, height: number, extend: number): number {
  return strandY(t, height, strandStretch(extend, 1));
}

/**
 * One shared shuffle bag for the page session.
 * PC and phone draw from it together. Zoom, redraw, and clearing a sheet do not refill it.
 * A full reload starts a new bag. An asset is spent only when a sheet is actually placed.
 * A file that is not ready yet stays in the cycle and is tried again later.
 */
let bag: LiquidAssetId[] = [];
let lastDrawn: LiquidAssetId | null = null;
let bagRandom: () => number = Math.random;

export function resetLiquidBag(): void {
  bag = [];
  lastDrawn = null;
}

export function setLiquidBagRandom(random: () => number): void {
  bagRandom = random;
}

export function liquidBagSize(): number {
  return bag.length;
}

function refillBag() {
  const next = LIQUID_ASSET_IDS.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(bagRandom() * (i + 1));
    const swap = next[i] as LiquidAssetId;
    next[i] = next[j] as LiquidAssetId;
    next[j] = swap;
  }
  if (lastDrawn && next[0] === lastDrawn && next.length > 1) {
    const j = 1 + Math.floor(bagRandom() * (next.length - 1));
    const swap = next[0] as LiquidAssetId;
    next[0] = next[j] as LiquidAssetId;
    next[j] = swap;
  }
  bag = next;
}

/** Next unused sheet, or null when every sheet is refused. Does not spend a refused sheet. */
export function claimLiquidAsset(usable: (id: LiquidAssetId) => boolean = () => true): LiquidAssetId | null {
  const pull = (): LiquidAssetId | null => {
    if (bag.length === 0) refillBag();
    const skipped: LiquidAssetId[] = [];
    while (bag.length > 0) {
      const id = bag.shift() as LiquidAssetId;
      if (usable(id)) {
        bag = bag.concat(skipped);
        lastDrawn = id;
        return id;
      }
      skipped.push(id);
    }
    bag = skipped;
    return null;
  };
  const first = pull();
  if (first) return first;
  // The sheets left in the bag are all refused. A new cycle can still hold one this draw may use.
  if (bag.length === 0 || bag.length >= LIQUID_ASSET_IDS.length) return null;
  const held = bag.slice();
  bag = [];
  const second = pull();
  if (!second) return null;
  const seen = new Set(bag);
  bag = bag.concat(held.filter((id) => !seen.has(id)));
  return second;
}

function makeSheet(world: LiquidWorld, showAt: number, asset: LiquidAssetId): LiquidSprite {
  const aspect = world.aspect > 0.05 ? world.aspect : 1;
  const h = aspect / liquidSheetAspect(asset);
  return {
    id: world.seq++,
    asset,
    u: 0.5,
    v: h / 2,
    w: 1,
    h,
    rotation: 0,
    flip: false,
    extend: 0,
    paces: rollLiquidPaces(),
    bands: Array.from({ length: LIQUID_PACE_BANDS }, () => 0),
    showAt,
  };
}

/**
 * One full-width sheet when no box is set. One sheet per box otherwise, all in a single group.
 * Sheets in one shot are different assets until the cutouts run out, then a real cutout is reused.
 * With a range set, liquid_cutout_test_05 is left out. With no range, every cutout can be drawn.
 * The gesture position is remembered and does not move the sheets.
 * Null when the layer cap is full, or when no sheet is ready to draw.
 * A full layer does not spend a sheet. PC and phone share this placement and the bag.
 */
export function claimLiquidSet(count: number, usable: (id: LiquidAssetId) => boolean = () => true): LiquidAssetId[] {
  const want = Math.max(0, Math.floor(count));
  const picked: LiquidAssetId[] = [];
  const used = new Set<LiquidAssetId>();
  for (let i = 0; i < want; i++) {
    const id = claimLiquidAsset((asset) => usable(asset) && !used.has(asset));
    if (!id) break;
    used.add(id);
    picked.push(id);
  }
  if (picked.length === 0 || picked.length === want) return picked;
  const unique = picked.slice();
  let cursor = 0;
  while (picked.length < want) {
    picked.push(unique[cursor % unique.length]!);
    cursor += 1;
  }
  return picked;
}

export function placeLiquid(
  world: LiquidWorld,
  u: number,
  v: number,
  usable?: (id: LiquidAssetId) => boolean,
): LiquidGroup | null {
  if (world.groups.length >= liquidGroupCap(world.phone)) return null;
  world.aimU = clamp01(u);
  world.aimV = clamp01(v);
  const started = world.time;
  const showAt = started + liquidShowDelay();
  const ranges = world.ranges;
  const sprites: LiquidSprite[] = [];
  if (ranges.length === 0) {
    const asset = claimLiquidAsset(usable);
    if (!asset) return null;
    sprites.push(makeSheet(world, showAt, asset));
  } else {
    const assets = claimLiquidSet(ranges.length, (id) => id !== "liquid_cutout_test_05" && (usable ? usable(id) : true));
    if (assets.length === 0) return null;
    for (let i = 0; i < ranges.length && i < assets.length; i++) {
      const asset = assets[i];
      if (!asset) break;
      const sprite = makeSheet(world, showAt, asset);
      const id = ranges[i]?.id;
      if (typeof id === "number" && Number.isFinite(id)) sprite.rangeId = id;
      sprites.push(sprite);
    }
    if (sprites.length === 0) return null;
  }
  const group: LiquidGroup = {
    id: world.seq++,
    sprites,
    started,
    showAt,
  };
  world.groups.push(group);
  return group;
}

/** Power of the middle stretch. Same curve as {@link strandY}. */
const LIQUID_PACE_POWER = 0.6;

function paceExtra(t0: number, t1: number, stretch: number, height: number): number {
  const amount = Math.min(1, Math.max(0, stretch)) * height;
  if (!(amount > 0) || !(t1 > t0)) return 0;
  const span = LIQUID_TIP - LIQUID_HINGE;
  const a = Math.max(t0, LIQUID_HINGE);
  const b = Math.min(t1, LIQUID_TIP);
  if (!(b > a) || !(span > 0)) return 0;
  const u0 = (a - LIQUID_HINGE) / span;
  const u1 = (b - LIQUID_HINGE) / span;
  return amount * (Math.pow(u1, LIQUID_PACE_POWER) - Math.pow(u0, LIQUID_PACE_POWER));
}

/**
 * Local Y of source fraction `t` when each vertical fifth has its own stretch.
 * The parts are stacked, so the boundary is shared instead of cut apart.
 * When every stretch equals `S`, this matches {@link strandY}.
 */
export function liquidPaceY(t: number, height: number, stretches: ArrayLike<number>): number {
  const bands = stretches.length;
  const clamped = Math.min(1, Math.max(0, t));
  if (!(bands > 0)) return clamped * height;
  let extra = 0;
  for (let r = 0; r < bands; r++) {
    const t0 = r / bands;
    if (clamped <= t0) break;
    const t1 = (r + 1) / bands;
    extra += paceExtra(t0, Math.min(clamped, t1), stretches[r] ?? 0, height);
    if (clamped <= t1) break;
  }
  return clamped * height + extra;
}

export function stepLiquid(world: LiquidWorld, dt: number) {
  const step = Math.min(0.05, Math.max(0, dt));
  if (!(step > 0)) return;
  world.time += step;
  const life = liquidLife();
  const alive: LiquidGroup[] = [];
  for (const group of world.groups) {
    const displayed = world.time - group.showAt;
    if (displayed >= life) continue;
    for (const sprite of group.sprites) {
      if (world.time < sprite.showAt) continue;
      const rate = liquidExtendRate(world.time - sprite.showAt);
      if (sprite.extend < 1) sprite.extend = Math.min(1, sprite.extend + step * rate);
      const bands = sprite.bands;
      const paces = sprite.paces;
      const count = Math.min(bands.length, paces.length);
      for (let i = 0; i < count; i++) {
        const value = bands[i] ?? 0;
        if (value >= 1) continue;
        const pace = Math.min(LIQUID_PACE_MAX, Math.max(LIQUID_PACE_MIN, paces[i] ?? 1));
        bands[i] = Math.min(1, value + step * rate * pace);
      }
    }
    alive.push(group);
  }
  if (alive.length !== world.groups.length) world.groups = alive;
}

/**
 * Groups whose white flash just ended.
 * The sheet starts stretching at showAt, under the last solid blink.
 * The drip sound waits until that blink is gone, which is when the liquid is actually visible.
 */
export function takeLiquidDrips(world: LiquidWorld, beforeTime: number, flash = LIQUID_FLASH): LiquidGroup[] {
  const hits: LiquidGroup[] = [];
  for (const group of world.groups) {
    const at = group.started + liquidFlashDuration(flash);
    if (beforeTime < at && world.time >= at) hits.push(group);
  }
  return hits;
}

/**
 * Stick deflection, length clamped to 1, mapped so a full push lands on the image border.
 * Center is the middle of the photo. A corner of the circle reaches a corner of the photo.
 */
export function stickAim(nx: number, ny: number): { u: number; v: number } {
  const mag = Math.hypot(nx, ny);
  if (!(mag > 1e-4)) return { u: 0.5, v: 0.5 };
  const scale = Math.min(1, mag);
  const dx = nx / mag;
  const dy = ny / mag;
  const tx = Math.abs(dx) < 1e-6 ? Infinity : 0.5 / Math.abs(dx);
  const ty = Math.abs(dy) < 1e-6 ? Infinity : 0.5 / Math.abs(dy);
  const edge = Math.min(tx, ty);
  return {
    u: clamp01(0.5 + dx * edge * scale),
    v: clamp01(0.5 + dy * edge * scale),
  };
}

/** Knob stays inside the circle. Past the rim, direction is kept and the reach stays at the rim. */
export function stickKnob(dx: number, dy: number, radius: number): { x: number; y: number } & { nx: number; ny: number } {
  if (!(radius > 0)) return { x: 0, y: 0, nx: 0, ny: 0 };
  const mag = Math.hypot(dx, dy);
  const limit = mag > radius ? radius / mag : 1;
  const x = dx * limit;
  const y = dy * limit;
  return { x, y, nx: x / radius, ny: y / radius };
}
