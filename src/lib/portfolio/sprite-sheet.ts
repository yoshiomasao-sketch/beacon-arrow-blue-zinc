/**
 * Sprite-sheet editing math shared by the editor, the preview, and GIF export.
 * Display zoom is not part of these pixels. Flips are playback-only; the sheet PNG stays unflipped.
 */

export const SPRITE_MAX = 256;
export const SPRITE_DOC_KEY = "spriteDoc";

export type SpriteLoop = "infinite" | "count" | "once";
export type SpriteOrder = "forward" | "reverse" | "pingpong";
export type SheetLayout = "row" | "column" | "wrap";
export type SpriteBackground = "clear" | "checker" | "solid";

export type SpritePivot = { x: number; y: number };

export const PIVOT_PRESETS = [
  { id: "nw", label: "左上", x: 0, y: 0 },
  { id: "n", label: "上中央", x: 0.5, y: 0 },
  { id: "ne", label: "右上", x: 1, y: 0 },
  { id: "w", label: "左中央", x: 0, y: 0.5 },
  { id: "c", label: "中央", x: 0.5, y: 0.5 },
  { id: "e", label: "右中央", x: 1, y: 0.5 },
  { id: "sw", label: "左下", x: 0, y: 1 },
  { id: "s", label: "下中央", x: 0.5, y: 1 },
  { id: "se", label: "右下", x: 1, y: 1 },
] as const;

export type PivotPresetId = (typeof PIVOT_PRESETS)[number]["id"];

export function readPivot(value: unknown): SpritePivot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const pivot = value as { x?: unknown; y?: unknown };
  if (typeof pivot.x !== "number" || typeof pivot.y !== "number") return undefined;
  if (!Number.isFinite(pivot.x) || !Number.isFinite(pivot.y)) return undefined;
  return { x: pivot.x, y: pivot.y };
}

export function defaultPivot(width: number, height: number): SpritePivot {
  return { x: width / 2, y: height / 2 };
}

/** Stored pivot, or the center when an older frame has none. */
export function framePivot(frame: Pick<SpriteFrame, "width" | "height" | "pivot">): SpritePivot {
  const stored = readPivot(frame.pivot);
  if (stored) return stored;
  return defaultPivot(frame.width, frame.height);
}

export function presetPivot(width: number, height: number, id: string): SpritePivot | null {
  const preset = PIVOT_PRESETS.find((entry) => entry.id === id);
  if (!preset) return null;
  return { x: width * preset.x, y: height * preset.y };
}

/** Pivot after playback flips, still measured from the frame's top-left. */
export function visualPivot(frame: Pick<SpriteFrame, "width" | "height" | "pivot" | "flipX" | "flipY">): SpritePivot {
  const pivot = framePivot(frame);
  return {
    x: frame.flipX ? frame.width - pivot.x : pivot.x,
    y: frame.flipY ? frame.height - pivot.y : pivot.y,
  };
}

/** Undo a playback flip so a click on the preview lands in stored frame space. */
export function pivotFromVisual(frame: Pick<SpriteFrame, "width" | "height" | "flipX" | "flipY">, x: number, y: number): SpritePivot {
  return {
    x: frame.flipX ? frame.width - x : x,
    y: frame.flipY ? frame.height - y : y,
  };
}

/** Where this frame's pivot sits on a sheet. Frames stay at the top-left of their cell. */
export function frameSheetPivot(frame: Pick<SpriteFrame, "width" | "height" | "pivot">, col: number, row: number, cellW: number, cellH: number): SpritePivot {
  const pivot = framePivot(frame);
  return { x: col * cellW + pivot.x, y: row * cellH + pivot.y };
}

export function slicePivot(slice: Pick<SpriteSlice, "width" | "height" | "pivot">): SpritePivot {
  const stored = readPivot(slice.pivot);
  if (stored) return stored;
  return { x: slice.width / 2, y: slice.height / 2 };
}

export function sliceSheetPivot(slice: Pick<SpriteSlice, "x" | "y" | "width" | "height" | "pivot">): SpritePivot {
  const pivot = slicePivot(slice);
  return { x: slice.x + pivot.x, y: slice.y + pivot.y };
}

export function readSlices(value: unknown): SpriteSlice[] {
  if (!Array.isArray(value)) return [];
  const slices: SpriteSlice[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as { id?: unknown; number?: unknown; name?: unknown; x?: unknown; y?: unknown; width?: unknown; height?: unknown; pivot?: unknown };
    const id = typeof item.id === "string" ? item.id : "";
    const x = typeof item.x === "number" ? item.x : Number.NaN;
    const y = typeof item.y === "number" ? item.y : Number.NaN;
    const width = typeof item.width === "number" ? item.width : Number.NaN;
    const height = typeof item.height === "number" ? item.height : Number.NaN;
    const number = typeof item.number === "number" ? item.number : Number.NaN;
    if (!id || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(number)) continue;
    if (width < 1 || height < 1) continue;
    const index = Math.max(1, Math.round(number));
    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 40) : `Slice ${index}`;
    slices.push({
      id,
      number: index,
      name,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      pivot: readPivot(item.pivot) ?? null,
    });
  }
  return slices;
}

export function nextSliceNumber(slices: readonly SpriteSlice[]): number {
  return slices.reduce((max, slice) => Math.max(max, slice.number), 0) + 1;
}

