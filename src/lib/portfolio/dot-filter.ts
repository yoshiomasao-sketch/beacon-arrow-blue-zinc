/**
 * Display-only pixel mosaic. The source bitmap is averaged into a fixed grid
 * and painted back with hard edges. Nothing here writes the stored file.
 */

export const DOT_MIN = 16;
export const DOT_MAX = 256;
export const DOT_STEP = 16;
export const DOT_DEFAULT = 256;

export const DOT_COLOR_MIN = 16;
export const DOT_COLOR_MAX = 512;
export const DOT_COLOR_STEP = 8;
export const DOT_COLOR_DEFAULT = 512;

export type Rgb = { r: number; g: number; b: number };

export type DotField = {
  cols: number;
  rows: number;
  rgba: Uint8ClampedArray;
};

/** Horizontal cell count. Saved values stay when they already sit on 16, 32, … 256. */
export function snapDotCols(value: number): number {
  if (!Number.isFinite(value)) return DOT_DEFAULT;
  const snapped = Math.round(value / DOT_STEP) * DOT_STEP;
  return Math.max(DOT_MIN, Math.min(DOT_MAX, snapped));
}

export const DOT_COLOR_LOWS = [2, 4, 8, 12] as const;

/** 2, 4, 8, 12, then 16 through 56 in steps of 8, then 64, 128, 256 and 512. */
export function dotColorStops(): number[] {
  const stops: number[] = [...DOT_COLOR_LOWS];
  for (let value = DOT_COLOR_MIN; value < 64; value += DOT_COLOR_STEP) stops.push(value);
  stops.push(64, 128, 256, 512);
  return stops;
}

export function dotColorIndex(value: number): number {
  const stops = dotColorStops();
  const snapped = snapDotColors(value);
  const index = stops.indexOf(snapped);
  return index < 0 ? stops.length - 1 : index;
}

/** Opaque color cap. Below 64 the stops stay 8 apart. 64 and above are 64, 128, 256, 512. */
export function snapDotColors(value: number): number {
  if (!Number.isFinite(value)) return DOT_COLOR_DEFAULT;
  if (value >= 64) {
    const highs = [64, 128, 256, 512];
    let best = 64;
    let bestDistance = Math.abs(value - 64);
    for (const step of highs) {
      const distance = Math.abs(value - step);
      if (distance < bestDistance || (distance === bestDistance && step > best)) {
        best = step;
        bestDistance = distance;
      }
    }
    return best;
  }
  if (value < DOT_COLOR_MIN) {
    let best: number = DOT_COLOR_MIN;
    let bestDistance = Math.abs(value - DOT_COLOR_MIN);
    for (const step of DOT_COLOR_LOWS) {
      const distance = Math.abs(value - step);
      if (distance < bestDistance || (distance === bestDistance && step > best)) {
        best = step;
        bestDistance = distance;
      }
    }
    return best;
  }
  const snapped = Math.round(value / DOT_COLOR_STEP) * DOT_COLOR_STEP;
  if (snapped >= 64) return 64;
  return Math.max(DOT_COLOR_MIN, snapped);
}

/** Which filters to paint. The master switch hides both without clearing the saved checks. */
export type DotSettings = {
  show?: boolean;
  on?: boolean;
  cols?: number;
  colors?: number;
  colorOn?: boolean;
};

/** Saved checks and the master switch. Missing checks start on. A missing switch stays off unless a saved check was already on. */
export function dotView(dot: DotSettings | null | undefined): {
  show: boolean;
  mosaic: boolean;
  colorOn: boolean;
  cols: number;
  colors: number;
} {
  if (!dot) {
    return { show: false, mosaic: true, colorOn: true, cols: DOT_DEFAULT, colors: DOT_COLOR_DEFAULT };
  }
  const mosaic = typeof dot.on === "boolean" ? dot.on : true;
  const colorOn = typeof dot.colorOn === "boolean" ? dot.colorOn : true;
  const show = typeof dot.show === "boolean" ? dot.show : dot.on === true || dot.colorOn === true;
  return {
    show,
    mosaic,
    colorOn,
    cols: snapDotCols(typeof dot.cols === "number" ? dot.cols : DOT_DEFAULT),
    colors: snapDotColors(typeof dot.colors === "number" ? dot.colors : DOT_COLOR_DEFAULT),
  };
}

