/**
 * Pixel-mode drawing math.
 * The photo canvas keeps its own placements. This buffer never reads or writes them.
 * The grid is not part of this buffer, so copy and save cannot include it.
 */

export const PIXEL_SIZES = [32, 64, 96, 128, 160, 192, 224, 256] as const;
export type PixelSize = (typeof PIXEL_SIZES)[number];

/** Each side of a canvas. Squares stay inside the existing 256 limit. */
export const PIXEL_CANVAS_MIN = 1;
export const PIXEL_CANVAS_MAX = 256;

export type PixelGrid = { width: number; height: number };
/** Square callers pass one edge. A rectangle passes both sides. */
export type PixelSpan = number | PixelGrid;

export function gridOf(span: PixelSpan): PixelGrid {
  if (typeof span === "number") {
    const edge = Number.isFinite(span) ? Math.max(0, span) : 0;
    return { width: edge, height: edge };
  }
  const width = Number.isFinite(span.width) ? Math.max(0, span.width) : 0;
  const height = Number.isFinite(span.height) ? Math.max(0, span.height) : 0;
  return { width, height };
}

/** 0 is the start edge, 1 is the center, 2 is the end edge. */
export type CanvasAnchor = 0 | 1 | 2;

/**
 * Where the old edge starts inside the new edge.
 * A center split that is odd gives the extra pixel to the right or the bottom.
 * Shrinking uses the same split, so the extra cropped pixel comes off the left or the top.
 */
export function canvasAnchorOffset(oldSize: number, newSize: number, anchor: CanvasAnchor): number {
  if (anchor <= 0) return 0;
  if (anchor >= 2) return newSize - oldSize;
  return Math.floor((newSize - oldSize) / 2);
}

/** Integers from 1 through 256. Anything else is refused. */
export function clampCanvasEdge(value: number): number | null {
  if (!Number.isInteger(value) || value < PIXEL_CANVAS_MIN || value > PIXEL_CANVAS_MAX) return null;
  return value;
}

/**
 * Copy pixels onto a new canvas without scaling them.
 * Added cells are fully clear. Cropped cells are dropped.
 * The source buffer is not changed, including RGB stored in clear cells.
 */
export function resizePixelCanvas(
  data: Uint8ClampedArray,
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
  anchorX: CanvasAnchor,
  anchorY: CanvasAnchor,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(Math.max(0, newW) * Math.max(0, newH) * 4);
  if (oldW < 1 || oldH < 1 || newW < 1 || newH < 1 || data.length < oldW * oldH * 4) return out;
  const ox = canvasAnchorOffset(oldW, newW, anchorX);
  const oy = canvasAnchorOffset(oldH, newH, anchorY);
  const x0 = Math.max(0, ox);
  const y0 = Math.max(0, oy);
  const x1 = Math.min(newW, ox + oldW);
  const y1 = Math.min(newH, oy + oldH);
  const copyW = x1 - x0;
  if (copyW < 1 || y1 <= y0) return out;
  for (let y = y0; y < y1; y += 1) {
    const from = ((y - oy) * oldW + (x0 - ox)) * 4;
    out.set(data.subarray(from, from + copyW * 4), (y * newW + x0) * 4);
  }
  return out;
}

/** Union of the old image and the new canvas, so a preview can show both the new shape and the crop. */
export function canvasPreviewFrame(
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
  anchorX: CanvasAnchor,
  anchorY: CanvasAnchor,
): { viewW: number; viewH: number; oldX: number; oldY: number; nextX: number; nextY: number } {
  const ox = canvasAnchorOffset(oldW, newW, anchorX);
  const oy = canvasAnchorOffset(oldH, newH, anchorY);
  const left = Math.min(0, ox);
  const top = Math.min(0, oy);
  return {
    viewW: Math.max(newW, ox + oldW) - left,
    viewH: Math.max(newH, oy + oldH) - top,
    oldX: ox - left,
    oldY: oy - top,
    nextX: -left,
    nextY: -top,
  };
}

/** The tight rectangle around every pixel whose alpha is at least 1. A fully clear image has no trim. */
export type TrimBounds = {
  x: number;
  y: number;
  w: number;
  h: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function opaquePixelBounds(data: Uint8ClampedArray, span: PixelSpan): TrimBounds | null {
  const { width, height } = gridOf(span);
  if (width < 1 || height < 1 || data.length < width * height * 4) return null;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if ((data[row + x * 4 + 3] ?? 0) <= 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0 || maxY < 0) return null;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return {
    x: minX,
    y: minY,
    w,
    h,
    left: minX,
    right: width - maxX - 1,
    top: minY,
    bottom: height - maxY - 1,
  };
}

/**
 * Copy one rectangle onto a new canvas without scaling it.
 * RGB and alpha inside the rectangle stay as they are, including clear cells.
 * The source buffer is not changed.
 */
export function cropPixelCanvas(
  data: Uint8ClampedArray,
  oldW: number,
  oldH: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(Math.max(0, w) * Math.max(0, h) * 4);
  if (oldW < 1 || oldH < 1 || w < 1 || h < 1 || data.length < oldW * oldH * 4) return out;
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(oldW, x + w);
  const y1 = Math.min(oldH, y + h);
  const copyW = x1 - x0;
  if (copyW < 1 || y1 <= y0) return out;
  for (let row = y0; row < y1; row += 1) {
    const from = (row * oldW + x0) * 4;
    out.set(data.subarray(from, from + copyW * 4), ((row - y) * w + (x0 - x)) * 4);
  }
  return out;
}

export const PIXEL_SIZE_KEY = "pixelBoardSize";
export const PIXEL_PNG_KEY = "pixelBoardPng";
export const PIXEL_BACKDROP_KEY = "pixelBoardBackdrop";

export type PixelBackdrop = "checker" | "white" | "green" | "black";

/** Display-only backdrop. Anything else stays on the original checker. */
export function pixelBackdrop(value: string): PixelBackdrop {
  if (value === "white" || value === "green" || value === "black") return value;
  return "checker";
}

export const PIXEL_LEVELS = [0, 36, 73, 109, 146, 182, 219, 255] as const;

export type PixelColor = { r: number; g: number; b: number; a: number };

export const PIXEL_CLEAR: PixelColor = { r: 0, g: 0, b: 0, a: 0 };
export const PIXEL_WHITE: PixelColor = { r: 255, g: 255, b: 255, a: 255 };
export const PIXEL_BLACK: PixelColor = { r: 0, g: 0, b: 0, a: 255 };

export const PIXEL_ZOOM_MIN = 1;
export const PIXEL_ZOOM_MAX = 32;

export const PIXEL_TABS_KEY = "pixelBoardTabs";
/** Pen color and eyedropper history, shared by every pixel tab. */
export const PIXEL_INK_KEY = "pixelBoardInk";
/** Newest eyedropper colors. Three columns by eight rows. */
export const PIXEL_DROP_CAP = 24;

export type InkPick = number | "clear" | { r: number; g: number; b: number };

/** How many extracted colors stay in the open palette. The rest stay selectable in the extra palette. */
export const PIXEL_PRIMARY_CAP = 256;

export const ALPHA_PERCENTS = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
export type AlphaPercent = (typeof ALPHA_PERCENTS)[number];

export function rgbKey(r: number, g: number, b: number): number {
  return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
}

/**
 * Unique RGB colors that are actually painted.
 * Fully clear cells are skipped. Alpha is not part of the identity, and nothing is merged.
 * Most-used colors come first.
 */
export function collectUsedColors(data: Uint8ClampedArray, size: PixelSpan): PixelColor[] {
  const { width, height } = gridOf(size);
  const counts = new Map<number, number>();
  const cells = width * height;
  const limit = Math.min(cells, Math.floor(data.length / 4));
  for (let index = 0; index < limit; index += 1) {
    const at = index * 4;
    if ((data[at + 3] ?? 0) <= 0) continue;
    const key = rgbKey(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([key]) => ({ r: (key >> 16) & 255, g: (key >> 8) & 255, b: key & 255, a: 255 }));
}

export function splitUsedColors(used: readonly PixelColor[]): { primary: PixelColor[]; more: PixelColor[]; extra: PixelColor[] } {
  const seen = new Set<number>();
  const primary: PixelColor[] = [];
  const more: PixelColor[] = [];
  const extra: PixelColor[] = [];
  for (const color of used) {
    const key = rgbKey(color.r, color.g, color.b);
    if (seen.has(key)) continue;
    seen.add(key);
    const swatch = { r: color.r, g: color.g, b: color.b, a: 255 };
    if (primary.length < PIXEL_PRIMARY_CAP) primary.push(swatch);
    else more.push(swatch);
  }
  for (const color of PIXEL_PALETTE) {
    const key = rgbKey(color.r, color.g, color.b);
    if (seen.has(key)) continue;
    seen.add(key);
    extra.push(color);
  }
  return { primary, more, extra };
}

/** White or black, the two swatches pinned to the top-left. Anything else is a normal color. */
export function isPaletteMono(color: { r: number; g: number; b: number }): "white" | "black" | null {
  if (color.r === 255 && color.g === 255 && color.b === 255) return "white";
  if (color.r === 0 && color.g === 0 && color.b === 0) return "black";
  return null;
}

function swatchHue(color: { r: number; g: number; b: number }): { group: number; lum: number; hue: number } {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  const chroma = max - min;
  const lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  if (chroma < 14 || max === 0 || chroma / max < 0.12) return { group: 10, lum, hue: 0 };
  let hue = 0;
  if (max === color.r) hue = ((color.g - color.b) / chroma) % 6;
  else if (max === color.g) hue = (color.b - color.r) / chroma + 2;
  else hue = (color.r - color.g) / chroma + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  let group = 9;
  if (hue < 15 || hue >= 345) group = 0;
  else if (hue < 45) group = 1;
  else if (hue < 70) group = 2;
  else if (hue < 100) group = 3;
  else if (hue < 150) group = 4;
  else if (hue < 175) group = 5;
  else if (hue < 200) group = 6;
  else if (hue < 255) group = 7;
  else if (hue < 290) group = 8;
  return { group, lum, hue };
}

/** White, then black, then used colors by hue family and dark-to-light. Same RGB is kept once. */
export function usedSwatchOrder(used: readonly PixelColor[]): PixelColor[] {
  const seen = new Set<number>();
  const rest: PixelColor[] = [];
  for (const color of used) {
    const key = rgbKey(color.r, color.g, color.b);
    if (seen.has(key) || isPaletteMono(color)) continue;
    seen.add(key);
    rest.push({ r: color.r, g: color.g, b: color.b, a: 255 });
  }
  rest.sort((left, right) => {
    const a = swatchHue(left);
    const b = swatchHue(right);
    return a.group - b.group || a.lum - b.lum || a.hue - b.hue || rgbKey(left.r, left.g, left.b) - rgbKey(right.r, right.g, right.b);
  });
  return [{ ...PIXEL_WHITE }, { ...PIXEL_BLACK }, ...rest];
}

export type PixelHistory = { undo: Uint8ClampedArray[]; redo: Uint8ClampedArray[] };

export const PIXEL_HISTORY_LIMIT = 40;

export function emptyPixelHistory(): PixelHistory {
  return { undo: [], redo: [] };
}

/** Remember the buffer from before one edit. A new edit drops the redo branch. */
export function notePixelHistory(history: PixelHistory, before: Uint8ClampedArray): void {
  history.undo.push(before);
  if (history.undo.length > PIXEL_HISTORY_LIMIT) history.undo.shift();
  history.redo = [];
}

export function undoPixelHistory(history: PixelHistory, current: Uint8ClampedArray): Uint8ClampedArray | null {
  const prev = history.undo.pop();
  if (!prev) return null;
  history.redo.push(current);
  return prev;
}

export function redoPixelHistory(history: PixelHistory, current: Uint8ClampedArray): Uint8ClampedArray | null {
  const next = history.redo.pop();
  if (!next) return null;
  history.undo.push(current);
  return next;
}

export function rememberColor(used: readonly PixelColor[], color: PixelColor): PixelColor[] {
  if (color.a <= 0) return [...used];
  const key = rgbKey(color.r, color.g, color.b);
  if (used.some((entry) => rgbKey(entry.r, entry.g, entry.b) === key)) return [...used];
  return [{ r: color.r, g: color.g, b: color.b, a: 255 }, ...used];
}

export function usesOffCube(data: Uint8ClampedArray): boolean {
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) <= 0) continue;
    if (!cubeHas(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0)) return true;
  }
  return false;
}

/** 10% transparent → alpha 230. 50% → 128. 90% → 26. The number is transparency, not remaining coverage. */
export function alphaByte(percent: number): number {
  const step = ALPHA_PERCENTS.includes(percent as AlphaPercent) ? percent : 50;
  return Math.round(((100 - step) / 100) * 255);
}

export function alphaSwatch(percent: number): PixelColor {
  const t = Math.max(0, Math.min(1, (percent - 10) / 80));
  return {
    r: Math.round(186 - t * 160),
    g: Math.round(214 - t * 150),
    b: Math.round(255 - t * 30),
    a: 255,
  };
}

export function hasPartialAlpha(data: Uint8ClampedArray): boolean {
  for (let index = 3; index < data.length; index += 4) {
    const alpha = data[index] ?? 0;
    if (alpha > 0 && alpha < 255) return true;
  }
  return false;
}

export function canvasHasInk(data: Uint8ClampedArray): boolean {
  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 0) > 0) return true;
  }
  return false;
}

/** Change only alpha. A clear cell has no RGB to keep, so it is left alone. */
export function writeAlpha(data: Uint8ClampedArray, size: PixelSpan, x: number, y: number, alpha: number): boolean {
  const { width, height } = gridOf(size);
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const pixel = readPixel(data, size, x, y);
  if (pixel.a <= 0) return false;
  const next = Math.max(0, Math.min(255, Math.round(alpha)));
  if (pixel.a === next) return false;
  writePixel(data, size, x, y, { r: pixel.r, g: pixel.g, b: pixel.b, a: next });
  return true;
}

/** Flood one exact RGBA region and change only its alpha. Cells outside `selection` are left alone. */
export function floodAlpha(data: Uint8ClampedArray, size: PixelSpan, x: number, y: number, alpha: number, selection: PixelSelection | null = null): number {
  const { width, height } = gridOf(size);
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  if (selection && !selectionHas(selection, x, y, size)) return 0;
  const target = readPixel(data, size, x, y);
  if (target.a <= 0) return 0;
  const next = Math.max(0, Math.min(255, Math.round(alpha)));
  if (target.a === next) return 0;
  return floodFill(data, size, x, y, { r: target.r, g: target.g, b: target.b, a: next }, selection);
}