/** Whole pixels touched by a drag. Stays inside the sheet. A tap is one pixel. */
export function pixelRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  sheetW: number,
  sheetH: number,
): { x: number; y: number; width: number; height: number } | null {
  if (sheetW < 1 || sheetH < 1) return null;
  let left = Math.floor(Math.min(ax, bx));
  let top = Math.floor(Math.min(ay, by));
  let right = Math.ceil(Math.max(ax, bx));
  let bottom = Math.ceil(Math.max(ay, by));
  if (right <= left) right = left + 1;
  if (bottom <= top) bottom = top + 1;
  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(sheetW, right);
  bottom = Math.min(sheetH, bottom);
  if (right - left < 1 || bottom - top < 1) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function moveSlice(slice: SpriteSlice, dx: number, dy: number, sheetW: number, sheetH: number): SpriteSlice {
  const x = Math.max(0, Math.min(sheetW - slice.width, slice.x + Math.round(dx)));
  const y = Math.max(0, Math.min(sheetH - slice.height, slice.y + Math.round(dy)));
  return { ...slice, x, y };
}

export function resizeSlice(slice: SpriteSlice, edge: SliceEdge, dx: number, dy: number, sheetW: number, sheetH: number): SpriteSlice {
  const rdx = Math.round(dx);
  const rdy = Math.round(dy);
  let left = slice.x;
  let top = slice.y;
  let right = slice.x + slice.width;
  let bottom = slice.y + slice.height;
  if (edge === "w" || edge === "nw" || edge === "sw") left += rdx;
  if (edge === "e" || edge === "ne" || edge === "se") right += rdx;
  if (edge === "n" || edge === "nw" || edge === "ne") top += rdy;
  if (edge === "s" || edge === "sw" || edge === "se") bottom += rdy;
  left = Math.max(0, Math.min(left, sheetW - 1));
  top = Math.max(0, Math.min(top, sheetH - 1));
  right = Math.min(sheetW, Math.max(right, left + 1));
  bottom = Math.min(sheetH, Math.max(bottom, top + 1));
  return { ...slice, x: left, y: top, width: right - left, height: bottom - top };
}

export function placeSlice(slice: SpriteSlice, x: number, y: number, width: number, height: number, sheetW: number, sheetH: number): SpriteSlice | null {
  const nextW = Math.round(width);
  const nextH = Math.round(height);
  if (!Number.isFinite(x) || !Number.isFinite(y) || nextW < 1 || nextH < 1 || nextW > sheetW || nextH > sheetH) return null;
  return {
    ...slice,
    x: Math.max(0, Math.min(sheetW - nextW, Math.round(x))),
    y: Math.max(0, Math.min(sheetH - nextH, Math.round(y))),
    width: nextW,
    height: nextH,
  };
}

/** Copies one rectangle. The source buffer is not changed. Returns null when the rectangle leaves the sheet. */
export function slicePixels(rgba: Uint8ClampedArray, sheetW: number, sheetH: number, slice: Pick<SpriteSlice, "x" | "y" | "width" | "height">): Uint8ClampedArray | null {
  if (slice.width < 1 || slice.height < 1 || slice.x < 0 || slice.y < 0) return null;
  if (slice.x + slice.width > sheetW || slice.y + slice.height > sheetH) return null;
  const out = new Uint8ClampedArray(slice.width * slice.height * 4);
  for (let y = 0; y < slice.height; y += 1) {
    const from = ((slice.y + y) * sheetW + slice.x) * 4;
    out.set(rgba.subarray(from, from + slice.width * 4), y * slice.width * 4);
  }
  return out;
}

export function sameSpriteSlices(a: readonly SpriteSlice[], b: readonly SpriteSlice[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((slice, index) => {
    const other = b[index];
    return !!other
      && slice.id === other.id
      && slice.number === other.number
      && slice.name === other.name
      && slice.x === other.x
      && slice.y === other.y
      && slice.width === other.width
      && slice.height === other.height
      && slice.pivot?.x === other.pivot?.x
      && slice.pivot?.y === other.pivot?.y;
  });
}

export type SpriteFrame = {
  id: string;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  durationMs: number | null;
  flipX: boolean;
  flipY: boolean;
  /** Source label such as `GIF 3`. Absent on frames that were not dragged from a GIF. */
  origin?: string | null;
  /**
   * Pivot in this frame's pixels. The image top-left is 0,0 and the bottom-right is width,height.
   * Absent means the center. Values may lie outside the image.
   */
  pivot?: SpritePivot | null;
};

export type SpriteSlice = {
  id: string;
  /** Stable display number. Deleting another slice does not renumber this one. */
  number: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Pivot inside the slice. Absent means the center. Top-left of the slice is 0,0. */
  pivot?: SpritePivot | null;
};

export const NINE_MAX = 2048;

export type NineFilter = "nearest" | "bilinear";

/** Margins are source pixels. The center may be zero, but the guides never cross. */
export type NineSlice = {
  frameId: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  filter: NineFilter;
  previewWidth: number;
  previewHeight: number;
};

export type NineEdge = "left" | "right" | "top" | "bottom";

export type SliceEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type SpriteDoc = {
  name: string;
  fps: number;
  speed: number;
  loop: SpriteLoop;
  loopCount: number;
  order: SpriteOrder;
  startFrame: number;
  endFrame: number;
  layout: SheetLayout;
  columns: number;
  zoom: number;
  previewZoom: number;
  background: SpriteBackground;
  solid: string;
  frames: SpriteFrame[];
  /** Atlas rectangles. Independent of frames. Absent on older saves. */
  slices: SpriteSlice[];
  /** 9-slice settings keyed by frame id. Absent on older saves. Pixels stay untouched. */
  nines: NineSlice[];
};

export type SpriteStep = { index: number; ms: number };

export function emptySpriteDoc(): SpriteDoc {
  return {
    name: "スプライト",
    fps: 12,
    speed: 1,
    loop: "infinite",
    loopCount: 3,
    order: "forward",
    startFrame: 1,
    endFrame: 1,
    layout: "row",
    columns: 4,
    zoom: 4,
    previewZoom: 4,
    background: "checker",
    solid: "#202020",
    frames: [],
    slices: [],
    nines: [],
  };
}

export function frameSizeReason(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return "画像のサイズを読めません。";
  if (width > SPRITE_MAX || height > SPRITE_MAX) return `${Math.round(width)}×${Math.round(height)}は256×256を超えているため登録できません。`;
  return null;
}

/** Fit inside the sprite limit. Frames that already fit stay at their exact size. */
export function fittedSize(width: number, height: number, max = SPRITE_MAX): { width: number; height: number } {
  const safeW = Math.max(1, Math.round(width) || 1);
  const safeH = Math.max(1, Math.round(height) || 1);
  if (safeW <= max && safeH <= max) return { width: safeW, height: safeH };
  const scale = max / Math.max(safeW, safeH);
  return {
    width: Math.max(1, Math.min(max, Math.round(safeW * scale))),
    height: Math.max(1, Math.min(max, Math.round(safeH * scale))),
  };
}

/** Nearest-neighbor resample. Each output pixel copies one source pixel, including alpha. */
export function scaleNearest(src: Uint8ClampedArray, width: number, height: number, nextW: number, nextH: number): Uint8ClampedArray {
  if (nextW === width && nextH === height) return src;
  const out = new Uint8ClampedArray(nextW * nextH * 4);
  for (let y = 0; y < nextH; y += 1) {
    const sy = Math.min(height - 1, Math.floor(((y + 0.5) * height) / nextH));
    for (let x = 0; x < nextW; x += 1) {
      const sx = Math.min(width - 1, Math.floor(((x + 0.5) * width) / nextW));
      const from = (sy * width + sx) * 4;
      const to = (y * nextW + x) * 4;
      out[to] = src[from] ?? 0;
      out[to + 1] = src[from + 1] ?? 0;
      out[to + 2] = src[from + 2] ?? 0;
      out[to + 3] = src[from + 3] ?? 0;
    }
  }
  return out;
}

/** Display box for a pixel image. Enlargement stays on a whole multiple. Shrink only when 1× does not fit. */
export function integerPixelFit(
  boxW: number,
  boxH: number,
  imageW: number,
  imageH: number,
): { scale: number; width: number; height: number; x: number; y: number; integer: boolean } {
  const widthBudget = Math.max(0, boxW);
  const heightBudget = Math.max(0, boxH);
  const sourceW = Math.max(1, Math.round(imageW) || 1);
  const sourceH = Math.max(1, Math.round(imageH) || 1);
  if (widthBudget < 1 || heightBudget < 1) {
    return { scale: 1, width: sourceW, height: sourceH, x: 0, y: 0, integer: true };
  }
  const fit = Math.min(widthBudget / sourceW, heightBudget / sourceH);
  if (fit >= 1) {
    const scale = Math.max(1, Math.floor(fit));
    const width = sourceW * scale;
    const height = sourceH * scale;
    return {
      scale,
      width,
      height,
      x: Math.floor((widthBudget - width) / 2),
      y: Math.floor((heightBudget - height) / 2),
      integer: true,
    };
  }
  const width = sourceW * fit;
  const height = sourceH * fit;
  return {
    scale: fit,
    width,
    height,
    x: Math.floor((widthBudget - width) / 2),
    y: Math.floor((heightBudget - height) / 2),
    integer: false,
  };
}

/** Still pixel art no wider than the pixel canvas. Larger photos stay smooth. */
export const PIXEL_ART_EDGE = 256;

export function isSmallPixelArt(imageW: number, imageH: number): boolean {
  if (!(imageW > 0) || !(imageH > 0)) return false;
  return Math.max(imageW, imageH) <= PIXEL_ART_EDGE;
}

/** Gallery enlarge view. GIFs and small still pixel art stay nearest-neighbor. Larger images do when the box at least doubles them. */
export function enlargedPixelView(imageW: number, imageH: number, viewW: number, viewH: number, gif: boolean): boolean {
  if (gif) return true;
  if (!(imageW > 0) || !(imageH > 0) || !(viewW > 0) || !(viewH > 0)) return false;
  if (isSmallPixelArt(imageW, imageH)) return true;
  return Math.min(viewW / imageW, viewH / imageH) >= 2;
}

export function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(4, Math.max(0.25, speed));
}

export function clampFps(fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return 12;
  return Math.min(60, Math.max(1, fps));
}

/** Stored frame time. 10ms steps, from 10ms through 5000ms. */
export function clampHoldMs(value: number, fallback = 100): number {
  const source = Number.isFinite(value) ? value : fallback;
  const snapped = Math.round((Number.isFinite(source) ? source : 100) / 10) * 10;
  return Math.max(10, Math.min(5000, snapped));
}

/** Initial time for a new frame. 10 FPS is 100ms. Existing frames are not rewritten. */
export function fpsHoldMs(fps: number): number {
  return clampHoldMs(1000 / clampFps(fps));
}

/** Milliseconds both the preview and the GIF use. GIF delays are centiseconds, so this snaps to 10ms. */
export function holdMs(frame: { durationMs: number | null }, fps: number, speed: number): number {
  const base = frame.durationMs != null && frame.durationMs > 0 ? frame.durationMs : 1000 / clampFps(fps);
  return Math.max(10, Math.round(base / clampSpeed(speed) / 10) * 10);
}

export function rangeIndexes(count: number, startFrame: number, endFrame: number): number[] {
  if (count <= 0) return [];
  const start = Math.min(count, Math.max(1, Math.round(startFrame) || 1));
  const end = Math.min(count, Math.max(1, Math.round(endFrame) || count));
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const list: number[] = [];
  for (let frame = lo; frame <= hi; frame += 1) list.push(frame - 1);
  return list;
}

/** Ping-pong adds the return trip without repeating an endpoint that the next pass already shows. Two frames still step back to the first. */
export function orderedIndexes(range: readonly number[], order: SpriteOrder): number[] {
  const forward = range.slice();
  if (order === "reverse") return forward.reverse();
  if (order !== "pingpong" || forward.length <= 1) return forward;
  const back = forward.length === 2 ? [forward[0]!] : forward.slice(1, -1).reverse();
  return forward.concat(back);
}

export function playbackTimeline(doc: Pick<SpriteDoc, "frames" | "fps" | "speed" | "order" | "startFrame" | "endFrame">): SpriteStep[] {
  const range = rangeIndexes(doc.frames.length, doc.startFrame, doc.endFrame);
  return orderedIndexes(range, doc.order).map((index) => ({
    index,
    ms: holdMs(doc.frames[index]!, doc.fps, doc.speed),
  }));
}

/** On-screen cycle. A ping-pong pass that starts and ends on the same frame drops that repeated end so a loop does not show it twice. GIF export stays on playbackTimeline. */
export function playbackPreviewSteps(doc: Pick<SpriteDoc, "frames" | "fps" | "speed" | "order" | "startFrame" | "endFrame">): SpriteStep[] {
  const steps = playbackTimeline(doc);
  if (doc.order !== "pingpong" || steps.length < 2) return steps;
  if (steps[0]!.index === steps[steps.length - 1]!.index) return steps.slice(0, -1);
  return steps;
}

/** Where a finished once/count run rests. Ping-pong rests on the first frame of the pass. */
export function playbackStopIndex(steps: readonly SpriteStep[], order: SpriteOrder): number {
  if (steps.length === 0) return 0;
  if (order === "pingpong") return steps[0]!.index;
  return steps[steps.length - 1]!.index;
}

/** gifenc: -1 plays once, 0 repeats forever, N is extra repeats after the first play. */
export function gifRepeatCount(loop: SpriteLoop, loopCount: number): number {
  if (loop === "infinite") return 0;
  if (loop === "once") return -1;
  const times = Math.max(1, Math.round(loopCount) || 1);
  if (times <= 1) return -1;
  return times - 1;
}

export function sheetGrid(count: number, layout: SheetLayout, columns: number): { cols: number; rows: number } {
  if (count <= 0) return { cols: 0, rows: 0 };
  if (layout === "column") return { cols: 1, rows: count };
  if (layout === "wrap") {
    const cols = Math.max(1, Math.min(count, Math.round(columns) || 1));
    return { cols, rows: Math.ceil(count / cols) };
  }
  return { cols: count, rows: 1 };
}

export function cellSize(frames: readonly { width: number; height: number }[]): { width: number; height: number } {
  let width = 1;
  let height = 1;
  for (const frame of frames) {
    width = Math.max(width, frame.width);
    height = Math.max(height, frame.height);
  }
  return { width, height };
}

export function orientedRgba(src: Uint8ClampedArray, width: number, height: number, flipX: boolean, flipY: boolean): Uint8ClampedArray {
  if (!flipX && !flipY) return src;
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = flipX ? width - 1 - x : x;
      const sy = flipY ? height - 1 - y : y;
      const from = (sy * width + sx) * 4;
      const to = (y * width + x) * 4;
      out[to] = src[from] ?? 0;
      out[to + 1] = src[from + 1] ?? 0;
      out[to + 2] = src[from + 2] ?? 0;
      out[to + 3] = src[from + 3] ?? 0;
    }
  }
  return out;
}