/** Which filters to paint. Null skips that filter. The master switch off skips both. */
export function activeDot(dot: DotSettings | null | undefined): {
  cols: number | null;
  colors: number | null;
} {
  const view = dotView(dot);
  if (!view.show) return { cols: null, colors: null };
  return {
    cols: view.mosaic ? view.cols : null,
    colors: view.colorOn ? view.colors : null,
  };
}

/**
 * Columns come from the user. Rows follow the picture's aspect so a cell is as
 * square as the pixel grid allows. The picture's own aspect is not changed.
 * A tiny bitmap cannot hold more cells than it has pixels.
 */
export function dotGrid(width: number, height: number, cols: number): { cols: number; rows: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const usedCols = Math.max(1, Math.min(snapDotCols(cols), w));
  const cell = w / usedCols;
  const rows = Math.max(1, Math.min(h, Math.round(h / cell)));
  return { cols: usedCols, rows };
}

/** Inclusive start, exclusive end. Depends only on the index, the count, and the size. */
export function cellSpan(index: number, count: number, size: number): [number, number] {
  const start = Math.floor((index * size) / count);
  const end = Math.floor(((index + 1) * size) / count);
  return [start, Math.max(start, end)];
}

/**
 * Mean color of each cell. RGB is weighted by alpha so a clear pixel's stored
 * color does not tint the neighbors. The cell stays clear when nothing in it is visible.
 */
export function averageCells(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number, cols: number): DotField {
  const grid = dotGrid(width, height, cols);
  const rgba = new Uint8ClampedArray(grid.cols * grid.rows * 4);
  for (let row = 0; row < grid.rows; row += 1) {
    const [y0, y1] = cellSpan(row, grid.rows, height);
    for (let col = 0; col < grid.cols; col += 1) {
      const [x0, x1] = cellSpan(col, grid.cols, width);
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const at = (y * width + x) * 4;
          const cover = pixels[at + 3] ?? 0;
          red += (pixels[at] ?? 0) * cover;
          green += (pixels[at + 1] ?? 0) * cover;
          blue += (pixels[at + 2] ?? 0) * cover;
          alpha += cover;
          count += 1;
        }
      }
      const slot = (row * grid.cols + col) * 4;
      if (count < 1 || alpha <= 0) continue;
      rgba[slot] = Math.round(red / alpha);
      rgba[slot + 1] = Math.round(green / alpha);
      rgba[slot + 2] = Math.round(blue / alpha);
      rgba[slot + 3] = Math.round(alpha / count);
    }
  }
  return { cols: grid.cols, rows: grid.rows, rgba };
}

type WeightedRgb = Rgb & { w: number };

function paletteLimit(value: number): number {
  if (!Number.isFinite(value)) return DOT_COLOR_MAX;
  return Math.max(1, Math.min(DOT_COLOR_MAX, Math.round(value)));
}

function channelOf(color: WeightedRgb, channel: 0 | 1 | 2): number {
  if (channel === 0) return color.r;
  if (channel === 1) return color.g;
  return color.b;
}

/** Median cut, then a near-black slot may become pure black when the cap is 8 or less. */
function cutPalette(samples: WeightedRgb[], limit: number): Rgb[] {
  return inkDarkSlot(medianCut(samples, limit), samples, limit);
}

const INK_COLOR_CAP = 8;

function colorLuma(color: Rgb): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function colorSpread(color: Rgb): number {
  return Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
}

/** True when the darkest slot is a small, dull, near-black tone rather than a vivid or dominant color. */
function nearBlackSlot(lumaValue: number, spread: number, share: number): boolean {
  if (lumaValue > 32 || spread > 40) return false;
  if (spread > 22 && lumaValue > 14) return false;
  if (share > 0.5 && (spread > 10 || lumaValue > 16)) return false;
  if (lumaValue <= 22 && spread <= 18) return true;
  return lumaValue <= 8 && spread <= 36;
}