/** Colored cells become opaque. Clear cells stay clear. The source buffer is not changed. */
export function bakeOpaque(data: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  for (let index = 3; index < out.length; index += 4) {
    if ((out[index] ?? 0) > 0) out[index] = 255;
  }
  return out;
}

/**
 * Edit-only picture. The source RGB stays put.
 * The art is ghosted, and blue gets stronger as the pixel gets more transparent.
 */
export function previewAlpha(data: Uint8ClampedArray, size: PixelSpan): Uint8ClampedArray {
  const { width, height } = gridOf(size);
  const out = new Uint8ClampedArray(width * height * 4);
  const cells = Math.min(Math.floor(data.length / 4), Math.floor(out.length / 4));
  for (let index = 0; index < cells; index += 1) {
    const at = index * 4;
    const alpha = data[at + 3] ?? 0;
    if (alpha <= 0) continue;
    const cover = alpha / 255;
    const artA = 0.45 * cover;
    const blueA = (1 - cover) * 0.92;
    const outA = blueA + artA * (1 - blueA);
    if (outA <= 0) continue;
    const keep = artA * (1 - blueA);
    out[at] = Math.round((24 * blueA + (data[at] ?? 0) * keep) / outA);
    out[at + 1] = Math.round((72 * blueA + (data[at + 1] ?? 0) * keep) / outA);
    out[at + 2] = Math.round((220 * blueA + (data[at + 2] ?? 0) * keep) / outA);
    out[at + 3] = Math.round(outA * 255);
  }
  return out;
}

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return PIXEL_ZOOM_MIN;
  return Math.max(PIXEL_ZOOM_MIN, Math.min(PIXEL_ZOOM_MAX, Math.round(value)));
}

/** Keep the point under the cursor still when the centered frame changes size. */
export function panAfterZoom(pan: number, cursor: number, origin: number, oldSize: number, newSize: number, center: number): number {
  if (oldSize < 1 || newSize < 1) return pan;
  const offset = cursor - origin;
  const newOrigin = cursor - offset * (newSize / oldSize);
  return newOrigin - center + newSize / 2;
}

const PALETTE: PixelColor[] = [];
for (const r of PIXEL_LEVELS) {
  for (const g of PIXEL_LEVELS) {
    for (const b of PIXEL_LEVELS) PALETTE.push({ r, g, b, a: 255 });
  }
}

/** 8×8×8 opaque RGB cube. Transparent is a separate tool color, not one of these 512. */
export const PIXEL_PALETTE: readonly PixelColor[] = PALETTE;

/** Display order. White is the first cell, black the next. The other 510 keep their cube order. */
export const PIXEL_PALETTE_ORDER: readonly number[] = (() => {
  let white = 0;
  let black = 0;
  const rest: number[] = [];
  PIXEL_PALETTE.forEach((color, index) => {
    const kind = isPaletteMono(color);
    if (kind === "white") white = index;
    else if (kind === "black") black = index;
    else rest.push(index);
  });
  return [white, black, ...rest];
})();

const CUBE_KEYS = new Set<number>(PIXEL_PALETTE.map((color) => rgbKey(color.r, color.g, color.b)));

function cubeHas(r: number, g: number, b: number): boolean {
  return CUBE_KEYS.has(rgbKey(r, g, b));
}

/** Near the ink red, so the first pen color is obvious on a transparent canvas. */
export const PIXEL_DEFAULT_INDEX = 393;

export type PixelRect = { x: number; y: number; w: number; h: number };

/** A rectangle, or a pixel mask for a freehand lasso or a magic-wand region. The mask is display-only data and is never painted into the image. */
export type PixelSelection =
  | { kind: "rect"; rect: PixelRect }
  | { kind: "lasso"; mask: Uint8Array; bounds: PixelRect };

export function selectionBox(selection: PixelSelection): PixelRect {
  return selection.kind === "rect" ? selection.rect : selection.bounds;
}

/**
 * Place a menu under an anchor, then keep the whole menu inside the stage.
 * Coordinates are relative to the stage center. A short stage pins the menu to the top edge.
 */
export function clampFollowMenu(
  anchorLeft: number,
  anchorBottom: number,
  stageW: number,
  stageH: number,
  menuW: number,
  menuH: number,
  gap = 4,
  edge = 6,
): { left: number; top: number } {
  let top = anchorBottom + gap;
  let left = anchorLeft;
  if (stageH > 0 && menuH > 0) {
    const minTop = -stageH / 2 + edge;
    const maxTop = stageH / 2 - edge - menuH;
    top = maxTop < minTop ? minTop : Math.min(maxTop, Math.max(minTop, top));
  }
  if (stageW > 0 && menuW > 0) {
    const minLeft = -stageW / 2 + edge;
    const maxLeft = stageW / 2 - edge - menuW;
    left = maxLeft < minLeft ? minLeft : Math.min(maxLeft, Math.max(minLeft, left));
  }
  return { left, top };
}

export function clonePixelSelection(selection: PixelSelection | null): PixelSelection | null {
  if (!selection) return null;
  if (selection.kind === "rect") return { kind: "rect", rect: { ...selection.rect } };
  return { kind: "lasso", mask: new Uint8Array(selection.mask), bounds: { ...selection.bounds } };
}

/** Move a selection with the pixels when the canvas changes size. Cells that leave the canvas are dropped. */
export function shiftPixelSelection(
  selection: PixelSelection | null,
  dx: number,
  dy: number,
  oldSpan: PixelSpan,
  nextSpan: PixelSpan,
): PixelSelection | null {
  if (!selection) return null;
  const oldGrid = gridOf(oldSpan);
  const nextGrid = gridOf(nextSpan);
  if (selection.kind === "rect") {
    const rect = selection.rect;
    const x0 = Math.max(0, rect.x + dx);
    const y0 = Math.max(0, rect.y + dy);
    const x1 = Math.min(nextGrid.width, rect.x + dx + rect.w);
    const y1 = Math.min(nextGrid.height, rect.y + dy + rect.h);
    if (x1 <= x0 || y1 <= y0) return null;
    return { kind: "rect", rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
  }
  const mask = new Uint8Array(nextGrid.width * nextGrid.height);
  let minX = nextGrid.width;
  let minY = nextGrid.height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < oldGrid.height; y += 1) {
    for (let x = 0; x < oldGrid.width; x += 1) {
      if (selection.mask[y * oldGrid.width + x] !== 1) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= nextGrid.width || ny >= nextGrid.height) continue;
      mask[ny * nextGrid.width + nx] = 1;
      count += 1;
      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (nx > maxX) maxX = nx;
      if (ny > maxY) maxY = ny;
    }
  }
  if (count === 0) return null;
  const rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  if (count === rect.w * rect.h) return { kind: "rect", rect };
  return { kind: "lasso", mask, bounds: rect };
}

export function selectionHas(selection: PixelSelection, x: number, y: number, size: PixelSpan): boolean {
  const { width, height } = gridOf(size);
  if (selection.kind === "rect") return rectHas(selection.rect, x, y);
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  return selection.mask[y * width + x] === 1;
}

/** Swap selected and unselected cells. Pixel data is not touched. A solid block stays a rectangle. */
export function invertPixelSelection(selection: PixelSelection, size: PixelSpan): PixelSelection | null {
  const { width, height } = gridOf(size);
  if (width < 1 || height < 1) return null;
  const mask = new Uint8Array(width * height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (selectionHas(selection, x, y, size)) continue;
      mask[y * width + x] = 1;
      count += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (count === 0) return null;
  const rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  if (count === rect.w * rect.h) return { kind: "rect", rect };
  return { kind: "lasso", mask, bounds: rect };
}

/** Inclusive pixel bounds. The result sits on whole cells inside the canvas. */
export function pixelRect(x0: number, y0: number, x1: number, y1: number, size: PixelSpan): PixelRect | null {
  const { width, height } = gridOf(size);
  if (width < 1 || height < 1) return null;
  const clampX = (value: number) => Math.max(0, Math.min(width - 1, Math.round(value)));
  const clampY = (value: number) => Math.max(0, Math.min(height - 1, Math.round(value)));
  const left = Math.min(clampX(x0), clampX(x1));
  const right = Math.max(clampX(x0), clampX(x1));
  const top = Math.min(clampY(y0), clampY(y1));
  const bottom = Math.max(clampY(y0), clampY(y1));
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

export function rectHas(rect: PixelRect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

/** Slide the box only. The pixels stay where they are. The box stays fully on the canvas. */
export function slideRect(rect: PixelRect, dx: number, dy: number, size: PixelSpan): PixelRect {
  const { width, height } = gridOf(size);
  const x = Math.max(0, Math.min(Math.max(0, width - rect.w), rect.x + dx));
  const y = Math.max(0, Math.min(Math.max(0, height - rect.h), rect.y + dy));
  return { x, y, w: rect.w, h: rect.h };
}

function forEachCell(size: PixelSpan, rect: PixelRect | null, visit: (x: number, y: number) => void): void {
  const { width, height } = gridOf(size);
  const x0 = rect ? Math.max(0, rect.x) : 0;
  const y0 = rect ? Math.max(0, rect.y) : 0;
  const x1 = rect ? Math.min(width, rect.x + rect.w) : width;
  const y1 = rect ? Math.min(height, rect.y + rect.h) : height;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) visit(x, y);
  }
}

/**
 * `rgba` clears color and alpha. `alpha` puts painted cells back to opaque and leaves RGB alone.
 * A null rect covers the whole canvas. Empty cells stay empty in alpha mode.
 */
export function clearPixels(data: Uint8ClampedArray, size: PixelSpan, rect: PixelRect | null, mode: "rgba" | "alpha"): void {
  const { width, height } = gridOf(size);
  forEachCell(size, rect, (x, y) => {
    const pixel = readPixel(data, size, x, y);
    if (mode === "alpha") {
      if (pixel.a > 0 && pixel.a !== 255) writePixel(data, size, x, y, { r: pixel.r, g: pixel.g, b: pixel.b, a: 255 });
      return;
    }
    writePixel(data, size, x, y, PIXEL_CLEAR);
  });
}

/** `alpha` writes only alpha, and only onto cells that already have ink. */
export function fillRect(data: Uint8ClampedArray, size: PixelSpan, rect: PixelRect, color: PixelColor, mode: "rgba" | "alpha"): void {
  const { width, height } = gridOf(size);
  forEachCell(size, rect, (x, y) => {
    if (mode === "alpha") {
      const pixel = readPixel(data, size, x, y);
      if (pixel.a <= 0) return;
      writePixel(data, size, x, y, { r: pixel.r, g: pixel.g, b: pixel.b, a: color.a });
      return;
    }
    if (color.a <= 0) {
      writePixel(data, size, x, y, PIXEL_CLEAR);
      return;
    }
    writeRgb(data, size, x, y, color);
  });
}

/**
 * Move the rectangle by whole pixels. The source is cleared so the image is not doubled.
 * Cells that leave the canvas are dropped. Alpha mode moves alpha only and keeps both RGB buffers.
 */
export function movePixels(data: Uint8ClampedArray, size: PixelSpan, rect: PixelRect, dx: number, dy: number, mode: "rgba" | "alpha"): PixelRect | null {
  const { width, height } = gridOf(size);
  if (dx === 0 && dy === 0) return rect;
  const src = new Uint8ClampedArray(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y += 1) {
    for (let x = 0; x < rect.w; x += 1) {
      const pixel = readPixel(data, size, rect.x + x, rect.y + y);
      const at = (y * rect.w + x) * 4;
      src[at] = pixel.r;
      src[at + 1] = pixel.g;
      src[at + 2] = pixel.b;
      src[at + 3] = pixel.a;
    }
  }
  clearPixels(data, size, rect, mode);
  for (let y = 0; y < rect.h; y += 1) {
    for (let x = 0; x < rect.w; x += 1) {
      const nx = rect.x + dx + x;
      const ny = rect.y + dy + y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const at = (y * rect.w + x) * 4;
      if (mode === "alpha") {
        const dest = readPixel(data, size, nx, ny);
        if (dest.a <= 0 && (src[at + 3] ?? 0) <= 0) continue;
        if (dest.a <= 0) continue;
        writePixel(data, size, nx, ny, { r: dest.r, g: dest.g, b: dest.b, a: src[at + 3] ?? 0 });
        continue;
      }
      writePixel(data, size, nx, ny, { r: src[at] ?? 0, g: src[at + 1] ?? 0, b: src[at + 2] ?? 0, a: src[at + 3] ?? 0 });
    }
  }
  return pixelRect(rect.x + dx, rect.y + dy, rect.x + dx + rect.w - 1, rect.y + dy + rect.h - 1, size);
}

function maskBounds(mask: Uint8Array, size: PixelSpan): PixelRect | null {
  const { width, height } = gridOf(size);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Closed pixel mask. The outline is included and nothing is antialiased. Empty shapes return null. */
export function lassoMask(points: readonly { x: number; y: number }[], size: PixelSpan): PixelSelection | null {
  const { width, height } = gridOf(size);
  if (width < 1 || height < 1 || points.length < 3) return null;
  const mask = new Uint8Array(width * height);
  const mark = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    mask[y * width + x] = 1;
  };
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    if (!from || !to) continue;
    for (const point of bresenham(from.x, from.y, to.x, to.y)) mark(point.x, point.y);
  }
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(width - 1, maxX);
  maxY = Math.min(height - 1, maxY);
  for (let y = minY; y <= maxY; y += 1) {
    const sampleY = y + 0.5;
    const hits: number[] = [];
    for (let index = 0; index < points.length; index += 1) {
      const from = points[index];
      const to = points[(index + 1) % points.length];
      if (!from || !to) continue;
      const y0 = from.y + 0.5;
      const y1 = to.y + 0.5;
      if (y0 === y1 || y0 > sampleY === y1 > sampleY) continue;
      const x0 = from.x + 0.5;
      const x1 = to.x + 0.5;
      hits.push(((x1 - x0) * (sampleY - y0)) / (y1 - y0) + x0);
    }
    hits.sort((left, right) => left - right);
    for (let pair = 0; pair + 1 < hits.length; pair += 2) {
      const start = Math.ceil(hits[pair] ?? 0);
      const end = Math.floor((hits[pair + 1] ?? 0) - 1e-6);
      for (let x = Math.max(minX, start); x <= Math.min(maxX, end); x += 1) mark(x, y);
    }
  }
  const bounds = maskBounds(mask, size);
  if (!bounds) return null;
  return { kind: "lasso", mask, bounds };
}