export function cellRgba(frame: SpriteFrame, cellW: number, cellH: number): Uint8ClampedArray {
  const oriented = orientedRgba(frame.rgba, frame.width, frame.height, frame.flipX, frame.flipY);
  const out = new Uint8ClampedArray(cellW * cellH * 4);
  const copyW = Math.min(cellW, frame.width);
  const copyH = Math.min(cellH, frame.height);
  for (let y = 0; y < copyH; y += 1) {
    const from = y * frame.width * 4;
    const to = y * cellW * 4;
    out.set(oriented.subarray(from, from + copyW * 4), to);
  }
  return out;
}

export const SPRITE_ONION_KEY = "spriteOnion";

export type OnionSkin = {
  on: boolean;
  before: number;
  after: number;
  beforeOpacity: number;
  afterOpacity: number;
};

export function emptyOnionSkin(): OnionSkin {
  return { on: false, before: 1, after: 1, beforeOpacity: 25, afterOpacity: 25 };
}

export function clampOnionCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(3, Math.round(value)));
}

export function clampOnionOpacity(value: number): number {
  if (!Number.isFinite(value)) return 25;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Closest frame uses the slider. The next is about 70%, and the one after that about 40%. */
export function onionFalloff(distance: number): number {
  if (distance === 1) return 1;
  if (distance === 2) return 0.7;
  if (distance === 3) return 0.4;
  return 0;
}

export function onionAlphaScale(basePercent: number, distance: number): number {
  return (clampOnionOpacity(basePercent) / 100) * onionFalloff(distance);
}

export type OnionLayer = { index: number; side: "before" | "after"; distance: number };

/** Frames under the current one. Farther frames are listed first. The ends do not wrap. */
export function onionLayers(frameCount: number, index: number, before: number, after: number): OnionLayer[] {
  const layers: OnionLayer[] = [];
  if (frameCount < 1) return layers;
  const current = Math.max(0, Math.min(frameCount - 1, Math.floor(index)));
  const prev = clampOnionCount(before);
  const next = clampOnionCount(after);
  for (let distance = prev; distance >= 1; distance -= 1) {
    const at = current - distance;
    if (at >= 0) layers.push({ index: at, side: "before", distance });
  }
  for (let distance = next; distance >= 1; distance -= 1) {
    const at = current + distance;
    if (at < frameCount) layers.push({ index: at, side: "after", distance });
  }
  return layers;
}

const ONION_BEFORE = { r: 214, g: 42, b: 52 };
const ONION_AFTER = { r: 42, g: 108, b: 232 };
const ONION_MIX = 0.75;

/** Display copy. The source buffer is not written. */
export function tintOnionFrame(src: Uint8ClampedArray, side: "before" | "after", alphaScale: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const scale = Math.max(0, Math.min(1, alphaScale));
  if (scale <= 0) return out;
  const tint = side === "before" ? ONION_BEFORE : ONION_AFTER;
  const keep = 1 - ONION_MIX;
  for (let index = 0; index < src.length; index += 4) {
    const alpha = src[index + 3] ?? 0;
    if (alpha <= 0) continue;
    out[index] = Math.round((src[index] ?? 0) * keep + tint.r * ONION_MIX);
    out[index + 1] = Math.round((src[index + 1] ?? 0) * keep + tint.g * ONION_MIX);
    out[index + 2] = Math.round((src[index + 2] ?? 0) * keep + tint.b * ONION_MIX);
    out[index + 3] = Math.round(alpha * scale);
  }
  return out;
}

export function compositeOver(dst: Uint8ClampedArray, src: Uint8ClampedArray): void {
  const length = Math.min(dst.length, src.length);
  for (let index = 0; index < length; index += 4) {
    const sourceA = (src[index + 3] ?? 0) / 255;
    if (sourceA <= 0) continue;
    const destA = (dst[index + 3] ?? 0) / 255;
    const outA = sourceA + destA * (1 - sourceA);
    if (outA <= 0) {
      dst[index] = 0;
      dst[index + 1] = 0;
      dst[index + 2] = 0;
      dst[index + 3] = 0;
      continue;
    }
    dst[index] = Math.round(((src[index] ?? 0) * sourceA + (dst[index] ?? 0) * destA * (1 - sourceA)) / outA);
    dst[index + 1] = Math.round(((src[index + 1] ?? 0) * sourceA + (dst[index + 1] ?? 0) * destA * (1 - sourceA)) / outA);
    dst[index + 2] = Math.round(((src[index + 2] ?? 0) * sourceA + (dst[index + 2] ?? 0) * destA * (1 - sourceA)) / outA);
    dst[index + 3] = Math.round(outA * 255);
  }
}

/**
 * Preview pixels only. Previous frames sit under next frames, and the current frame stays on top.
 * Playback and a switched-off skin return the current frame alone. Frame buffers are not edited.
 */
export function composeOnionPreview(
  frames: readonly SpriteFrame[],
  index: number,
  cellW: number,
  cellH: number,
  skin: OnionSkin,
  playing: boolean,
): Uint8ClampedArray | null {
  if (frames.length === 0 || cellW < 1 || cellH < 1) return null;
  const current = Math.max(0, Math.min(frames.length - 1, Math.floor(index)));
  const frame = frames[current];
  if (!frame) return null;
  const top = cellRgba(frame, cellW, cellH);
  if (!skin.on || playing) return top;
  const display = new Uint8ClampedArray(cellW * cellH * 4);
  for (const layer of onionLayers(frames.length, current, skin.before, skin.after)) {
    const source = frames[layer.index];
    if (!source) continue;
    const base = layer.side === "before" ? skin.beforeOpacity : skin.afterOpacity;
    const scale = onionAlphaScale(base, layer.distance);
    if (scale <= 0) continue;
    compositeOver(display, tintOnionFrame(cellRgba(source, cellW, cellH), layer.side, scale));
  }
  compositeOver(display, top);
  return display;
}

export function parseOnionSkin(raw: string): OnionSkin {
  const fallback = emptyOnionSkin();
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw) as Partial<OnionSkin>;
    if (!value || typeof value !== "object") return fallback;
    return {
      on: value.on === true,
      before: clampOnionCount(typeof value.before === "number" ? value.before : fallback.before),
      after: clampOnionCount(typeof value.after === "number" ? value.after : fallback.after),
      beforeOpacity: clampOnionOpacity(typeof value.beforeOpacity === "number" ? value.beforeOpacity : fallback.beforeOpacity),
      afterOpacity: clampOnionOpacity(typeof value.afterOpacity === "number" ? value.afterOpacity : fallback.afterOpacity),
    };
  } catch {
    return fallback;
  }
}