function inkDarkSlot(palette: Rgb[], samples: WeightedRgb[], limit: number): Rgb[] {
  if (limit > INK_COLOR_CAP || palette.length === 0) return palette;
  if (palette.some((color) => color.r === 0 && color.g === 0 && color.b === 0)) return palette;
  let total = 0;
  for (const sample of samples) total += sample.w;
  if (total <= 0) return palette;
  let darkIndex = 0;
  let darkLuma = Number.POSITIVE_INFINITY;
  for (let index = 0; index < palette.length; index += 1) {
    const color = palette[index];
    if (!color) continue;
    const value = colorLuma(color);
    if (value < darkLuma) {
      darkLuma = value;
      darkIndex = index;
    }
  }
  const dark = palette[darkIndex];
  if (!dark) return palette;
  let darkWeight = 0;
  for (const sample of samples) {
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < palette.length; index += 1) {
      const color = palette[index];
      if (!color) continue;
      const distance = (color.r - sample.r) ** 2 + (color.g - sample.g) ** 2 + (color.b - sample.b) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    if (best === darkIndex) darkWeight += sample.w;
  }
  if (!nearBlackSlot(darkLuma, colorSpread(dark), darkWeight / total)) return palette;
  return palette.map((color, index) => (index === darkIndex ? { r: 0, g: 0, b: 0 } : { r: color.r, g: color.g, b: color.b }));
}
/** Median cut. One bucket's representative is the weighted mean, so equal colors stay equal. */
function medianCut(samples: WeightedRgb[], limit: number): Rgb[] {
  if (samples.length === 0) return [];
  if (samples.length <= limit) return samples.map(({ r, g, b }) => ({ r, g, b }));
  const boxes: WeightedRgb[][] = [samples];
  while (boxes.length < limit) {
    let best = -1;
    let bestSpan = 0;
    let bestChannel: 0 | 1 | 2 = 0;
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      if (!box || box.length < 2) continue;
      let r0 = 255;
      let r1 = 0;
      let g0 = 255;
      let g1 = 0;
      let b0 = 255;
      let b1 = 0;
      for (const color of box) {
        if (color.r < r0) r0 = color.r;
        if (color.r > r1) r1 = color.r;
        if (color.g < g0) g0 = color.g;
        if (color.g > g1) g1 = color.g;
        if (color.b < b0) b0 = color.b;
        if (color.b > b1) b1 = color.b;
      }
      const spans: [0 | 1 | 2, number][] = [
        [0, r1 - r0],
        [1, g1 - g0],
        [2, b1 - b0],
      ];
      spans.sort((left, right) => right[1] - left[1]);
      const chosen = spans[0];
      if (!chosen || chosen[1] <= bestSpan) continue;
      best = index;
      bestSpan = chosen[1];
      bestChannel = chosen[0];
    }
    if (best < 0 || bestSpan <= 0) break;
    const box = boxes[best];
    if (!box) break;
    const ordered = box.slice().sort((left, right) => channelOf(left, bestChannel) - channelOf(right, bestChannel));
    let total = 0;
    for (const color of ordered) total += color.w;
    let acc = 0;
    let cut = ordered.length - 1;
    for (let index = 0; index < ordered.length - 1; index += 1) {
      acc += ordered[index]?.w ?? 0;
      if (acc >= total / 2) {
        cut = index + 1;
        break;
      }
    }
    if (cut <= 0 || cut >= ordered.length) cut = Math.floor(ordered.length / 2);
    boxes.splice(best, 1, ordered.slice(0, cut), ordered.slice(cut));
  }
  return boxes.map((box) => {
    let red = 0;
    let green = 0;
    let blue = 0;
    let weight = 0;
    for (const color of box) {
      red += color.r * color.w;
      green += color.g * color.w;
      blue += color.b * color.w;
      weight += color.w;
    }
    if (weight <= 0) return { r: box[0]?.r ?? 0, g: box[0]?.g ?? 0, b: box[0]?.b ?? 0 };
    return { r: Math.round(red / weight), g: Math.round(green / weight), b: Math.round(blue / weight) };
  });
}

/** One palette for one or more frames. Clear cells are not colors. The result never exceeds `limit`. */
export function paletteFromCells(fields: readonly DotField[], limit: number): Rgb[] {
  const cap = paletteLimit(limit);
  const hist = new Map<number, WeightedRgb>();
  for (const field of fields) {
    const data = field.rgba;
    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3] ?? 0;
      if (alpha <= 0) continue;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const key = (r << 16) | (g << 8) | b;
      const found = hist.get(key);
      if (found) found.w += alpha;
      else hist.set(key, { r, g, b, w: alpha });
    }
  }
  return cutPalette([...hist.values()], cap);
}