/**
 * 4-connected region of one color. Diagonal neighbors stay separate.
 * Opaque and translucent cells match only an exact RGBA.
 * Fully clear cells match other clear cells, ignoring leftover RGB, and never match ink.
 * The source buffer is not written.
 */
export function magicWandMask(data: Uint8ClampedArray, size: PixelSpan, x: number, y: number): PixelSelection | null {
  const { width, height } = gridOf(size);
  if (width < 1 || height < 1 || x < 0 || y < 0 || x >= width || y >= height) return null;
  const origin = (y * width + x) * 4;
  const tr = data[origin] ?? 0;
  const tg = data[origin + 1] ?? 0;
  const tb = data[origin + 2] ?? 0;
  const ta = data[origin + 3] ?? 0;
  const mask = new Uint8Array(width * height);
  const matches = (px: number, py: number): boolean => {
    const at = (py * width + px) * 4;
    const alpha = data[at + 3] ?? 0;
    if (ta <= 0) return alpha <= 0;
    return alpha === ta && (data[at] ?? 0) === tr && (data[at + 1] ?? 0) === tg && (data[at + 2] ?? 0) === tb;
  };
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const stackX = [x];
  const stackY = [y];
  while (stackX.length > 0) {
    let px = stackX.pop() ?? 0;
    const py = stackY.pop() ?? 0;
    if (py < 0 || py >= height || px < 0 || px >= width) continue;
    if (mask[py * width + px] === 1 || !matches(px, py)) continue;
    while (px > 0 && mask[py * width + (px - 1)] === 0 && matches(px - 1, py)) px -= 1;
    let spanUp = false;
    let spanDown = false;
    for (; px < width && mask[py * width + px] === 0 && matches(px, py); px += 1) {
      mask[py * width + px] = 1;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      if (py > 0) {
        const above = mask[(py - 1) * width + px] === 0 && matches(px, py - 1);
        if (!spanUp && above) {
          stackX.push(px);
          stackY.push(py - 1);
          spanUp = true;
        } else if (!above) spanUp = false;
      }
      if (py + 1 < height) {
        const below = mask[(py + 1) * width + px] === 0 && matches(px, py + 1);
        if (!spanDown && below) {
          stackX.push(px);
          stackY.push(py + 1);
          spanDown = true;
        } else if (!below) spanDown = false;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { kind: "lasso", mask, bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}

/**
 * Every pixel of the clicked color, including ones that do not touch.
 * Match rule is the same as the magic wand: exact RGBA, while fully clear cells match any other clear cell.
 * The source buffer is not written.
 */
export function colorSelectMask(data: Uint8ClampedArray, size: PixelSpan, x: number, y: number): PixelSelection | null {
  const { width, height } = gridOf(size);
  if (width < 1 || height < 1 || x < 0 || y < 0 || x >= width || y >= height) return null;
  const origin = (y * width + x) * 4;
  const tr = data[origin] ?? 0;
  const tg = data[origin + 1] ?? 0;
  const tb = data[origin + 2] ?? 0;
  const ta = data[origin + 3] ?? 0;
  const mask = new Uint8Array(width * height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const count = width * height;
  for (let index = 0; index < count; index += 1) {
    const at = index * 4;
    const alpha = data[at + 3] ?? 0;
    const hit = ta <= 0 ? alpha <= 0 : alpha === ta && (data[at] ?? 0) === tr && (data[at + 1] ?? 0) === tg && (data[at + 2] ?? 0) === tb;
    if (!hit) continue;
    mask[index] = 1;
    const px = index % width;
    const py = (index - px) / width;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  if (maxX < minX || maxY < minY) return null;
  return { kind: "lasso", mask, bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}

/** Slide the mask only. Pixels stay put, and the shape stays on the canvas. */
export function slideLasso(selection: Extract<PixelSelection, { kind: "lasso" }>, dx: number, dy: number, size: PixelSpan): PixelSelection {
  const { width, height } = gridOf(size);
  const box = selection.bounds;
  const x = Math.max(0, Math.min(Math.max(0, width - box.w), box.x + dx));
  const y = Math.max(0, Math.min(Math.max(0, height - box.h), box.y + dy));
  const shiftX = x - box.x;
  const shiftY = y - box.y;
  if (shiftX === 0 && shiftY === 0) return selection;
  const mask = new Uint8Array(width * height);
  for (let py = box.y; py < box.y + box.h; py += 1) {
    for (let px = box.x; px < box.x + box.w; px += 1) {
      if (selection.mask[py * width + px] !== 1) continue;
      mask[(py + shiftY) * width + (px + shiftX)] = 1;
    }
  }
  return { kind: "lasso", mask, bounds: { x, y, w: box.w, h: box.h } };
}

function paintCell(data: Uint8ClampedArray, size: PixelSpan, x: number, y: number, mode: "rgba" | "alpha"): void {
  const { width, height } = gridOf(size);
  const pixel = readPixel(data, size, x, y);
  if (mode === "alpha") {
    if (pixel.a > 0 && pixel.a !== 255) writePixel(data, size, x, y, { r: pixel.r, g: pixel.g, b: pixel.b, a: 255 });
    return;
  }
  writePixel(data, size, x, y, PIXEL_CLEAR);
}

function fillCell(data: Uint8ClampedArray, size: PixelSpan, x: number, y: number, color: PixelColor, mode: "rgba" | "alpha"): void {
  const { width, height } = gridOf(size);
  if (mode === "alpha") {
    const pixel = readPixel(data, size, x, y);
    if (pixel.a <= 0) return;
    writePixel(data, size, x, y, { r: pixel.r, g: pixel.g, b: pixel.b, a: color.a });
    return;
  }
  if (color.a <= 0) {
    writePixel(data, size, x, y, PIXEL_CLEAR);
    return;
  }
  writeRgb(data, size, x, y, color);
}

/** `rgba` clears color and alpha. `alpha` restores painted cells and leaves RGB alone. Null covers the canvas. */
export function clearSelection(data: Uint8ClampedArray, size: PixelSpan, selection: PixelSelection | null, mode: "rgba" | "alpha"): void {
  const { width, height } = gridOf(size);
  if (!selection || selection.kind === "rect") {
    clearPixels(data, size, selection ? selection.rect : null, mode);
    return;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (selection.mask[y * width + x] === 1) paintCell(data, size, x, y, mode);
    }
  }
}

export function fillSelection(data: Uint8ClampedArray, size: PixelSpan, selection: PixelSelection, color: PixelColor, mode: "rgba" | "alpha"): void {
  const { width, height } = gridOf(size);
  if (selection.kind === "rect") {
    fillRect(data, size, selection.rect, color, mode);
    return;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (selection.mask[y * width + x] === 1) fillCell(data, size, x, y, color, mode);
    }
  }
}

/**
 * Move masked pixels by whole cells. Cells that leave the canvas are dropped.
 * Alpha mode moves alpha only. A rectangle keeps the existing rectangle move.
 */
export function moveSelectionPixels(
  data: Uint8ClampedArray,
  size: PixelSpan,
  selection: PixelSelection,
  dx: number,
  dy: number,
  mode: "rgba" | "alpha",
): PixelSelection | null {
  const { width, height } = gridOf(size);
  if (selection.kind === "rect") {
    const next = movePixels(data, size, selection.rect, dx, dy, mode);
    return next ? { kind: "rect", rect: next } : null;
  }
  if (dx === 0 && dy === 0) return selection;
  const lifted: { x: number; y: number; pixel: PixelColor }[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (selection.mask[y * width + x] !== 1) continue;
      lifted.push({ x, y, pixel: readPixel(data, size, x, y) });
    }
  }
  for (const cell of lifted) paintCell(data, size, cell.x, cell.y, mode);
  const mask = new Uint8Array(width * height);
  for (const cell of lifted) {
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    mask[ny * width + nx] = 1;
    if (mode === "alpha") {
      const dest = readPixel(data, size, nx, ny);
      if (dest.a <= 0) continue;
      writePixel(data, size, nx, ny, { r: dest.r, g: dest.g, b: dest.b, a: cell.pixel.a });
      continue;
    }
    writePixel(data, size, nx, ny, cell.pixel);
  }
  const bounds = maskBounds(mask, size);
  if (!bounds) return null;
  return { kind: "lasso", mask, bounds };
}

/**
 * Mirror pixels horizontally around the selection's center.
 * A null selection flips the whole canvas. The canvas size stays put.
 * A selection moves each selected pixel to its mirror and clears the cells it left.
 * Cells outside the selection's box are not touched.
 */
export function flipSelectionHorizontal(data: Uint8ClampedArray, size: PixelSpan, selection: PixelSelection | null): boolean {
  const { width, height } = gridOf(size);
  if (width < 1 || height < 1 || data.length < width * height * 4) return false;
  const box = selection ? selectionBox(selection) : { x: 0, y: 0, w: width, h: height };
  if (box.w < 2 || box.h < 1) return false;
  const copy = new Uint8ClampedArray(data);
  if (!selection) {
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
    let changed = false;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const mx = box.x + (box.w - 1 - (x - box.x));
        if (!inside(mx, y) || !inside(x, y)) continue;
        const src = readPixel(copy, size, mx, y);
        const dest = readPixel(copy, size, x, y);
        if (samePixel(src, dest)) continue;
        writePixel(data, size, x, y, src);
        changed = true;
      }
    }
    return changed;
  }
  const cells: { x: number; y: number; pixel: PixelColor }[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!selectionHas(selection, x, y, size)) continue;
      cells.push({ x, y, pixel: readPixel(copy, size, x, y) });
    }
  }
  if (cells.length === 0) return false;
  for (const cell of cells) writePixel(data, size, cell.x, cell.y, PIXEL_CLEAR);
  for (const cell of cells) {
    const mx = box.x + (box.w - 1 - (cell.x - box.x));
    const my = cell.y;
    if (mx < 0 || my < 0 || mx >= width || my >= height) continue;
    writePixel(data, size, mx, my, cell.pixel);
  }
  let changed = false;
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] !== copy[index]) {
      changed = true;
      break;
    }
  }
  return changed;
}

/** Mirror a selection across its own box. A rectangle stays put. The canvas size stays put. */
export function mirrorSelectionHorizontal(selection: PixelSelection, size: PixelSpan): PixelSelection {
  const box = selectionBox(selection);
  if (selection.kind === "rect" || box.w < 2) return clonePixelSelection(selection) ?? selection;
  const { width, height } = gridOf(size);
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!selectionHas(selection, x, y, size)) continue;
      const mx = box.x + (box.w - 1 - (x - box.x));
      const my = y;
      if (mx < 0 || my < 0 || mx >= width || my >= height) continue;
      mask[my * width + mx] = 1;
    }
  }
  return selectionFromMask(mask, size) ?? (clonePixelSelection(selection) ?? selection);
}

/** Saved tab names are capped at 24. Duplicate names stay inside that cap. */
export const PIXEL_TAB_NAME_MAX = 24;

/** `キャラクター` → `キャラクター（1）`. A copy of `キャラクター（1）` stays on the same stem. */
export function duplicatePixelTabName(source: string, names: readonly string[]): string {
  const trimmed = source.trim() || "キャンバス";
  const stem = trimmed.replace(/（\d+）$/, "") || trimmed;
  const taken = new Set(names);
  for (let n = 1; n < 10000; n += 1) {
    const suffix = `（${n}）`;
    const room = PIXEL_TAB_NAME_MAX - suffix.length;
    if (room < 1) break;
    const candidate = `${stem.slice(0, room)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem.slice(0, 12)}（${names.length + 1}）`.slice(0, PIXEL_TAB_NAME_MAX);
}

/** A grid line between cells. Coordinates are in cell units, on the cell edges. */
export type GridEdge = { x0: number; y0: number; x1: number; y1: number };

function outlineSelected(selection: PixelSelection, x: number, y: number, size: PixelSpan): boolean {
  const { width, height } = gridOf(size);
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  if (selection.kind === "rect") {
    const rect = selection.rect;
    return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
  }
  return selection.mask[y * width + x] === 1;
}

/**
 * Outer contour of a selection, snapped to the pixel grid.
 * Shared edges between two selected cells are omitted, and the image is not touched.
 */
export function selectionGridEdges(selection: PixelSelection | null, size: PixelSpan): GridEdge[] {
  const { width, height } = gridOf(size);
  if (!selection || width < 1 || height < 1) return [];
  const edges: GridEdge[] = [];
  const on = (x: number, y: number) => outlineSelected(selection, x, y, size);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!on(x, y)) continue;
      if (!on(x, y - 1)) edges.push({ x0: x, y0: y, x1: x + 1, y1: y });
      if (!on(x, y + 1)) edges.push({ x0: x, y0: y + 1, x1: x + 1, y1: y + 1 });
      if (!on(x - 1, y)) edges.push({ x0: x, y0: y, x1: x, y1: y + 1 });
      if (!on(x + 1, y)) edges.push({ x0: x + 1, y0: y, x1: x + 1, y1: y + 1 });
    }
  }
  return edges;
}

export type PixelClip = {
  w: number;
  h: number;
  /** Tight RGBA of the selection bounds. Transparent cells inside the mask stay transparent. */
  rgba: Uint8ClampedArray;
  /** 1 where the selection includes that cell. Independent of the source image. */
  mask: Uint8Array;
  /** Canvas cell of the selection box's top-left. Kept so a paste can start where the art was cut. */
  x?: number;
  y?: number;
};

/** Copies the selected cells into a new buffer. The source image is not changed. */
export function copyPixelSelection(data: Uint8ClampedArray, size: PixelSpan, selection: PixelSelection): PixelClip | null {
  const { width, height } = gridOf(size);
  const box = selectionBox(selection);
  if (box.w < 1 || box.h < 1) return null;
  const rgba = new Uint8ClampedArray(box.w * box.h * 4);
  const mask = new Uint8Array(box.w * box.h);
  let any = false;
  for (let y = 0; y < box.h; y += 1) {
    for (let x = 0; x < box.w; x += 1) {
      const sx = box.x + x;
      const sy = box.y + y;
      if (!selectionHas(selection, sx, sy, size)) continue;
      any = true;
      const index = y * box.w + x;
      mask[index] = 1;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      const from = (sy * width + sx) * 4;
      rgba[index * 4] = data[from] ?? 0;
      rgba[index * 4 + 1] = data[from + 1] ?? 0;
      rgba[index * 4 + 2] = data[from + 2] ?? 0;
      rgba[index * 4 + 3] = data[from + 3] ?? 0;
    }
  }
  if (!any) return null;
  return { w: box.w, h: box.h, rgba, mask, x: box.x, y: box.y };
}