export function encodeOnionSkin(skin: OnionSkin): string {
  return JSON.stringify({
    on: skin.on === true,
    before: clampOnionCount(skin.before),
    after: clampOnionCount(skin.after),
    beforeOpacity: clampOnionOpacity(skin.beforeOpacity),
    afterOpacity: clampOnionOpacity(skin.afterOpacity),
  });
}

function blit(dest: Uint8ClampedArray, destW: number, src: Uint8ClampedArray, srcW: number, srcH: number, ox: number, oy: number) {
  for (let y = 0; y < srcH; y += 1) {
    const from = y * srcW * 4;
    const to = ((oy + y) * destW + ox) * 4;
    dest.set(src.subarray(from, from + srcW * 4), to);
  }
}

export function composeSheet(doc: Pick<SpriteDoc, "frames" | "layout" | "columns">): {
  width: number;
  height: number;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  rgba: Uint8ClampedArray;
} {
  const cell = cellSize(doc.frames);
  const grid = sheetGrid(doc.frames.length, doc.layout, doc.columns);
  const width = Math.max(1, grid.cols * cell.width);
  const height = Math.max(1, grid.rows * cell.height);
  const rgba = new Uint8ClampedArray(width * height * 4);
  doc.frames.forEach((frame, index) => {
    const col = grid.cols === 0 ? 0 : index % grid.cols;
    const row = grid.cols === 0 ? 0 : Math.floor(index / grid.cols);
    blit(rgba, width, frame.rgba, frame.width, frame.height, col * cell.width, row * cell.height);
  });
  return { width, height, cols: grid.cols, rows: grid.rows, cellW: cell.width, cellH: cell.height, rgba };
}