/** Paint each opaque cell with the nearest palette color. Alpha is left as it was. */
export function mapCells(field: DotField, palette: readonly Rgb[]): void {
  if (palette.length === 0) return;
  const cache = new Map<number, number>();
  const nearest = (r: number, g: number, b: number) => {
    const key = (r << 16) | (g << 8) | b;
    const hit = cache.get(key);
    if (hit != null) return hit;
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let index = 0; index < palette.length; index += 1) {
      const color = palette[index];
      if (!color) continue;
      const distance = (color.r - r) * (color.r - r) + (color.g - g) * (color.g - g) + (color.b - b) * (color.b - b);
      if (distance < bestD) {
        bestD = distance;
        best = index;
        if (distance === 0) break;
      }
    }
    cache.set(key, best);
    return best;
  };
  const data = field.rgba;
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) <= 0) continue;
    const color = palette[nearest(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0)];
    if (!color) continue;
    data[index] = color.r;
    data[index + 1] = color.g;
    data[index + 2] = color.b;
  }
}

/** Reduce one frame to at most `limit` opaque colors. Cells that share a color stay together. */
export function limitCellColors(field: DotField, limit: number): void {
  mapCells(field, paletteFromCells([field], limit));
}

/** Fold opaque pixels into one histogram. Transparent pixels are not colors. */
export function absorbOpaque(pixels: Uint8ClampedArray, into: Map<number, Rgb & { w: number }>): void {
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] ?? 0;
    if (alpha <= 0) continue;
    const r = pixels[index] ?? 0;
    const g = pixels[index + 1] ?? 0;
    const b = pixels[index + 2] ?? 0;
    const key = (r << 16) | (g << 8) | b;
    const found = into.get(key);
    if (found) found.w += alpha;
    else into.set(key, { r, g, b, w: alpha });
  }
}

/** One palette from a histogram built across frames. The result never exceeds `limit`. */
export function paletteFromHistogram(hist: ReadonlyMap<number, Rgb & { w: number }>, limit: number): Rgb[] {
  return cutPalette([...hist.values()], paletteLimit(limit));
}

/** Quantize opaque pixels in place. Size and alpha stay. This is not a mosaic. */
export function quantizePixels(pixels: Uint8ClampedArray, width: number, height: number, colors: number): void {
  if (width < 1 || height < 1 || pixels.length < width * height * 4) return;
  limitCellColors({ cols: width, rows: height, rgba: pixels }, colors);
}

/** Paint opaque pixels with a palette that was already chosen. Alpha stays. */
export function mapPixelBuffer(pixels: Uint8ClampedArray, width: number, height: number, palette: readonly Rgb[]): void {
  if (width < 1 || height < 1 || palette.length === 0 || pixels.length < width * height * 4) return;
  mapCells({ cols: width, rows: height, rgba: pixels }, palette);
}

/** Paint one field into a rectangle. Edges stay on the same spans, with no smoothing. */
export function fillCells(
  ctx: CanvasRenderingContext2D,
  field: DotField,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  for (let row = 0; row < field.rows; row += 1) {
    const [y0, y1] = cellSpan(row, field.rows, height);
    if (y1 <= y0) continue;
    for (let col = 0; col < field.cols; col += 1) {
      const [x0, x1] = cellSpan(col, field.cols, width);
      if (x1 <= x0) continue;
      const slot = (row * field.cols + col) * 4;
      const alpha = field.rgba[slot + 3] ?? 0;
      if (alpha <= 0) continue;
      ctx.fillStyle = `rgba(${field.rgba[slot] ?? 0},${field.rgba[slot + 1] ?? 0},${field.rgba[slot + 2] ?? 0},${alpha / 255})`;
      ctx.fillRect(left + x0, top + y0, x1 - x0, y1 - y0);
    }
  }
}

/**
 * Paint the pixels already on this canvas.
 * `cols` null skips the mosaic. `colors` null skips reduction.
 * Both null leaves the canvas unchanged. Reduction alone does not enlarge cells.
 */
export function applyDotFilter(ctx: CanvasRenderingContext2D, cols: number | null, colors: number | null = null): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  if (width < 1 || height < 1) return;
  const reduce = colors != null;
  if (cols == null && !reduce) return;
  const image = ctx.getImageData(0, 0, width, height);
  if (cols != null) {
    const field = averageCells(image.data, width, height, cols);
    if (reduce) limitCellColors(field, snapDotColors(colors));
    ctx.clearRect(0, 0, width, height);
    fillCells(ctx, field, 0, 0, width, height);
    return;
  }
  quantizePixels(image.data, width, height, snapDotColors(colors as number));
  ctx.putImageData(image, 0, 0);
}