export function clipHas(clip: PixelClip, ox: number, oy: number, x: number, y: number): boolean {
  const lx = x - ox;
  const ly = y - oy;
  if (lx < 0 || ly < 0 || lx >= clip.w || ly >= clip.h) return false;
  return clip.mask[ly * clip.w + lx] === 1;
}

/** Writes masked cells with source-over. Alpha 0 changes nothing. Cells outside the canvas or `selection` are skipped. */
export function stampPixelClip(
  data: Uint8ClampedArray,
  size: PixelSpan,
  clip: PixelClip,
  ox: number,
  oy: number,
  selection: PixelSelection | null = null,
): void {
  const { width, height } = gridOf(size);
  for (let y = 0; y < clip.h; y += 1) {
    const dy = oy + y;
    if (dy < 0 || dy >= height) continue;
    for (let x = 0; x < clip.w; x += 1) {
      const index = y * clip.w + x;
      if (clip.mask[index] !== 1) continue;
      const dx = ox + x;
      if (dx < 0 || dx >= width) continue;
      if (selection && !selectionHas(selection, dx, dy, size)) continue;
      const from = index * 4;
      const sa = clip.rgba[from + 3] ?? 0;
      if (sa <= 0) continue;
      const to = (dy * width + dx) * 4;
      if (sa >= 255) {
        data[to] = clip.rgba[from] ?? 0;
        data[to + 1] = clip.rgba[from + 1] ?? 0;
        data[to + 2] = clip.rgba[from + 2] ?? 0;
        data[to + 3] = 255;
        continue;
      }
      const da = data[to + 3] ?? 0;
      if (da <= 0) {
        data[to] = clip.rgba[from] ?? 0;
        data[to + 1] = clip.rgba[from + 1] ?? 0;
        data[to + 2] = clip.rgba[from + 2] ?? 0;
        data[to + 3] = sa;
        continue;
      }
      const s = sa / 255;
      const d = da / 255;
      const outA = s + d * (1 - s);
      const keep = d * (1 - s);
      data[to] = Math.round(((clip.rgba[from] ?? 0) * s + (data[to] ?? 0) * keep) / outA);
      data[to + 1] = Math.round(((clip.rgba[from + 1] ?? 0) * s + (data[to + 1] ?? 0) * keep) / outA);
      data[to + 2] = Math.round(((clip.rgba[from + 2] ?? 0) * s + (data[to + 2] ?? 0) * keep) / outA);
      data[to + 3] = Math.round(outA * 255);
    }
  }
}

function paintPlaneCell(plane: ImagePlane, x: number, y: number, color: PixelColor): ImagePlane {
  let next = plane;
  if (x < next.x || y < next.y || x >= next.x + next.width || y >= next.y + next.height) next = coverImagePlane(next, x, y, x, y);
  const lx = x - next.x;
  const ly = y - next.y;
  if (lx < 0 || ly < 0 || lx >= next.width || ly >= next.height) return next;
  const at = (ly * next.width + lx) * 4;
  if (color.a <= 0) {
    next.pixels[at] = 0;
    next.pixels[at + 1] = 0;
    next.pixels[at + 2] = 0;
    next.pixels[at + 3] = 0;
    return next;
  }
  if (color.a >= 255) {
    next.pixels[at] = color.r;
    next.pixels[at + 1] = color.g;
    next.pixels[at + 2] = color.b;
    next.pixels[at + 3] = 255;
    return next;
  }
  const da = next.pixels[at + 3] ?? 0;
  if (da <= 0) {
    next.pixels[at] = color.r;
    next.pixels[at + 1] = color.g;
    next.pixels[at + 2] = color.b;
    next.pixels[at + 3] = color.a;
    return next;
  }
  const s = color.a / 255;
  const d = da / 255;
  const outA = s + d * (1 - s);
  const keep = d * (1 - s);
  next.pixels[at] = Math.round((color.r * s + (next.pixels[at] ?? 0) * keep) / outA);
  next.pixels[at + 1] = Math.round((color.g * s + (next.pixels[at + 1] ?? 0) * keep) / outA);
  next.pixels[at + 2] = Math.round((color.b * s + (next.pixels[at + 2] ?? 0) * keep) / outA);
  next.pixels[at + 3] = Math.round(outA * 255);
  return next;
}

/**
 * Lift a selection off `base` and stamp its clip at ox,oy.
 * Fully clear clip cells do not erase the destination. Cells that leave the canvas stay in `rest`.
 */
export function commitFloatMove(
  base: Uint8ClampedArray,
  rest: ImagePlane | null,
  width: number,
  height: number,
  selection: PixelSelection,
  clip: PixelClip,
  ox: number,
  oy: number,
): { pixels: Uint8ClampedArray; rest: ImagePlane | null } {
  let plane = pixelLayerPlane(base, width, height, rest);
  const size = { width, height };
  const { width: gridW, height: gridH } = gridOf(size);
  for (let y = 0; y < gridH; y += 1) {
    for (let x = 0; x < gridW; x += 1) {
      if (!selectionHas(selection, x, y, size)) continue;
      plane = paintPlaneCell(plane, x, y, PIXEL_CLEAR);
    }
  }
  for (let y = 0; y < clip.h; y += 1) {
    for (let x = 0; x < clip.w; x += 1) {
      if (clip.mask[y * clip.w + x] !== 1) continue;
      const from = (y * clip.w + x) * 4;
      const color = {
        r: clip.rgba[from] ?? 0,
        g: clip.rgba[from + 1] ?? 0,
        b: clip.rgba[from + 2] ?? 0,
        a: clip.rgba[from + 3] ?? 0,
      };
      if (color.a <= 0) continue;
      plane = paintPlaneCell(plane, ox + x, oy + y, color);
    }
  }
  return shiftContentPlane(plane, 0, 0, width, height);
}

/** The pasted cells that landed on the canvas. A solid mask stays a rectangle. */
export function pastedSelection(clip: PixelClip, ox: number, oy: number, size: PixelSpan): PixelSelection | null {
  const { width, height } = gridOf(size);
  if (width < 1 || height < 1) return null;
  let solid = true;
  for (let index = 0; index < clip.mask.length; index += 1) {
    if (clip.mask[index] !== 1) {
      solid = false;
      break;
    }
  }
  if (solid) {
    const x0 = Math.max(0, ox);
    const y0 = Math.max(0, oy);
    const x1 = Math.min(width, ox + clip.w);
    const y1 = Math.min(height, oy + clip.h);
    if (x1 <= x0 || y1 <= y0) return null;
    return { kind: "rect", rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
  }
  const mask = new Uint8Array(width * height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < clip.h; y += 1) {
    const dy = oy + y;
    if (dy < 0 || dy >= height) continue;
    for (let x = 0; x < clip.w; x += 1) {
      if (clip.mask[y * clip.w + x] !== 1) continue;
      const dx = ox + x;
      if (dx < 0 || dx >= width) continue;
      mask[dy * width + dx] = 1;
      if (dx < minX) minX = dx;
      if (dy < minY) minY = dy;
      if (dx > maxX) maxX = dx;
      if (dy > maxY) maxY = dy;
    }
  }
  if (maxX < 0) return null;
  return { kind: "lasso", mask, bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}

export type PixelWarp = {
  cx: number;
  cy: number;
  scaleX: number;
  scaleY: number;
  /** Clockwise degrees. Positive and negative are both kept. */
  degrees: number;
  filter: "nearest" | "bilinear";
};

const WARP_MAX_EDGE = 4096;

export function clampWarpScale(length: number, scale: number): number {
  const size = Math.max(1, length);
  const min = 1 / size;
  const max = WARP_MAX_EDGE / size;
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.max(min, Math.min(max, scale));
}

export function warpEdge(length: number, scale: number): number {
  return Math.max(1, Math.min(WARP_MAX_EDGE, Math.round(Math.max(1, length) * clampWarpScale(length, scale))));
}

/** Exact axes for right angles. Other angles use radians. */
export function warpSinCos(degrees: number): { sin: number; cos: number } {
  const turns = ((degrees % 360) + 360) % 360;
  if (turns === 0) return { sin: 0, cos: 1 };
  if (turns === 90) return { sin: 1, cos: 0 };
  if (turns === 180) return { sin: 0, cos: -1 };
  if (turns === 270) return { sin: -1, cos: 0 };
  const rad = (degrees * Math.PI) / 180;
  return { sin: Math.sin(rad), cos: Math.cos(rad) };
}

export function warpSetWidth(clip: PixelClip, scaleY: number, width: number, lock: boolean): { scaleX: number; scaleY: number } {
  const scaleX = clampWarpScale(clip.w, width / Math.max(1, clip.w));
  return { scaleX, scaleY: lock ? clampWarpScale(clip.h, scaleX) : clampWarpScale(clip.h, scaleY) };
}

export function warpSetHeight(clip: PixelClip, scaleX: number, height: number, lock: boolean): { scaleX: number; scaleY: number } {
  const scaleY = clampWarpScale(clip.h, height / Math.max(1, clip.h));
  return { scaleY, scaleX: lock ? clampWarpScale(clip.w, scaleY) : clampWarpScale(clip.w, scaleX) };
}

export function warpCorners(clip: PixelClip, warp: PixelWarp): { x: number; y: number }[] {
  const { sin, cos } = warpSinCos(warp.degrees);
  return [0, 1, 2, 3].map((index) => {
    const lx = (index === 1 || index === 2 ? clip.w : 0) - clip.w / 2;
    const ly = (index >= 2 ? clip.h : 0) - clip.h / 2;
    const px = lx * warp.scaleX;
    const py = ly * warp.scaleY;
    return { x: warp.cx + px * cos - py * sin, y: warp.cy + px * sin + py * cos };
  });
}

/** Circles sitting just outside each corner, along the diagonal, so they miss the square handles. */
export function warpRotateHandles(clip: PixelClip, warp: PixelWarp, pad: number): { x: number; y: number }[] {
  const gap = Number.isFinite(pad) ? Math.max(0, pad) : 0;
  return warpCorners(clip, warp).map((corner) => {
    const vx = corner.x - warp.cx;
    const vy = corner.y - warp.cy;
    const len = Math.hypot(vx, vy) || 1;
    return { x: corner.x + (vx / len) * gap, y: corner.y + (vy / len) * gap };
  });
}

/** Grow or shrink both axes together. The scale ratio from the drag start stays put. */
export function warpLockedScales(
  clipW: number,
  clipH: number,
  scaleX: number,
  scaleY: number,
  unX: number,
  unY: number,
): { scaleX: number; scaleY: number } {
  const base = Math.hypot((Math.max(1, clipW) / 2) * scaleX, (Math.max(1, clipH) / 2) * scaleY);
  const factor = base > 0 ? Math.hypot(unX, unY) / base : 1;
  return { scaleX: scaleX * factor, scaleY: scaleY * factor };
}

/** Map a canvas point into the source clip. 0,0 is the clip's top-left edge. */
export function warpLocal(clip: PixelClip, warp: PixelWarp, x: number, y: number): { x: number; y: number } {
  const { sin, cos } = warpSinCos(warp.degrees);
  const dx = x - warp.cx;
  const dy = y - warp.cy;
  const px = (dx * cos + dy * sin) / warp.scaleX;
  const py = (-dx * sin + dy * cos) / warp.scaleY;
  return { x: px + clip.w / 2, y: py + clip.h / 2 };
}

function warpSample(
  clip: PixelClip,
  u: number,
  v: number,
  filter: PixelWarp["filter"],
): { r: number; g: number; b: number; a: number } | null {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < clip.w && y < clip.h && clip.mask[y * clip.w + x] === 1;
  const read = (x: number, y: number) => {
    const from = (y * clip.w + x) * 4;
    return { r: clip.rgba[from] ?? 0, g: clip.rgba[from + 1] ?? 0, b: clip.rgba[from + 2] ?? 0, a: clip.rgba[from + 3] ?? 0 };
  };
  if (filter !== "bilinear") {
    const x = Math.floor(u + 0.5);
    const y = Math.floor(v + 0.5);
    return inside(x, y) ? read(x, y) : null;
  }
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const tx = u - x0;
  const ty = v - y0;
  let weight = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  const mix = (x: number, y: number, amount: number) => {
    if (amount <= 0 || !inside(x, y)) return;
    const pixel = read(x, y);
    const cover = amount * (pixel.a / 255);
    r += pixel.r * cover;
    g += pixel.g * cover;
    b += pixel.b * cover;
    a += pixel.a * amount;
    weight += amount;
  };
  mix(x0, y0, (1 - tx) * (1 - ty));
  mix(x0 + 1, y0, tx * (1 - ty));
  mix(x0, y0 + 1, (1 - tx) * ty);
  mix(x0 + 1, y0 + 1, tx * ty);
  if (weight <= 0 || a <= 0) {
    if (weight <= 0) return null;
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  return {
    r: Math.max(0, Math.min(255, Math.round(r / (a / 255)))),
    g: Math.max(0, Math.min(255, Math.round(g / (a / 255)))),
    b: Math.max(0, Math.min(255, Math.round(b / (a / 255)))),
    a: Math.max(0, Math.min(255, Math.round(a / weight))),
  };
}

function selectionFromMask(mask: Uint8Array, size: PixelSpan): PixelSelection | null {
  const { width, height } = gridOf(size);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue;
      count += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (count === 0) return null;
  const rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  if (count === rect.w * rect.h) return { kind: "rect", rect };
  return { kind: "lasso", mask, bounds: rect };
}

/**
 * Move, scale, and rotate a clip onto a copy of the canvas.
 * The source buffer is not changed. Samples that miss the mask, or land outside, are skipped.
 * `limit`, when set, also drops samples that fall outside that selection.
 */
export function warpPixels(
  base: Uint8ClampedArray,
  size: PixelSpan,
  clip: PixelClip,
  ox: number,
  oy: number,
  warp: PixelWarp,
  limit: PixelSelection | null = null,
): { data: Uint8ClampedArray; selection: PixelSelection | null } {
  const { width, height } = gridOf(size);
  const data = new Uint8ClampedArray(base);
  const written = new Uint8Array(width * height);
  for (let y = 0; y < clip.h; y += 1) {
    const dy = oy + y;
    if (dy < 0 || dy >= height) continue;
    for (let x = 0; x < clip.w; x += 1) {
      if (clip.mask[y * clip.w + x] !== 1) continue;
      const dx = ox + x;
      if (dx < 0 || dx >= width) continue;
      const at = (dy * width + dx) * 4;
      data[at] = 0;
      data[at + 1] = 0;
      data[at + 2] = 0;
      data[at + 3] = 0;
    }
  }
  const corners = warpCorners(clip, warp);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (const corner of corners) {
    minX = Math.min(minX, Math.floor(corner.x));
    minY = Math.min(minY, Math.floor(corner.y));
    maxX = Math.max(maxX, Math.ceil(corner.x));
    maxY = Math.max(maxY, Math.ceil(corner.y));
  }
  const x0 = Math.max(0, minX);
  const y0 = Math.max(0, minY);
  const x1 = Math.min(width - 1, maxX);
  const y1 = Math.min(height - 1, maxY);
  const { sin, cos } = warpSinCos(warp.degrees);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x + 0.5 - warp.cx;
      const dy = y + 0.5 - warp.cy;
      const px = (dx * cos + dy * sin) / warp.scaleX;
      const py = (-dx * sin + dy * cos) / warp.scaleY;
      const u = px + clip.w / 2 - 0.5;
      const v = py + clip.h / 2 - 0.5;
      const sample = warpSample(clip, u, v, warp.filter);
      if (!sample) continue;
      if (limit && !selectionHas(limit, x, y, size)) continue;
      if (limit && !selectionHas(limit, x, y, size)) continue;
      const at = (y * width + x) * 4;
      data[at] = sample.r;
      data[at + 1] = sample.g;
      data[at + 2] = sample.b;
      data[at + 3] = sample.a;
      written[y * width + x] = 1;
    }
  }
  return { data, selection: selectionFromMask(written, size) };
}

/** Cube index for an exact RGB match. Off-cube colors return null. */
export function paletteIndex(color: { r: number; g: number; b: number }): number | null {
  const key = rgbKey(color.r, color.g, color.b);
  const index = PIXEL_PALETTE.findIndex((entry) => rgbKey(entry.r, entry.g, entry.b) === key);
  return index >= 0 ? index : null;
}

function inkByte(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255;
}

/** Palette index, a free RGB, or clear. Anything else is dropped. */
export function parseInkPick(value: unknown): InkPick | null {
  if (value === "clear") return "clear";
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < PIXEL_PALETTE.length) return value;
  if (!value || typeof value !== "object") return null;
  const row = value as { r?: unknown; g?: unknown; b?: unknown };
  if (!inkByte(row.r) || !inkByte(row.g) || !inkByte(row.b)) return null;
  return { r: row.r, g: row.g, b: row.b };
}