export function playbackFrames(doc: SpriteDoc): { width: number; height: number; steps: { rgba: Uint8ClampedArray; ms: number }[] } {
  const cell = cellSize(doc.frames);
  const steps = playbackTimeline(doc).map((step) => ({
    rgba: cellRgba(doc.frames[step.index]!, cell.width, cell.height),
    ms: step.ms,
  }));
  return { width: cell.width, height: cell.height, steps };
}

export type SpriteSettings = {
  name: string;
  frameWidth: number;
  frameHeight: number;
  rows: number;
  columns: number;
  frameCount: number;
  fps: number;
  speed: number;
  loop: SpriteLoop;
  loopCount: number;
  order: SpriteOrder;
  startFrame: number;
  endFrame: number;
  frames: {
    index: number;
    width: number;
    height: number;
    durationMs: number | null;
    playbackMs: number;
    flipX: boolean;
    flipY: boolean;
    origin: string | null;
    pivot: SpritePivot;
    sheetPivot: SpritePivot;
  }[];
  slices: {
    id: string;
    number: number;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    pivot: SpritePivot;
    sheetPivot: SpritePivot;
  }[];
  nines: {
    frameId: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
    filter: NineFilter;
    previewWidth: number;
    previewHeight: number;
  }[];
};

export function spriteSettings(doc: SpriteDoc): SpriteSettings {
  const sheet = composeSheet(doc);
  return {
    name: doc.name.trim() || "スプライト",
    frameWidth: sheet.cellW,
    frameHeight: sheet.cellH,
    rows: sheet.rows,
    columns: sheet.cols,
    frameCount: doc.frames.length,
    fps: clampFps(doc.fps),
    speed: clampSpeed(doc.speed),
    loop: doc.loop,
    loopCount: Math.max(1, Math.round(doc.loopCount) || 1),
    order: doc.order,
    startFrame: doc.frames.length === 0 ? 1 : Math.min(doc.frames.length, Math.max(1, doc.startFrame)),
    endFrame: doc.frames.length === 0 ? 1 : Math.min(doc.frames.length, Math.max(1, doc.endFrame)),
    frames: doc.frames.map((frame, index) => {
      const col = sheet.cols === 0 ? 0 : index % sheet.cols;
      const row = sheet.cols === 0 ? 0 : Math.floor(index / sheet.cols);
      const pivot = framePivot(frame);
      return {
        index: index + 1,
        width: frame.width,
        height: frame.height,
        durationMs: frame.durationMs,
        playbackMs: holdMs(frame, doc.fps, doc.speed),
        flipX: frame.flipX,
        flipY: frame.flipY,
        origin: frame.origin ?? null,
        pivot,
        sheetPivot: frameSheetPivot(frame, col, row, sheet.cellW, sheet.cellH),
      };
    }),
    slices: (doc.slices ?? []).map((slice) => ({
      id: slice.id,
      number: slice.number,
      name: slice.name,
      x: slice.x,
      y: slice.y,
      width: slice.width,
      height: slice.height,
      pivot: slicePivot(slice),
      sheetPivot: sliceSheetPivot(slice),
    })),
    nines: (doc.nines ?? []).map((nine) => ({
      frameId: nine.frameId,
      left: nine.left,
      right: nine.right,
      top: nine.top,
      bottom: nine.bottom,
      filter: nine.filter === "bilinear" ? "bilinear" : "nearest",
      previewWidth: nine.previewWidth,
      previewHeight: nine.previewHeight,
    })),
  };
}

export function adoptFrames(doc: SpriteDoc, frames: SpriteFrame[]): SpriteDoc {
  const prev = doc.frames.length;
  const next = frames.length;
  const end = next === 0 ? 1 : doc.endFrame >= prev ? next : Math.min(doc.endFrame, next);
  const start = next === 0 ? 1 : Math.min(Math.max(1, doc.startFrame), next);
  return { ...doc, frames, startFrame: start, endFrame: Math.max(start, end) };
}

export function shiftFrames(frames: readonly SpriteFrame[], ids: readonly string[], direction: -1 | 1): SpriteFrame[] {
  const selected = new Set(ids);
  if (selected.size === 0 || frames.length < 2 || (direction !== -1 && direction !== 1)) return frames.slice();
  const indexes = frames.map((frame, index) => (selected.has(frame.id) ? index : -1)).filter((index) => index >= 0);
  if (indexes.length === 0) return frames.slice();
  if (direction < 0 && indexes[0] === 0) return frames.slice();
  if (direction > 0 && indexes[indexes.length - 1] === frames.length - 1) return frames.slice();
  const next = frames.slice();
  if (direction < 0) {
    for (const index of indexes) {
      const swap = next[index - 1]!;
      next[index - 1] = next[index]!;
      next[index] = swap;
    }
  } else {
    for (let cursor = indexes.length - 1; cursor >= 0; cursor -= 1) {
      const index = indexes[cursor]!;
      const swap = next[index + 1]!;
      next[index + 1] = next[index]!;
      next[index] = swap;
    }
  }
  return next;
}

export function reorderFrame(frames: readonly SpriteFrame[], fromId: string, toId: string): SpriteFrame[] {
  const from = frames.findIndex((frame) => frame.id === fromId);
  const to = frames.findIndex((frame) => frame.id === toId);
  if (from < 0 || to < 0 || from === to) return frames.slice();
  const next = frames.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export type SpritePick = {
  ids: string[];
  anchorId: string | null;
  activeId: string | null;
};

export function emptySpritePick(): SpritePick {
  return { ids: [], anchorId: null, activeId: null };
}

/** File-list selection. Shift keeps the anchor. Ctrl does not change the frame being edited. */
export function pickSpriteFrames(order: readonly string[], current: SpritePick, id: string, gesture: "single" | "toggle" | "range"): SpritePick {
  if (!order.includes(id)) return current;
  if (gesture === "single") return { ids: [id], anchorId: id, activeId: id };
  if (gesture === "toggle") {
    const ids = current.ids.includes(id)
      ? current.ids.filter((entry) => entry !== id)
      : order.filter((entry) => entry === id || current.ids.includes(entry));
    return { ids, anchorId: id, activeId: current.activeId };
  }
  const anchor = current.anchorId && order.includes(current.anchorId)
    ? current.anchorId
    : current.activeId && order.includes(current.activeId)
      ? current.activeId
      : id;
  const start = order.indexOf(anchor);
  const end = order.indexOf(id);
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return { ids: order.slice(lo, hi + 1), anchorId: anchor, activeId: current.activeId };
}

/** Leaves at least one frame. Deleting every frame keeps the edited one, or the first. */
export function deleteSpriteFrames(frames: readonly SpriteFrame[], ids: readonly string[], activeId: string | null): SpriteFrame[] {
  if (frames.length <= 1 || ids.length === 0) return frames.slice();
  const chosen = new Set(ids);
  const kept = frames.filter((frame) => !chosen.has(frame.id));
  if (kept.length === frames.length) return frames.slice();
  if (kept.length > 0) return kept;
  const keep = frames.find((frame) => frame.id === activeId) ?? frames[0];
  return keep ? [keep] : frames.slice();
}

/** Copies follow the last selected frame, in the original order, each with its own pixels. */
export function duplicateSpriteFrames(
  frames: readonly SpriteFrame[],
  ids: readonly string[],
  nextId: () => string,
): { frames: SpriteFrame[]; copyIds: string[] } {
  const chosen = new Set(ids);
  const picked = frames.filter((frame) => chosen.has(frame.id));
  if (picked.length === 0) return { frames: frames.slice(), copyIds: [] };
  let last = -1;
  for (let index = 0; index < frames.length; index += 1) {
    if (chosen.has(frames[index]!.id)) last = index;
  }
  const copies = picked.map((frame) => ({
    ...frame,
    id: nextId(),
    rgba: new Uint8ClampedArray(frame.rgba),
  }));
  const next = frames.slice();
  next.splice(last + 1, 0, ...copies);
  return { frames: next, copyIds: copies.map((frame) => frame.id) };
}

export type SpriteDropPlace = { id: string; place: "before" | "after" };

/** Moves the selected frames as one block. Dropping on a selected frame does nothing. */
export function moveSpriteFrames(frames: readonly SpriteFrame[], ids: readonly string[], drop: SpriteDropPlace): SpriteFrame[] {
  const chosen = new Set(ids);
  const moving = frames.filter((frame) => chosen.has(frame.id));
  if (moving.length === 0 || chosen.has(drop.id)) return frames.slice();
  const rest = frames.filter((frame) => !chosen.has(frame.id));
  const at = rest.findIndex((frame) => frame.id === drop.id);
  if (at < 0) return frames.slice();
  const next = rest.slice();
  next.splice(drop.place === "after" ? at + 1 : at, 0, ...moving);
  return next;
}

export function sameSpriteFrames(a: readonly SpriteFrame[], b: readonly SpriteFrame[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((frame, index) => {
    const other = b[index];
    return !!other
      && frame.id === other.id
      && frame.durationMs === other.durationMs
      && frame.flipX === other.flipX
      && frame.flipY === other.flipY
      && (frame.origin ?? null) === (other.origin ?? null)
      && frame.pivot?.x === other.pivot?.x
      && frame.pivot?.y === other.pivot?.y
      && frame.width === other.width
      && frame.height === other.height
      && frame.rgba === other.rgba;
  });
}

const SPRITE_HISTORY_LIMIT = 40;

export type SpriteFrameHistory = {
  undo: SpriteFrame[][];
  redo: SpriteFrame[][];
};

export function emptySpriteFrameHistory(): SpriteFrameHistory {
  return { undo: [], redo: [] };
}

export function cloneSpriteFrames(frames: readonly SpriteFrame[]): SpriteFrame[] {
  return frames.map((frame) => ({ ...frame, rgba: new Uint8ClampedArray(frame.rgba) }));
}

export function pushSpriteHistory(history: SpriteFrameHistory, before: readonly SpriteFrame[]): SpriteFrameHistory {
  const undo = history.undo.concat([cloneSpriteFrames(before)]);
  if (undo.length > SPRITE_HISTORY_LIMIT) undo.shift();
  return { undo, redo: [] };
}

export function undoSpriteHistory(
  history: SpriteFrameHistory,
  current: readonly SpriteFrame[],
): { history: SpriteFrameHistory; frames: SpriteFrame[] } | null {
  const prior = history.undo[history.undo.length - 1];
  if (!prior) return null;
  const redo = history.redo.concat([cloneSpriteFrames(current)]);
  if (redo.length > SPRITE_HISTORY_LIMIT) redo.shift();
  return { history: { undo: history.undo.slice(0, -1), redo }, frames: cloneSpriteFrames(prior) };
}

export function redoSpriteHistory(
  history: SpriteFrameHistory,
  current: readonly SpriteFrame[],
): { history: SpriteFrameHistory; frames: SpriteFrame[] } | null {
  const next = history.redo[history.redo.length - 1];
  if (!next) return null;
  const undo = history.undo.concat([cloneSpriteFrames(current)]);
  if (undo.length > SPRITE_HISTORY_LIMIT) undo.shift();
  return { history: { undo, redo: history.redo.slice(0, -1) }, frames: cloneSpriteFrames(next) };
}

export type SpriteEdit =
  | { kind: "frames"; frames: SpriteFrame[] }
  | { kind: "slices"; slices: SpriteSlice[] };

export type SpriteDocHistory = {
  undo: SpriteEdit[];
  redo: SpriteEdit[];
};

export function emptySpriteDocHistory(): SpriteDocHistory {
  return { undo: [], redo: [] };
}

export function cloneSpriteSlices(slices: readonly SpriteSlice[]): SpriteSlice[] {
  return slices.map((slice) => ({ ...slice, pivot: slice.pivot ? { x: slice.pivot.x, y: slice.pivot.y } : slice.pivot }));
}

export function pushSpriteEdit(history: SpriteDocHistory, entry: SpriteEdit): SpriteDocHistory {
  const stored: SpriteEdit = entry.kind === "frames"
    ? { kind: "frames", frames: cloneSpriteFrames(entry.frames) }
    : { kind: "slices", slices: cloneSpriteSlices(entry.slices) };
  const undo = history.undo.concat([stored]);
  if (undo.length > SPRITE_HISTORY_LIMIT) undo.shift();
  return { undo, redo: [] };
}

export function undoSpriteDoc(
  history: SpriteDocHistory,
  current: { frames: readonly SpriteFrame[]; slices: readonly SpriteSlice[] },
): { history: SpriteDocHistory; edit: SpriteEdit } | null {
  const prior = history.undo[history.undo.length - 1];
  if (!prior) return null;
  const redoEntry: SpriteEdit = prior.kind === "frames"
    ? { kind: "frames", frames: cloneSpriteFrames(current.frames) }
    : { kind: "slices", slices: cloneSpriteSlices(current.slices) };
  const redo = history.redo.concat([redoEntry]);
  if (redo.length > SPRITE_HISTORY_LIMIT) redo.shift();
  const edit: SpriteEdit = prior.kind === "frames"
    ? { kind: "frames", frames: cloneSpriteFrames(prior.frames) }
    : { kind: "slices", slices: cloneSpriteSlices(prior.slices) };
  return { history: { undo: history.undo.slice(0, -1), redo }, edit };
}

export function redoSpriteDoc(
  history: SpriteDocHistory,
  current: { frames: readonly SpriteFrame[]; slices: readonly SpriteSlice[] },
): { history: SpriteDocHistory; edit: SpriteEdit } | null {
  const next = history.redo[history.redo.length - 1];
  if (!next) return null;
  const undoEntry: SpriteEdit = next.kind === "frames"
    ? { kind: "frames", frames: cloneSpriteFrames(current.frames) }
    : { kind: "slices", slices: cloneSpriteSlices(current.slices) };
  const undo = history.undo.concat([undoEntry]);
  if (undo.length > SPRITE_HISTORY_LIMIT) undo.shift();
  const edit: SpriteEdit = next.kind === "frames"
    ? { kind: "frames", frames: cloneSpriteFrames(next.frames) }
    : { kind: "slices", slices: cloneSpriteSlices(next.slices) };
  return { history: { undo, redo: history.redo.slice(0, -1) }, edit };
}

export function splitPlan(
  sheetW: number,
  sheetH: number,
  cols: number,
  rows: number,
): { ok: true; frameW: number; frameH: number; remW: number; remH: number; usedW: number; usedH: number } | { ok: false; reason: string } {
  const columns = Math.round(cols);
  const rowCount = Math.round(rows);
  if (!Number.isFinite(sheetW) || !Number.isFinite(sheetH) || sheetW < 1 || sheetH < 1) return { ok: false, reason: "スプライトシートのサイズを読めません。" };
  if (columns < 1 || rowCount < 1) return { ok: false, reason: "行数と列数は1以上にしてください。" };
  const frameW = Math.floor(sheetW / columns);
  const frameH = Math.floor(sheetH / rowCount);
  if (frameW < 1 || frameH < 1) return { ok: false, reason: "1マスが1ピクセル未満です。分割数を減らしてください。" };
  const reason = frameSizeReason(frameW, frameH);
  if (reason) return { ok: false, reason: `分割後のフレームが${frameW}×${frameH}です。256×256以内にしてください。` };
  return {
    ok: true,
    frameW,
    frameH,
    remW: sheetW - frameW * columns,
    remH: sheetH - frameH * rowCount,
    usedW: frameW * columns,
    usedH: frameH * rowCount,
  };
}

export function sliceFrame(src: Uint8ClampedArray, sheetW: number, frameW: number, frameH: number, col: number, row: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(frameW * frameH * 4);
  const ox = col * frameW;
  const oy = row * frameH;
  for (let y = 0; y < frameH; y += 1) {
    const from = ((oy + y) * sheetW + ox) * 4;
    out.set(src.subarray(from, from + frameW * 4), y * frameW * 4);
  }
  return out;
}

type NineBand = { src: number; srcSize: number; out: number; outSize: number };

/** Split one axis into fixed, stretch, fixed. The stretch size is never negative. */
export function nineBands(fixedStart: number, middle: number, fixedEnd: number, out: number): NineBand[] {
  const safeOut = Math.max(0, Math.round(out));
  const start = Math.max(0, fixedStart);
  const center = Math.max(0, middle);
  const end = Math.max(0, fixedEnd);
  const fixed = start + end;
  let outStart = start;
  let outCenter = safeOut - fixed;
  let outEnd = end;
  if (outCenter < 0) {
    if (fixed <= 0) {
      outStart = 0;
      outEnd = 0;
      outCenter = safeOut;
    } else {
      outStart = Math.min(safeOut, Math.round((start * safeOut) / fixed));
      outEnd = safeOut - outStart;
      outCenter = 0;
    }
  }
  const bands: NineBand[] = [];
  let srcCursor = 0;
  let outCursor = 0;
  for (const [srcSize, outSize] of [
    [start, outStart],
    [center, outCenter],
    [end, outEnd],
  ] as const) {
    if (outSize > 0 && srcSize > 0) bands.push({ src: srcCursor, srcSize, out: outCursor, outSize });
    srcCursor += srcSize;
    outCursor += outSize;
  }
  return bands;
}

export function defaultNine(frameId: string, width: number, height: number): NineSlice {
  const side = (size: number) => (size < 3 ? 0 : Math.max(1, Math.floor(size / 3)));
  let left = side(width);
  let right = side(width);
  if (left + right > width) right = Math.max(0, width - left);
  let top = side(height);
  let bottom = side(height);
  if (top + bottom > height) bottom = Math.max(0, height - top);
  return {
    frameId,
    left,
    right,
    top,
    bottom,
    filter: "nearest",
    previewWidth: Math.max(1, Math.min(NINE_MAX, Math.round(width) || 1)),
    previewHeight: Math.max(1, Math.min(NINE_MAX, Math.round(height) || 1)),
  };
}

export function setNineMargin(nine: NineSlice, width: number, height: number, edge: NineEdge, value: number): NineSlice {
  const next = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  if (edge === "left") return { ...nine, left: Math.min(next, Math.max(0, width - Math.max(0, nine.right))) };
  if (edge === "right") return { ...nine, right: Math.min(next, Math.max(0, width - Math.max(0, nine.left))) };
  if (edge === "top") return { ...nine, top: Math.min(next, Math.max(0, height - Math.max(0, nine.bottom))) };
  return { ...nine, bottom: Math.min(next, Math.max(0, height - Math.max(0, nine.top))) };
}

export function setNinePreviewSize(nine: NineSlice, width: number, height: number): NineSlice {
  const cap = (value: number, fallback: number) => {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(1, Math.min(NINE_MAX, Math.round(value)));
  };
  return { ...nine, previewWidth: cap(width, nine.previewWidth), previewHeight: cap(height, nine.previewHeight) };
}

export function readNines(value: unknown): NineSlice[] {
  if (!Array.isArray(value)) return [];
  const out: NineSlice[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Partial<NineSlice>;
    if (typeof item.frameId !== "string" || item.frameId.length === 0 || seen.has(item.frameId)) continue;
    const margin = (part: unknown) => (typeof part === "number" && Number.isFinite(part) ? Math.max(0, Math.round(part)) : 0);
    const size = (part: unknown) => (typeof part === "number" && Number.isFinite(part) ? Math.max(1, Math.min(NINE_MAX, Math.round(part))) : 1);
    seen.add(item.frameId);
    out.push({
      frameId: item.frameId,
      left: margin(item.left),
      right: margin(item.right),
      top: margin(item.top),
      bottom: margin(item.bottom),
      filter: item.filter === "bilinear" ? "bilinear" : "nearest",
      previewWidth: size(item.previewWidth),
      previewHeight: size(item.previewHeight),
    });
  }
  return out;
}

function nineSample(src: Uint8ClampedArray, width: number, x: number, y: number, channel: number): number {
  return src[(y * width + x) * 4 + channel] ?? 0;
}

/**
 * Rebuild one image with 9-slice rules.
 * Corners stay fixed until the output is too small, then they shrink together.
 * The source buffer is not changed.
 */
export function nineSliceRgba(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  margins: Pick<NineSlice, "left" | "right" | "top" | "bottom" | "filter">,
  outW: number,
  outH: number,
): Uint8ClampedArray | null {
  const nextW = Math.round(outW);
  const nextH = Math.round(outH);
  if (width < 1 || height < 1 || nextW < 1 || nextH < 1 || nextW > NINE_MAX || nextH > NINE_MAX) return null;
  if (src.length < width * height * 4) return null;
  const left = Math.max(0, Math.min(width, Math.round(margins.left)));
  const right = Math.max(0, Math.min(width - left, Math.round(margins.right)));
  const top = Math.max(0, Math.min(height, Math.round(margins.top)));
  const bottom = Math.max(0, Math.min(height - top, Math.round(margins.bottom)));
  const cols = nineBands(left, width - left - right, right, nextW);
  const rows = nineBands(top, height - top - bottom, bottom, nextH);
  const out = new Uint8ClampedArray(nextW * nextH * 4);
  const nearest = margins.filter !== "bilinear";
  for (const row of rows) {
    for (const col of cols) {
      for (let y = 0; y < row.outSize; y += 1) {
        for (let x = 0; x < col.outSize; x += 1) {
          const dst = ((row.out + y) * nextW + (col.out + x)) * 4;
          if (nearest) {
            const sx = col.src + Math.min(col.srcSize - 1, Math.floor(((x + 0.5) * col.srcSize) / col.outSize));
            const sy = row.src + Math.min(row.srcSize - 1, Math.floor(((y + 0.5) * row.srcSize) / row.outSize));
            const from = (sy * width + sx) * 4;
            out[dst] = src[from] ?? 0;
            out[dst + 1] = src[from + 1] ?? 0;
            out[dst + 2] = src[from + 2] ?? 0;
            out[dst + 3] = src[from + 3] ?? 0;
            continue;
          }
          const u = ((x + 0.5) * col.srcSize) / col.outSize - 0.5;
          const v = ((y + 0.5) * row.srcSize) / row.outSize - 0.5;
          const x0 = Math.floor(u);
          const y0 = Math.floor(v);
          const tx = u - x0;
          const ty = v - y0;
          const sx0 = col.src + Math.max(0, Math.min(col.srcSize - 1, x0));
          const sx1 = col.src + Math.max(0, Math.min(col.srcSize - 1, x0 + 1));
          const sy0 = row.src + Math.max(0, Math.min(row.srcSize - 1, y0));
          const sy1 = row.src + Math.max(0, Math.min(row.srcSize - 1, y0 + 1));
          for (let channel = 0; channel < 4; channel += 1) {
            const p00 = nineSample(src, width, sx0, sy0, channel);
            const p10 = nineSample(src, width, sx1, sy0, channel);
            const p01 = nineSample(src, width, sx0, sy1, channel);
            const p11 = nineSample(src, width, sx1, sy1, channel);
            const along = p00 + (p10 - p00) * tx;
            const mixed = along + (p01 + (p11 - p01) * tx - along) * ty;
            out[dst + channel] = Math.max(0, Math.min(255, Math.round(mixed)));
          }
        }
      }
    }
  }
  return out;
}