/** Same painted color shares one key, whether it was stored as a cube index or as RGB. */
export function inkKey(pick: InkPick): string {
  if (pick === "clear") return "clear";
  if (typeof pick === "number") {
    const color = PIXEL_PALETTE[pick];
    return color ? `${color.r},${color.g},${color.b}` : `n:${pick}`;
  }
  return `${pick.r},${pick.g},${pick.b}`;
}

/**
 * Put a freshly eyedropped color at the front.
 * A color already in the list moves there instead of being stored twice.
 * The oldest color falls off after the cap. Choosing a remembered color does not call this.
 */
export function rememberDrop(history: readonly InkPick[], pick: InkPick, cap = PIXEL_DROP_CAP): InkPick[] {
  const key = inkKey(pick);
  const rest = history.filter((item) => inkKey(item) !== key);
  return [pick, ...rest].slice(0, Math.max(1, cap));
}

export function encodePixelInk(color: InkPick, drops: readonly InkPick[]): string {
  return JSON.stringify({ color, drops: drops.slice(0, PIXEL_DROP_CAP) });
}

export function parsePixelInk(raw: string): { color: InkPick | null; drops: InkPick[] } {
  if (!raw) return { color: null, drops: [] };
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return { color: null, drops: [] };
    const row = value as { color?: unknown; drops?: unknown };
    const drops: InkPick[] = [];
    const seen = new Set<string>();
    if (Array.isArray(row.drops)) {
      for (const item of row.drops) {
        const pick = parseInkPick(item);
        if (!pick) continue;
        const key = inkKey(pick);
        if (seen.has(key)) continue;
        seen.add(key);
        drops.push(pick);
        if (drops.length >= PIXEL_DROP_CAP) break;
      }
    }
    return { color: parseInkPick(row.color), drops };
  } catch {
    return { color: null, drops: [] };
  }
}

/** Nearest 10–90 transparency step. Opaque and empty pixels are not a transparency sample. */
export function nearestAlphaPercent(alpha: number): AlphaPercent | null {
  if (alpha <= 0 || alpha >= 255) return null;
  let best: AlphaPercent = 50;
  let dist = Number.POSITIVE_INFINITY;
  for (const percent of ALPHA_PERCENTS) {
    const next = Math.abs(alphaByte(percent) - alpha);
    if (next < dist) {
      dist = next;
      best = percent;
    }
  }
  return best;
}

/** Smallest square canvas that can hold the slice without scaling. Null when it cannot fit in 256. */
export function fitPixelSquare(width: number, height: number): PixelSize | null {
  const need = Math.max(width, height);
  if (!Number.isFinite(need) || need < 1 || need > 256) return null;
  for (const size of PIXEL_SIZES) if (size >= need) return size;
  return null;
}

/**
 * Size for a dropped image that becomes its own canvas tab.
 * Images larger than 256 still become a 256 canvas and are scaled down by blitContain.
 * Invalid sizes return null so the current canvas can stay untouched.
 */
export function importCanvasSize(width: number, height: number): PixelSize | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;
  return fitPixelSquare(width, height) ?? 256;
}

/** Puts a slice at the top-left. Extra cells stay clear. The slice itself is not scaled. */
export function placeSlice(slice: Uint8ClampedArray, frameW: number, frameH: number, size: number): Uint8ClampedArray {
  const out = createPixels(size);
  const copyW = Math.max(0, Math.min(frameW, size));
  const copyH = Math.max(0, Math.min(frameH, size));
  for (let y = 0; y < copyH; y += 1) {
    const from = y * frameW * 4;
    out.set(slice.subarray(from, from + copyW * 4), y * size * 4);
  }
  return out;
}

export function isPixelSize(value: number): value is PixelSize {
  return (PIXEL_SIZES as readonly number[]).includes(value);
}

export function createPixels(width: number, rows?: number): Uint8ClampedArray {
  const height = rows ?? width;
  return new Uint8ClampedArray(Math.max(0, width) * Math.max(0, height) * 4);
}

export function samePixel(a: PixelColor, b: PixelColor): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

export function colorCss(color: PixelColor): string {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}

const APPROX_STEPS = 14;
const APPROX_COLUMNS = 7;

function mixChannel(from: number, to: number, t: number): number {
  return Math.max(0, Math.min(255, Math.round(from + (to - from) * t)));
}

/**
 * Even RGB steps from the current color toward white and toward black.
 * The current color is not included. The last step of each ramp is pure white or pure black.
 * White is ordered farthest-first (lightest row on top). Black is ordered nearest-first (darkest row on the bottom).
 */
export function approxColorBands(
  base: { r: number; g: number; b: number },
  steps = APPROX_STEPS,
): { white: { r: number; g: number; b: number }[]; black: { r: number; g: number; b: number }[] } {
  const count = Math.max(1, Math.trunc(steps));
  const towardWhite: { r: number; g: number; b: number }[] = [];
  const towardBlack: { r: number; g: number; b: number }[] = [];
  for (let step = 1; step <= count; step += 1) {
    const t = step / count;
    towardWhite.push({
      r: mixChannel(base.r, 255, t),
      g: mixChannel(base.g, 255, t),
      b: mixChannel(base.b, 255, t),
    });
    towardBlack.push({
      r: mixChannel(base.r, 0, t),
      g: mixChannel(base.g, 0, t),
      b: mixChannel(base.b, 0, t),
    });
  }
  const rows = Math.ceil(count / APPROX_COLUMNS);
  const white: { r: number; g: number; b: number }[] = [];
  const black: { r: number; g: number; b: number }[] = [];
  for (let row = rows - 1; row >= 0; row -= 1) white.push(...towardWhite.slice(row * APPROX_COLUMNS, (row + 1) * APPROX_COLUMNS));
  for (let row = 0; row < rows; row += 1) black.push(...towardBlack.slice(row * APPROX_COLUMNS, (row + 1) * APPROX_COLUMNS));
  return { white, black };
}

export function readPixel(data: Uint8ClampedArray, size: PixelSpan, x: number, y: number): PixelColor {
  const { width, height } = gridOf(size);
  const i = (y * width + x) * 4;
  return { r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0, a: data[i + 3] ?? 0 };
}

export function writePixel(data: Uint8ClampedArray, size: PixelSpan, x: number, y: number, color: PixelColor): void {
  const { width, height } = gridOf(size);
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (y * width + x) * 4;
  data[i] = color.r;
  data[i + 1] = color.g;
  data[i + 2] = color.b;
  data[i + 3] = color.a;
}

/**
 * Paint RGB only. An existing pixel keeps its alpha byte.
 * A new pixel starts opaque. This does not rebuild or clear the alpha layer.
 */
export function writeRgb(data: Uint8ClampedArray, size: PixelSpan, x: number, y: number, color: { r: number; g: number; b: number }): void {
  const { width, height } = gridOf(size);
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const pixel = readPixel(data, size, x, y);
  writePixel(data, size, x, y, { r: color.r, g: color.g, b: color.b, a: pixel.a > 0 ? pixel.a : 255 });
}

/** Inclusive line. Consecutive cells stay neighbors, including diagonal steps, so a drag cannot skip. */
export function bresenham(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const doubled = err * 2;
    if (doubled > -dy) {
      err -= dy;
      x += sx;
    }
    if (doubled < dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

export type SymmetryAxis = { x0: number; y0: number; x1: number; y1: number };

/** A saved guide is two different cells. Anything else is no ruler. */
export function symmetryAxisOf(value: unknown): SymmetryAxis | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<SymmetryAxis>;
  const coords = [row.x0, row.y0, row.x1, row.y1];
  if (!coords.every((coord) => typeof coord === "number" && Number.isInteger(coord))) return null;
  const axis = { x0: row.x0 as number, y0: row.y0 as number, x1: row.x1 as number, y1: row.y1 as number };
  if (axis.x0 === axis.x1 && axis.y0 === axis.y1) return null;
  return axis;
}

/**
 * Mirror one cell across the infinite line through the two axis cells.
 * Cell centers are the geometry, then the result snaps back to a cell.
 * The same source cell always lands on the same mirror. A cell on the axis stays put.
 */
export function reflectPixel(x: number, y: number, axis: SymmetryAxis): { x: number; y: number } | null {
  const ax = axis.x0 + 0.5;
  const ay = axis.y0 + 0.5;
  const dx = axis.x1 - axis.x0;
  const dy = axis.y1 - axis.y0;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return null;
  const qx = x + 0.5;
  const qy = y + 0.5;
  const t = ((qx - ax) * dx + (qy - ay) * dy) / len2;
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const rx = projX * 2 - qx;
  const ry = projY * 2 - qy;
  return { x: Math.round(rx - 0.5), y: Math.round(ry - 0.5) };
}

/** The axis line clipped to the canvas square, in the same space as cell edges (0..size). */
export function clipAxisLine(axis: SymmetryAxis, size: PixelSpan): { x0: number; y0: number; x1: number; y1: number } | null {
  const { width, height } = gridOf(size);
  if (width < 1 || height < 1) return null;
  const x0 = axis.x0 + 0.5;
  const y0 = axis.y0 + 0.5;
  const dx = axis.x1 - axis.x0;
  const dy = axis.y1 - axis.y0;
  if (dx === 0 && dy === 0) return null;
  const hits: { x: number; y: number; t: number }[] = [];
  const consider = (t: number) => {
    if (!Number.isFinite(t)) return;
    const x = x0 + t * dx;
    const y = y0 + t * dy;
    const eps = 1e-4;
    if (x < -eps || y < -eps || x > width + eps || y > height + eps) return;
    hits.push({ x: Math.min(width, Math.max(0, x)), y: Math.min(height, Math.max(0, y)), t });
  };
  if (dx !== 0) {
    consider(-x0 / dx);
    consider((width - x0) / dx);
  }
  if (dy !== 0) {
    consider(-y0 / dy);
    consider((height - y0) / dy);
  }
  if (hits.length < 2) return null;
  hits.sort((a, b) => a.t - b.t);
  const start = hits[0];
  const end = hits[hits.length - 1];
  if (!start || !end || Math.hypot(start.x - end.x, start.y - end.y) < 0.5) return null;
  return { x0: start.x, y0: start.y, x1: end.x, y1: end.y };
}

/**
 * Cells a freehand stroke should stamp when a symmetry ruler is active.
 * Source cells stay in order. Each one is mirrored, and a gap between
 * consecutive mirrors is filled so the opposite stroke stays connected.
 * A cell is stamped once. `contains` drops a source outside the selection
 * and also drops mirror cells outside it. A rejected source breaks the mirror line.
 */
export function symmetricStampCells(
  points: { x: number; y: number }[],
  axis: SymmetryAxis,
  size: PixelSpan,
  contains: ((x: number, y: number) => boolean) | null,
): { x: number; y: number }[] {
  const { width, height } = gridOf(size);
  if (width < 1 || height < 1) return [];
  const out: { x: number; y: number }[] = [];
  const seen = new Set<number>();
  const add = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    if (contains && !contains(x, y)) return;
    const key = y * width + x;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y });
  };
  let previous: { x: number; y: number } | null = null;
  for (const point of points) {
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height || (contains && !contains(point.x, point.y))) {
      previous = null;
      continue;
    }
    add(point.x, point.y);
    const mirror = reflectPixel(point.x, point.y, axis);
    if (!mirror) {
      previous = null;
      continue;
    }
    if (previous) {
      for (const step of bresenham(previous.x, previous.y, mirror.x, mirror.y)) add(step.x, step.y);
    } else add(mirror.x, mirror.y);
    previous = mirror;
  }
  return out;
}

/**
 * 1px ellipse outline inscribed in the inclusive box from (x0, y0) to (x1, y1).
 * There is no separate line or rectangle brush here, so this matches a pen stroke:
 * no fill, no antialiasing, and a square box is a circle. A 1px side is a straight run.
 */
export function ellipseOutline(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const seen = new Set<number>();
  const mark = (x: number, y: number) => {
    const key = (y + 2048) * 8192 + (x + 2048);
    if (seen.has(key)) return;
    seen.add(key);
    points.push({ x, y });
  };
  if (x0 === x1 || y0 === y1) {
    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const top = Math.min(y0, y1);
    const bottom = Math.max(y0, y1);
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) mark(x, y);
    }
    return points;
  }
  let a = Math.abs(x1 - x0);
  let b = Math.abs(y1 - y0);
  const boxLeft = Math.min(x0, x1);
  const boxRight = Math.max(x0, x1);
  const boxTop = Math.min(y0, y1);
  const boxBottom = Math.max(y0, y1);
  let b1 = b & 1;
  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;
  if (x0 > x1) {
    x0 = x1;
    x1 += a;
  }
  if (y0 > y1) y0 = y1;
  y0 += (b + 1) >> 1;
  y1 = y0 - b1;
  a *= 8 * a;
  b1 = 8 * b * b;
  do {
    mark(x1, y0);
    mark(x0, y0);
    mark(x0, y1);
    mark(x1, y1);
    const e2 = 2 * err;
    if (e2 <= dy) {
      y0 += 1;
      y1 -= 1;
      err += dy += a;
    }
    if (e2 >= dx || 2 * err > dy) {
      x0 += 1;
      x1 -= 1;
      err += dx += b1;
    }
  } while (x0 <= x1);
  while (y0 - y1 < b) {
    mark(x0 - 1, y0);
    mark(x1 + 1, y0);
    y0 += 1;
    mark(x0 - 1, y1);
    mark(x1 + 1, y1);
    y1 -= 1;
  }
  const inside = (point: { x: number; y: number }) => point.x >= boxLeft && point.x <= boxRight && point.y >= boxTop && point.y <= boxBottom;
  const cover = (axis: "x" | "y", edge: number, inward: number) => {
    for (const point of points.slice()) {
      if (!inside(point)) continue;
      if (axis === "y" && point.y === inward) mark(point.x, edge);
      if (axis === "x" && point.x === inward) mark(edge, point.y);
    }
  };
  if (!points.some((point) => inside(point) && point.y === boxTop)) cover("y", boxTop, boxTop + 1);
  if (!points.some((point) => inside(point) && point.y === boxBottom)) cover("y", boxBottom, boxBottom - 1);
  if (!points.some((point) => inside(point) && point.x === boxLeft)) cover("x", boxLeft, boxLeft + 1);
  if (!points.some((point) => inside(point) && point.x === boxRight)) cover("x", boxRight, boxRight - 1);
  return points;
}

export type EllipseInk = { mode: "rgba"; color: PixelColor } | { mode: "alpha"; alpha: number };

/** Paint the ellipse rim. Selection clips. Alpha mode only retints ink that already exists. Returns how many cells changed. */
export function paintEllipse(
  data: Uint8ClampedArray,
  size: PixelSpan,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ink: EllipseInk,
  selection: PixelSelection | null,
): number {
  const { width, height } = gridOf(size);
  if (width < 1 || height < 1) return 0;
  let changed = 0;
  for (const point of ellipseOutline(x0, y0, x1, y1)) {
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) continue;
    if (selection && !selectionHas(selection, point.x, point.y, size)) continue;
    const before = readPixel(data, size, point.x, point.y);
    if (ink.mode === "alpha") writeAlpha(data, size, point.x, point.y, ink.alpha);
    else if (ink.color.a <= 0) writePixel(data, size, point.x, point.y, PIXEL_CLEAR);
    else writeRgb(data, size, point.x, point.y, ink.color);
    if (!samePixel(before, readPixel(data, size, point.x, point.y))) changed += 1;
  }
  return changed;
}

export type StrokePoint = { x: number; y: number };

/** The right-angle cell of a 1px L whose ends are diagonal neighbors. */
export function isPixelElbow(a: StrokePoint, b: StrokePoint, c: StrokePoint): boolean {
  if (Math.abs(a.x - c.x) !== 1 || Math.abs(a.y - c.y) !== 1) return false;
  if (b.x === a.x && b.y === c.y) return b.x !== c.x && b.y !== a.y;
  if (b.y === a.y && b.x === c.x) return b.y !== c.y && b.x !== a.x;
  return false;
}

/**
 * Record one cell of this stroke. Returns a jaggy to restore, or null.
 * A 1px elbow is removed only when the next step keeps going diagonally.
 * A corner that continues straight, a side hook, and the last elbow of the stroke stay.
 */
export function notePerfectStep(points: StrokePoint[], next: StrokePoint): StrokePoint | null {
  const prev = points[points.length - 1];
  if (prev && prev.x === next.x && prev.y === next.y) return null;
  points.push({ x: next.x, y: next.y });
  if (points.length < 4) return null;
  const a = points[points.length - 4];
  const b = points[points.length - 3];
  const c = points[points.length - 2];
  const d = points[points.length - 1];
  if (!a || !b || !c || !d || !isPixelElbow(a, b, c)) return null;
  const step1x = b.x - a.x;
  const step1y = b.y - a.y;
  const step2x = c.x - b.x;
  const step2y = c.y - b.y;
  const step3x = d.x - c.x;
  const step3y = d.y - c.y;
  if (step3x === step2x && step3y === step2y) return null;
  if (step3x === -step2x && step3y === -step2y) return null;
  if (step3x === -step1x && step3y === -step1y) return null;
  if (d.x === a.x && d.y === a.y) return null;
  const jaggy =
    (step3x === step1x && step3y === step1y) ||
    (step3x === step1x + step2x && step3y === step1y + step2y);
  if (!jaggy) return null;
  const elbowAt = points.length - 3;
  for (let index = 0; index < points.length; index += 1) {
    if (index === elbowAt) continue;
    const point = points[index];
    if (point && point.x === b.x && point.y === b.y) return null;
  }
  const [dropped] = points.splice(elbowAt, 1);
  return dropped ?? null;
}

/** Paint one cell, then put a detected jaggy back to its pre-stroke color. */
export function commitPerfectPixel(
  points: StrokePoint[],
  data: Uint8ClampedArray,
  before: Uint8ClampedArray,
  size: PixelSpan,
  step: StrokePoint,
  paint: (x: number, y: number) => void,
): void {
  const { width, height } = gridOf(size);
  paint(step.x, step.y);
  const drop = notePerfectStep(points, step);
  if (!drop || drop.x < 0 || drop.y < 0 || drop.x >= width || drop.y >= height) return;
  const index = (drop.y * width + drop.x) * 4;
  data[index] = before[index] ?? 0;
  data[index + 1] = before[index + 1] ?? 0;
  data[index + 2] = before[index + 2] ?? 0;
  data[index + 3] = before[index + 3] ?? 0;
}

/**
 * Cells between the two ends of a gradient. The ends stay as they are.
 * Cells outside `selection` are omitted. The buffers are not written.
 */
export function gradientSpanCells(
  size: PixelSpan,
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  selection: PixelSelection | null = null,
): { x: number; y: number }[] {
  const { width, height } = gridOf(size);
  if (ax < 0 || ay < 0 || cx < 0 || cy < 0 || ax >= width || ay >= height || cx >= width || cy >= height) return [];
  const line = bresenham(ax, ay, cx, cy);
  if (line.length < 3) return [];
  const cells: { x: number; y: number }[] = [];
  for (let index = 1; index < line.length - 1; index += 1) {
    const point = line[index];
    if (!point) continue;
    if (selection && !selectionHas(selection, point.x, point.y, size)) continue;
    cells.push(point);
  }
  return cells;
}

/**
 * Recolor the cells between two ends. The ends stay put, and each cell keeps its alpha.
 * RGB is mixed by how far the cell sits along the whole line. A selection skips the rest.
 */
export function applyPixelGradient(
  data: Uint8ClampedArray,
  size: PixelSpan,
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  selection: PixelSelection | null = null,
): boolean {
  const line = bresenham(ax, ay, cx, cy);
  const cells = gradientSpanCells(size, ax, ay, cx, cy, selection);
  if (cells.length === 0 || line.length < 3) return false;
  const start = readPixel(data, size, ax, ay);
  const end = readPixel(data, size, cx, cy);
  const span = line.length - 1;
  const mix = (from: number, to: number, t: number) => Math.max(0, Math.min(255, Math.round(from + (to - from) * t)));
  let changed = false;
  for (const point of cells) {
    const at = line.findIndex((step) => step.x === point.x && step.y === point.y);
    if (at <= 0 || at >= span) continue;
    const t = at / span;
    const rgb = { r: mix(start.r, end.r, t), g: mix(start.g, end.g, t), b: mix(start.b, end.b, t) };
    const current = readPixel(data, size, point.x, point.y);
    if (current.r === rgb.r && current.g === rgb.g && current.b === rgb.b) continue;
    writePixel(data, size, point.x, point.y, { ...rgb, a: current.a });
    changed = true;
  }
  return changed;
}

/**
 * 4-connected flood of one RGBA, including transparent.
 * A diagonal touch does not count. Cells outside `selection` are not painted or crossed.
 * Returns how many cells changed.
 */
export function floodFill(data: Uint8ClampedArray, size: PixelSpan, x: number, y: number, color: PixelColor, selection: PixelSelection | null = null): number {
  const { width, height } = gridOf(size);
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  if (selection && !selectionHas(selection, x, y, size)) return 0;
  const target = readPixel(data, size, x, y);
  if (samePixel(target, color)) return 0;
  const seen = new Uint8Array(width * height);
  const stack = [x, y];
  let painted = 0;
  while (stack.length > 0) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const index = cy * width + cx;
    if (seen[index]) continue;
    seen[index] = 1;
    if (selection && !selectionHas(selection, cx, cy, size)) continue;
    if (!samePixel(readPixel(data, size, cx, cy), target)) continue;
    writePixel(data, size, cx, cy, color);
    painted += 1;
    stack.push(cx - 1, cy, cx + 1, cy, cx, cy - 1, cx, cy + 1);
  }
  return painted;
}

/**
 * Flood a new RGB across one exact RGBA region.
 * Each cell keeps the alpha it already had. A clear color removes the pixel and its alpha.
 * Cells outside `selection` are not painted or crossed.
 */
export function floodRgb(data: Uint8ClampedArray, size: PixelSpan, x: number, y: number, color: PixelColor, selection: PixelSelection | null = null): number {
  const { width, height } = gridOf(size);
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  if (selection && !selectionHas(selection, x, y, size)) return 0;
  const target = readPixel(data, size, x, y);
  if (color.a > 0 && target.r === color.r && target.g === color.g && target.b === color.b && target.a > 0) return 0;
  if (color.a <= 0 && target.a <= 0) return 0;
  const seen = new Uint8Array(width * height);
  const stack = [x, y];
  let painted = 0;
  while (stack.length > 0) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const index = cy * width + cx;
    if (seen[index]) continue;
    seen[index] = 1;
    if (selection && !selectionHas(selection, cx, cy, size)) continue;
    const pixel = readPixel(data, size, cx, cy);
    if (!samePixel(pixel, target)) continue;
    if (color.a <= 0) writePixel(data, size, cx, cy, PIXEL_CLEAR);
    else writeRgb(data, size, cx, cy, color);
    painted += 1;
    stack.push(cx - 1, cy, cx + 1, cy, cx, cy - 1, cx, cy + 1);
  }
  return painted;
}

/**
 * Replace one RGB across the canvas, or only inside `selection` when one exists.
 * Fully clear cells are skipped. Every changed cell keeps its own alpha.
 * The same destination RGB, a clear click, and a miss all change nothing.
 */
export function replaceRgb(
  data: Uint8ClampedArray,
  size: PixelSpan,
  x: number,
  y: number,
  color: { r: number; g: number; b: number },
  selection: PixelSelection | null,
): number {
  const { width, height } = gridOf(size);
  if (width < 1 || height < 1 || x < 0 || y < 0 || x >= width || y >= height) return 0;
  const origin = (y * width + x) * 4;
  const alpha = data[origin + 3] ?? 0;
  if (alpha <= 0) return 0;
  const tr = data[origin] ?? 0;
  const tg = data[origin + 1] ?? 0;
  const tb = data[origin + 2] ?? 0;
  if (tr === color.r && tg === color.g && tb === color.b) return 0;
  let painted = 0;
  const count = width * height;
  for (let index = 0; index < count; index += 1) {
    const at = index * 4;
    if ((data[at + 3] ?? 0) <= 0) continue;
    if ((data[at] ?? 0) !== tr || (data[at + 1] ?? 0) !== tg || (data[at + 2] ?? 0) !== tb) continue;
    const px = index % width;
    const py = (index - px) / width;
    if (selection && !selectionHas(selection, px, py, size)) continue;
    data[at] = color.r;
    data[at + 1] = color.g;
    data[at + 2] = color.b;
    painted += 1;
  }
  return painted;
}

/** Move `id` to the slot currently occupied by `beforeId`. Other tabs keep their own pixels. */
export function moveTabOrder<T extends { id: string }>(tabs: readonly T[], id: string, beforeId: string): T[] | null {
  if (id === beforeId) return null;
  const from = tabs.findIndex((tab) => tab.id === id);
  const target = tabs.findIndex((tab) => tab.id === beforeId);
  if (from < 0 || target < 0) return null;
  const next = tabs.slice();
  const [moving] = next.splice(from, 1);
  if (!moving) return null;
  const dest = next.findIndex((tab) => tab.id === beforeId);
  if (dest < 0) return null;
  next.splice(dest, 0, moving);
  return next;
}

export type ContainFit = {
  scale: number;
  dw: number;
  dh: number;
  ox: number;
  oy: number;
};

/** Fit inside the square without scaling up. Leftover cells stay outside dw×dh. */
export function containFit(srcW: number, srcH: number, dst: number): ContainFit {
  if (srcW < 1 || srcH < 1 || dst < 1) return { scale: 1, dw: 0, dh: 0, ox: 0, oy: 0 };
  const scale = Math.min(1, dst / srcW, dst / srcH);
  let dw = Math.min(dst, Math.max(0, Math.round(srcW * scale)));
  let dh = Math.min(dst, Math.max(0, Math.round(srcH * scale)));
  if (dw < 1) dw = 1;
  if (dh < 1) dh = 1;
  return {
    scale,
    dw,
    dh,
    ox: Math.floor((dst - dw) / 2),
    oy: Math.floor((dst - dh) / 2),
  };
}

function clampByte(value: number): number {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}

function averageRect(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
): PixelColor {
  let ix0 = Math.max(0, Math.floor(sx0));
  let iy0 = Math.max(0, Math.floor(sy0));
  let ix1 = Math.min(srcW, Math.ceil(sx1 - 1e-6));
  let iy1 = Math.min(srcH, Math.ceil(sy1 - 1e-6));
  if (ix1 <= ix0) ix1 = Math.min(srcW, ix0 + 1);
  if (iy1 <= iy0) iy1 = Math.min(srcH, iy0 + 1);
  if (ix1 === ix0 + 1 && iy1 === iy0 + 1) return readPixel(src, srcW, ix0, iy0);
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let weight = 0;
  for (let y = iy0; y < iy1; y += 1) {
    const yCover = Math.min(sy1, y + 1) - Math.max(sy0, y);
    if (yCover <= 0) continue;
    for (let x = ix0; x < ix1; x += 1) {
      const xCover = Math.min(sx1, x + 1) - Math.max(sx0, x);
      if (xCover <= 0) continue;
      const cover = xCover * yCover;
      const pixel = readPixel(src, srcW, x, y);
      const alpha = pixel.a / 255;
      r += pixel.r * alpha * cover;
      g += pixel.g * alpha * cover;
      b += pixel.b * alpha * cover;
      a += pixel.a * cover;
      weight += cover;
    }
  }
  if (weight <= 0 || a <= 0) return PIXEL_CLEAR;
  const averageAlpha = a / weight;
  const inv = averageAlpha / 255;
  if (inv <= 0) return PIXEL_CLEAR;
  return {
    r: clampByte((r / weight) / inv),
    g: clampByte((g / weight) / inv),
    b: clampByte((b / weight) / inv),
    a: clampByte(averageAlpha),
  };
}

/**
 * Draws the source into a new square buffer.
 * Aspect is kept, the image is never enlarged, and unused cells stay transparent.
 */
export function blitContain(src: Uint8ClampedArray, srcW: number, srcH: number, dstSize: number): Uint8ClampedArray {
  const out = createPixels(dstSize);
  const fit = containFit(srcW, srcH, dstSize);
  if (fit.dw < 1 || fit.dh < 1) return out;
  for (let y = 0; y < fit.dh; y += 1) {
    const sy0 = (y * srcH) / fit.dh;
    const sy1 = ((y + 1) * srcH) / fit.dh;
    for (let x = 0; x < fit.dw; x += 1) {
      const color = averageRect(src, srcW, srcH, (x * srcW) / fit.dw, sy0, ((x + 1) * srcW) / fit.dw, sy1);
      writePixel(out, dstSize, fit.ox + x, fit.oy + y, color);
    }
  }
  return out;
}

/** Integer display scale. The stored grid stays `size`×`size`. */
export function fitPixelZoom(space: number, size: number): number {
  if (space < 1 || size < 1) return PIXEL_ZOOM_MIN;
  return Math.max(PIXEL_ZOOM_MIN, Math.min(PIXEL_ZOOM_MAX, Math.floor(space / size)));
}

/** Integer display scale that fits a dot image's height. The stored pixels stay as they are. */
export function fitPixelHeight(stageHeight: number, contentHeight: number): number {
  if (stageHeight < 1 || contentHeight < 1) return PIXEL_ZOOM_MIN;
  return Math.max(PIXEL_ZOOM_MIN, Math.min(PIXEL_ZOOM_MAX, Math.floor(stageHeight / contentHeight)));
}

/** Clipboard and PNG export use this buffer only. No grid, no chrome. */
export function exportFrame(data: Uint8ClampedArray, size: PixelSpan): { width: number; height: number; rgba: Uint8ClampedArray } {
  const { width, height } = gridOf(size);
  return { width, height, rgba: data };
}

/** Folder export scales. 1 keeps the canvas size. */
export const PIXEL_EXPORT_SCALES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const;
export type PixelExportScale = (typeof PIXEL_EXPORT_SCALES)[number];

export function isPixelExportScale(value: number): value is PixelExportScale {
  return (PIXEL_EXPORT_SCALES as readonly number[]).includes(value);
}

/**
 * Integer nearest-neighbor scale. Each source cell becomes a scale×scale block.
 * RGB and alpha are copied as stored, including fully clear cells.
 * The source buffer is not changed.
 */
export function scalePixelsNearest(data: Uint8ClampedArray, width: number, height: number, scale: number): Uint8ClampedArray {
  const factor = scale;
  if (!Number.isInteger(factor) || factor < 1 || width < 1 || height < 1 || data.length < width * height * 4) return new Uint8ClampedArray(0);
  const outW = width * factor;
  const outH = height * factor;
  if (outW > 8192 || outH > 8192) return new Uint8ClampedArray(0);
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = (y * width + x) * 4;
      const r = data[from] ?? 0;
      const g = data[from + 1] ?? 0;
      const b = data[from + 2] ?? 0;
      const a = data[from + 3] ?? 0;
      const x0 = x * factor;
      const y0 = y * factor;
      for (let dy = 0; dy < factor; dy += 1) {
        const row = ((y0 + dy) * outW + x0) * 4;
        for (let dx = 0; dx < factor; dx += 1) {
          const at = row + dx * 4;
          out[at] = r;
          out[at + 1] = g;
          out[at + 2] = b;
          out[at + 3] = a;
        }
      }
    }
  }
  return out;
}

/** `character.png` at 2× → `character_2x.png`, then `character_2x_2.png` when that name is taken. */
export function pixelExportFileName(name: string, scale: number, taken: readonly string[]): string {
  const trimmed = name.trim() || "pixel";
  const dot = trimmed.lastIndexOf(".");
  const stem = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const mark = `${Math.max(1, Math.round(scale))}x`;
  const used = new Set(taken);
  const first = `${stem}_${mark}.png`;
  if (!used.has(first)) return first;
  for (let index = 2; index < 10000; index += 1) {
    const next = `${stem}_${mark}_${index}.png`;
    if (!used.has(next)) return next;
  }
  return `${stem}_${mark}_${used.size + 2}.png`;
}

function pngCrc(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index] ?? 0;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  view.setUint32(8 + data.length, pngCrc(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * RGBA PNG with filter-none scanlines. Clear cells keep the RGB that was stored.
 * Canvas export is not used, so a transparent pixel is not turned into black.
 */
export async function encodeRgbaPng(data: Uint8ClampedArray, width: number, height: number): Promise<Uint8Array | null> {
  if (width < 1 || height < 1 || data.length < width * height * 4) return null;
  if (typeof CompressionStream === "undefined") return null;
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const at = y * (stride + 1);
    raw[at] = 0;
    raw.set(data.subarray(y * stride, y * stride + stride), at + 1);
  }
  const stream = new CompressionStream("deflate");
  const compressed = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(stream)).arrayBuffer());
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", compressed), pngChunk("IEND", new Uint8Array())];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

/** One pixel layer. Index 0 in a stack is the front. The buffer is never shared with another layer. */
export type PixelLayerBuffer = {
  id: string;
  name: string;
  visible: boolean;
  pixels: Uint8ClampedArray;
};

/** `レイヤー1`, then the next free number. Names that are not that pattern are ignored. */
export function nextPixelLayerName(names: readonly string[]): string {
  let max = 0;
  for (const name of names) {
    const match = /^レイヤー(\d+)$/.exec(name.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `レイヤー${max + 1}`;
}

/**
 * Porter-Duff source-over. A fully clear source pixel leaves the destination alone.
 * An opaque source replaces it. Partial alpha blends and does not hide the destination's RGB outside that alpha.
 */
export function blendPixelOver(dst: Uint8ClampedArray, src: Uint8ClampedArray): void {
  const cells = Math.min(Math.floor(dst.length / 4), Math.floor(src.length / 4));
  for (let index = 0; index < cells; index += 1) {
    const at = index * 4;
    const sa = src[at + 3] ?? 0;
    if (sa <= 0) continue;
    const da = dst[at + 3] ?? 0;
    if (sa >= 255 || da <= 0) {
      dst[at] = src[at] ?? 0;
      dst[at + 1] = src[at + 1] ?? 0;
      dst[at + 2] = src[at + 2] ?? 0;
      dst[at + 3] = sa;
      continue;
    }
    const s = sa / 255;
    const d = da / 255;
    const outA = s + d * (1 - s);
    const keep = d * (1 - s);
    dst[at] = Math.round(((src[at] ?? 0) * s + (dst[at] ?? 0) * keep) / outA);
    dst[at + 1] = Math.round(((src[at + 1] ?? 0) * s + (dst[at + 1] ?? 0) * keep) / outA);
    dst[at + 2] = Math.round(((src[at + 2] ?? 0) * s + (dst[at + 2] ?? 0) * keep) / outA);
    dst[at + 3] = Math.round(outA * 255);
  }
}

/**
 * Flatten a front-to-back stack. Hidden layers are skipped and their buffers are not changed.
 * `active` replaces that pixel layer's buffer for the preview of an in-progress edit.
 * Image layers are reference planes. They are skipped when `guides` is false, so a finished picture stays free of them.
 * Opacity scales the layer for this picture only. The stored pixels are not rewritten.
 */
export function compositePixelLayers(
  layers: readonly {
    id?: string;
    visible: boolean;
    pixels: Uint8ClampedArray;
    opacity?: number;
    kind?: PixelLayerKind;
    x?: number;
    y?: number;
    imgW?: number;
    imgH?: number;
  }[],
  width: number,
  height: number,
  active?: { id: string; pixels: Uint8ClampedArray } | null,
  options?: { guides?: boolean },
): Uint8ClampedArray {
  const canvasW = Math.max(0, width);
  const canvasH = Math.max(0, height);
  const out = createPixels(canvasW, canvasH);
  const need = canvasW * canvasH * 4;
  const guides = options?.guides !== false;
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    if (!layer?.visible) continue;
    const image = layer.kind === "image";
    if (image && !guides) continue;
    let src: Uint8ClampedArray;
    if (image) {
      const planeW = layer.imgW ?? 0;
      const planeH = layer.imgH ?? 0;
      if (planeW < 1 || planeH < 1 || layer.pixels.length < planeW * planeH * 4) continue;
      src = projectImagePlane({ x: layer.x ?? 0, y: layer.y ?? 0, width: planeW, height: planeH, pixels: layer.pixels }, canvasW, canvasH);
    } else {
      src = active && layer.id != null && layer.id === active.id ? active.pixels : layer.pixels;
      if (src.length < need) continue;
    }
    blendPixelOverOpacity(out, src, layer.opacity ?? 100);
  }
  return out;
}

/**
 * Merge the upper layer onto the lower one, then the caller deletes the upper layer.
 * A hidden layer does not contribute, so the result matches the two-layer picture.
 * When both are hidden, both buffers are still blended and the result stays hidden, so the pixels are not thrown away.
 */
export function mergeVisiblePair(
  upper: Uint8ClampedArray,
  upperVisible: boolean,
  lower: Uint8ClampedArray,
  lowerVisible: boolean,
): { pixels: Uint8ClampedArray; visible: boolean } {
  if (!upperVisible && !lowerVisible) {
    const pixels = new Uint8ClampedArray(lower);
    blendPixelOver(pixels, upper);
    return { pixels, visible: false };
  }
  const pixels = new Uint8ClampedArray(lower.length);
  if (lowerVisible) pixels.set(lower);
  if (upperVisible) blendPixelOver(pixels, upper);
  return { pixels, visible: true };
}

/** Copy the upper buffer onto the lower one. Visibility is ignored and neither input buffer is changed. */
export function stampLayerPixels(lower: Uint8ClampedArray, upper: Uint8ClampedArray): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(lower);
  blendPixelOver(pixels, upper);
  return pixels;
}

/** The tight box around every opaque pixel in any buffer. A stack of clear layers has no trim. */
export function unionOpaqueBounds(buffers: readonly Uint8ClampedArray[], span: PixelSpan): TrimBounds | null {
  const { width, height } = gridOf(span);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (const data of buffers) {
    const box = opaquePixelBounds(data, span);
    if (!box) continue;
    if (box.x < minX) minX = box.x;
    if (box.y < minY) minY = box.y;
    if (box.x + box.w - 1 > maxX) maxX = box.x + box.w - 1;
    if (box.y + box.h - 1 > maxY) maxY = box.y + box.h - 1;
  }
  if (maxX < 0 || maxY < 0) return null;
  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    left: minX,
    right: width - maxX - 1,
    top: minY,
    bottom: height - maxY - 1,
  };
}

/**
 * Move a layer to a gap in the front-to-back list.
 * `gap` is the index before removal: 0 is above the first row, `length` is below the last.
 * The same order returns null. Buffers are not copied or merged.
 */
export function moveLayerIndex<T>(layers: readonly T[], from: number, gap: number): T[] | null {
  if (from < 0 || from >= layers.length) return null;
  if (gap < 0 || gap > layers.length) return null;
  if (gap === from || gap === from + 1) return null;
  const next = layers.slice();
  const [item] = next.splice(from, 1);
  if (item === undefined) return null;
  const dest = from < gap ? gap - 1 : gap;
  next.splice(dest, 0, item);
  return next;
}

/** Pixel art, or a reference image that is never part of a finished export. */
export type PixelLayerKind = "pixel" | "image";

/** Display opacity. 100 is unchanged. The value is a percent, not a pixel alpha. */
export function clampLayerOpacity(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function isImageLayer(layer: { kind?: string } | null | undefined): boolean {
  return layer?.kind === "image";
}

/**
 * Source-over with a layer opacity. The source buffer is not changed.
 * 100 uses the same blend as a layer with no opacity of its own. 0 leaves the destination.
 */
export function blendPixelOverOpacity(dst: Uint8ClampedArray, src: Uint8ClampedArray, opacity: number): void {
  const pct = clampLayerOpacity(opacity);
  if (pct <= 0) return;
  if (pct >= 100) {
    blendPixelOver(dst, src);
    return;
  }
  const scale = pct / 100;
  const cells = Math.min(Math.floor(dst.length / 4), Math.floor(src.length / 4));
  for (let index = 0; index < cells; index += 1) {
    const at = index * 4;
    const sa0 = src[at + 3] ?? 0;
    if (sa0 <= 0) continue;
    const sa = Math.round(sa0 * scale);
    if (sa <= 0) continue;
    const da = dst[at + 3] ?? 0;
    if (sa >= 255 || da <= 0) {
      dst[at] = src[at] ?? 0;
      dst[at + 1] = src[at + 1] ?? 0;
      dst[at + 2] = src[at + 2] ?? 0;
      dst[at + 3] = sa;
      continue;
    }
    const s = sa / 255;
    const d = da / 255;
    const outA = s + d * (1 - s);
    const keep = d * (1 - s);
    dst[at] = Math.round(((src[at] ?? 0) * s + (dst[at] ?? 0) * keep) / outA);
    dst[at + 1] = Math.round(((src[at + 1] ?? 0) * s + (dst[at + 1] ?? 0) * keep) / outA);
    dst[at + 2] = Math.round(((src[at + 2] ?? 0) * s + (dst[at + 2] ?? 0) * keep) / outA);
    dst[at + 3] = Math.round(outA * 255);
  }
}

/** A reference image in its own pixel grid. `x` and `y` are the canvas cell of the buffer's top-left. */
export type ImagePlane = {
  x: number;
  y: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

/** The part of a reference image that sits on the canvas. Cells outside the plane stay clear. The plane is not changed. */
export function projectImagePlane(plane: ImagePlane, canvasW: number, canvasH: number): Uint8ClampedArray {
  const out = createPixels(Math.max(0, canvasW), Math.max(0, canvasH));
  if (plane.width < 1 || plane.height < 1 || canvasW < 1 || canvasH < 1) return out;
  if (plane.pixels.length < plane.width * plane.height * 4) return out;
  const x0 = Math.max(0, plane.x);
  const y0 = Math.max(0, plane.y);
  const x1 = Math.min(canvasW, plane.x + plane.width);
  const y1 = Math.min(canvasH, plane.y + plane.height);
  for (let y = y0; y < y1; y += 1) {
    const sy = y - plane.y;
    for (let x = x0; x < x1; x += 1) {
      const sx = x - plane.x;
      const from = (sy * plane.width + sx) * 4;
      const to = (y * canvasW + x) * 4;
      out[to] = plane.pixels[from] ?? 0;
      out[to + 1] = plane.pixels[from + 1] ?? 0;
      out[to + 2] = plane.pixels[from + 2] ?? 0;
      out[to + 3] = plane.pixels[from + 3] ?? 0;
    }
  }
  return out;
}

function coverImagePlane(plane: ImagePlane, minX: number, minY: number, maxX: number, maxY: number): ImagePlane {
  const x = Math.min(plane.x, minX);
  const y = Math.min(plane.y, minY);
  const right = Math.max(plane.x + plane.width - 1, maxX);
  const bottom = Math.max(plane.y + plane.height - 1, maxY);
  const width = right - x + 1;
  const height = bottom - y + 1;
  if (width > 8192 || height > 8192) return plane;
  if (x === plane.x && y === plane.y && width === plane.width && height === plane.height) return plane;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < plane.height; row += 1) {
    const src = row * plane.width * 4;
    const dest = ((row + (plane.y - y)) * width + (plane.x - x)) * 4;
    pixels.set(plane.pixels.subarray(src, src + plane.width * 4), dest);
  }
  return { x, y, width, height, pixels };
}

/** Square guide brush. Size 1 paints the cell. Larger sizes stay centered on it and clipped to the canvas and selection. */
export const GUIDE_PEN_SIZES = [1, 2, 3, 4, 6, 8] as const;
export type GuidePenSize = (typeof GUIDE_PEN_SIZES)[number];

export function isGuidePenSize(value: number): value is GuidePenSize {
  return (GUIDE_PEN_SIZES as readonly number[]).includes(value);
}

export function stampGuideBrush(
  plane: ImagePlane,
  canvasX: number,
  canvasY: number,
  color: PixelColor,
  size: number,
  canvasW: number,
  canvasH: number,
  selection: PixelSelection | null = null,
): ImagePlane {
  const brush = Math.max(1, Math.min(16, Math.round(size) || 1));
  const originX = canvasX - Math.floor((brush - 1) / 2);
  const originY = canvasY - Math.floor((brush - 1) / 2);
  const cells: { x: number; y: number }[] = [];
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (let dy = 0; dy < brush; dy += 1) {
    for (let dx = 0; dx < brush; dx += 1) {
      const x = originX + dx;
      const y = originY + dy;
      if (x < 0 || y < 0 || x >= canvasW || y >= canvasH) continue;
      if (selection && !selectionHas(selection, x, y, { width: canvasW, height: canvasH })) continue;
      if (cells.length === 0) {
        minX = x;
        minY = y;
        maxX = x;
        maxY = y;
      } else {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      cells.push({ x, y });
    }
  }
  if (cells.length === 0) return plane;
  const next = coverImagePlane(plane, minX, minY, maxX, maxY);
  if (next.width < 1 || next.height < 1) return plane;
  for (const cell of cells) {
    const lx = cell.x - next.x;
    const ly = cell.y - next.y;
    if (lx < 0 || ly < 0 || lx >= next.width || ly >= next.height) continue;
    const at = (ly * next.width + lx) * 4;
    next.pixels[at] = color.r;
    next.pixels[at + 1] = color.g;
    next.pixels[at + 2] = color.b;
    next.pixels[at + 3] = color.a;
  }
  return next;
}

/** Write canvas cells that changed. Pixels outside the canvas stay where they are. */
export function commitCanvasDiff(plane: ImagePlane, before: Uint8ClampedArray, after: Uint8ClampedArray, canvasW: number, canvasH: number): ImagePlane {
  if (canvasW < 1 || canvasH < 1 || before.length < canvasW * canvasH * 4 || after.length < canvasW * canvasH * 4) return plane;
  const changes: { x: number; y: number }[] = [];
  let minX = plane.x;
  let minY = plane.y;
  let maxX = plane.x + plane.width - 1;
  let maxY = plane.y + plane.height - 1;
  for (let y = 0; y < canvasH; y += 1) {
    for (let x = 0; x < canvasW; x += 1) {
      const at = (y * canvasW + x) * 4;
      if (before[at] === after[at] && before[at + 1] === after[at + 1] && before[at + 2] === after[at + 2] && before[at + 3] === after[at + 3]) continue;
      changes.push({ x, y });
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (changes.length === 0) return plane;
  const next = coverImagePlane(plane, minX, minY, maxX, maxY);
  for (const cell of changes) {
    const lx = cell.x - next.x;
    const ly = cell.y - next.y;
    if (lx < 0 || ly < 0 || lx >= next.width || ly >= next.height) continue;
    const from = (cell.y * canvasW + cell.x) * 4;
    const to = (ly * next.width + lx) * 4;
    next.pixels[to] = after[from] ?? 0;
    next.pixels[to + 1] = after[from + 1] ?? 0;
    next.pixels[to + 2] = after[from + 2] ?? 0;
    next.pixels[to + 3] = after[from + 3] ?? 0;
  }
  return next;
}

export function selectionCoversCanvas(selection: PixelSelection | null, width: number, height: number): boolean {
  if (!selection || width < 1 || height < 1) return false;
  if (selection.kind === "rect") {
    const rect = selection.rect;
    return rect.x <= 0 && rect.y <= 0 && rect.x + rect.w >= width && rect.y + rect.h >= height;
  }
  if (selection.mask.length < width * height) return false;
  for (let index = 0; index < width * height; index += 1) {
    if (selection.mask[index] !== 1) return false;
  }
  return true;
}

/**
 * Move a canvas selection inside a reference image.
 * A selection of the whole canvas slides the plane, including the part that is off the canvas.
 * A smaller selection lifts only those canvas cells. The rest of the plane stays put.
 */
export function moveImageSelection(
  plane: ImagePlane,
  selection: PixelSelection,
  dx: number,
  dy: number,
  canvasW: number,
  canvasH: number,
): { plane: ImagePlane; selection: PixelSelection | null } {
  if (dx === 0 && dy === 0) return { plane, selection };
  if (selectionCoversCanvas(selection, canvasW, canvasH)) {
    return { plane: { ...plane, x: plane.x + dx, y: plane.y + dy }, selection };
  }
  const before = projectImagePlane(plane, canvasW, canvasH);
  const after = new Uint8ClampedArray(before);
  const next = moveSelectionPixels(after, { width: canvasW, height: canvasH }, selection, dx, dy, "rgba");
  return { plane: commitCanvasDiff(plane, before, after, canvasW, canvasH), selection: next };
}

/**
 * The pixel layer's whole picture. `rest` holds pixels that sit outside the canvas.
 * A null rest means the canvas buffer is the entire layer. The inputs are not changed.
 * Canvas pixels replace the overlapping part of rest, so a later edit is kept.
 */
export function pixelLayerPlane(canvas: Uint8ClampedArray, canvasW: number, canvasH: number, rest: ImagePlane | null): ImagePlane {
  const width = Math.max(0, Math.round(canvasW));
  const height = Math.max(0, Math.round(canvasH));
  if (width < 1 || height < 1 || canvas.length < width * height * 4) {
    return { x: 0, y: 0, width, height, pixels: createPixels(width, height) };
  }
  if (!rest || rest.width < 1 || rest.height < 1 || rest.pixels.length < rest.width * rest.height * 4) {
    return { x: 0, y: 0, width, height, pixels: new Uint8ClampedArray(canvas) };
  }
  const before = projectImagePlane(rest, width, height);
  return commitCanvasDiff(
    { x: rest.x, y: rest.y, width: rest.width, height: rest.height, pixels: new Uint8ClampedArray(rest.pixels) },
    before,
    canvas,
    width,
    height,
  );
}

function planeFillsCanvas(plane: ImagePlane, canvasW: number, canvasH: number): boolean {
  return plane.x === 0 && plane.y === 0 && plane.width === canvasW && plane.height === canvasH && plane.pixels.length >= canvasW * canvasH * 4;
}

/**
 * Slide a content plane by whole pixels. Bytes are copied into place, never resampled.
 * The returned canvas is the part that lands on the grid. The rest is everything else, or null when nothing sticks out.
 */
export function shiftContentPlane(plane: ImagePlane, dx: number, dy: number, canvasW: number, canvasH: number): { pixels: Uint8ClampedArray; rest: ImagePlane | null } {
  const width = Math.max(0, Math.round(canvasW));
  const height = Math.max(0, Math.round(canvasH));
  const shifted: ImagePlane = {
    x: plane.x + Math.round(dx),
    y: plane.y + Math.round(dy),
    width: plane.width,
    height: plane.height,
    pixels: plane.pixels,
  };
  if (planeFillsCanvas(shifted, width, height)) return { pixels: new Uint8ClampedArray(shifted.pixels), rest: null };
  return { pixels: projectImagePlane(shifted, width, height), rest: shifted };
}

/** Move a pixel layer's stored picture when the canvas is resized or trimmed. `ox` and `oy` match the anchor shift used for image layers. */
export function rebasePixelRest(
  canvas: Uint8ClampedArray,
  oldW: number,
  oldH: number,
  rest: ImagePlane,
  newW: number,
  newH: number,
  ox: number,
  oy: number,
): { pixels: Uint8ClampedArray; rest: ImagePlane | null } {
  const plane = pixelLayerPlane(canvas, oldW, oldH, rest);
  return shiftContentPlane(plane, ox, oy, newW, newH);
}

function pngPaeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDelta = Math.abs(estimate - left);
  const upDelta = Math.abs(estimate - up);
  const upLeftDelta = Math.abs(estimate - upLeft);
  if (leftDelta <= upDelta && leftDelta <= upLeftDelta) return left;
  if (upDelta <= upLeftDelta) return up;
  return upLeft;
}

/** Decode an 8-bit RGBA PNG, including RGB stored in clear pixels. Other PNG kinds return null. */
export async function decodeRgbaPng(bytes: Uint8Array): Promise<{ width: number; height: number; rgba: Uint8ClampedArray } | null> {
  if (bytes.length < 8 || typeof DecompressionStream === "undefined") return null;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let color = 0;
  const parts: Uint8Array[] = [];
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    if (offset + 12 + length > bytes.length) return null;
    const type = String.fromCharCode(bytes[offset + 4] ?? 0, bytes[offset + 5] ?? 0, bytes[offset + 6] ?? 0, bytes[offset + 7] ?? 0);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR" && data.length >= 13) {
      const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = header.getUint32(0);
      height = header.getUint32(4);
      depth = data[8] ?? 0;
      color = data[9] ?? 0;
      if ((data[10] ?? 1) !== 0 || (data[11] ?? 1) !== 0 || (data[12] ?? 1) !== 0) return null;
    } else if (type === "IDAT") parts.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (depth !== 8 || color !== 6 || width < 1 || height < 1 || width > 8192 || height > 8192) return null;
  const idat = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    idat.set(part, cursor);
    cursor += part.length;
  }
  let raw: Uint8Array;
  try {
    const stream = new DecompressionStream("deflate");
    raw = new Uint8Array(await new Response(new Blob([idat]).stream().pipeThrough(stream)).arrayBuffer());
  } catch {
    return null;
  }
  const stride = width * 4;
  if (raw.length < (stride + 1) * height) return null;
  const rgba = new Uint8ClampedArray(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 255;
    const row = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const out = new Uint8Array(stride);
    if (filter === 0) out.set(row);
    else if (filter === 1) {
      for (let index = 0; index < stride; index += 1) out[index] = ((row[index] ?? 0) + (index >= 4 ? (out[index - 4] ?? 0) : 0)) & 255;
    } else if (filter === 2) {
      for (let index = 0; index < stride; index += 1) out[index] = ((row[index] ?? 0) + (prev[index] ?? 0)) & 255;
    } else if (filter === 3) {
      for (let index = 0; index < stride; index += 1) {
        const left = index >= 4 ? (out[index - 4] ?? 0) : 0;
        out[index] = ((row[index] ?? 0) + Math.floor((left + (prev[index] ?? 0)) / 2)) & 255;
      }
    } else if (filter === 4) {
      for (let index = 0; index < stride; index += 1) {
        const left = index >= 4 ? (out[index - 4] ?? 0) : 0;
        const up = prev[index] ?? 0;
        const upLeft = index >= 4 ? (prev[index - 4] ?? 0) : 0;
        out[index] = ((row[index] ?? 0) + pngPaeth(left, up, upLeft)) & 255;
      }
    } else return null;
    rgba.set(out, y * stride);
    prev = out;
  }
  return { width, height, rgba };
}
