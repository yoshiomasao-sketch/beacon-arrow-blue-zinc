/**
 * Confirmation GIF for a sprite. Colors are nearest-match only, so dots are not dithered.
 * Delays and order come from playbackFrames, the same steps the preview draws.
 * A whole-number scale copies each source pixel into a square. It does not blend colors.
 */

import { GIFEncoder, quantize } from "gifenc/dist/gifenc.esm.js";
import { cellSize, gifRepeatCount, playbackFrames, type SpriteDoc } from "./sprite-sheet.ts";

const ALPHA_CUT = 8;
/** One edge of a confirmation GIF. Larger than this is unreliable in the browser. */
const GIF_MAX_EDGE = 16384;
/** Pixels in one frame. Past this the write is likely to run out of memory. */
const GIF_MAX_PIXELS = 16_777_216;

export const SPRITE_GIF_SCALES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function clampGifScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(12, Math.max(1, Math.round(value)));
}

/** Output size for a whole-number scale, or null when that GIF would be too large to save. */
export function spriteGifOutputSize(width: number, height: number, scale: number): { width: number; height: number; scale: number } | null {
  const factor = clampGifScale(scale);
  const safeW = Math.max(1, Math.round(width) || 1);
  const safeH = Math.max(1, Math.round(height) || 1);
  const outW = safeW * factor;
  const outH = safeH * factor;
  if (outW > GIF_MAX_EDGE || outH > GIF_MAX_EDGE || outW * outH > GIF_MAX_PIXELS) return null;
  return { width: outW, height: outH, scale: factor };
}

function indexNearest(source: Uint8ClampedArray, width: number, height: number): { index: Uint8Array; palette: number[][]; transparent: boolean } {
  const count = width * height;
  let opaque = 0;
  for (let i = 0; i < count; i += 1) if ((source[i * 4 + 3] ?? 0) >= ALPHA_CUT) opaque += 1;
  const transparent = opaque < count;
  const packed = new Uint8Array(Math.max(4, opaque * 4));
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const offset = i * 4;
    if ((source[offset + 3] ?? 0) < ALPHA_CUT) continue;
    packed[cursor] = source[offset] ?? 0;
    packed[cursor + 1] = source[offset + 1] ?? 0;
    packed[cursor + 2] = source[offset + 2] ?? 0;
    packed[cursor + 3] = 255;
    cursor += 4;
  }
  const found = opaque > 0 ? quantize(new Uint8Array(packed.subarray(0, cursor)), transparent ? 255 : 256, { format: "rgb565" }) : [[0, 0, 0]];
  const palette: number[][] = transparent ? [[0, 0, 0], ...found] : found;
  const index = new Uint8Array(count);
  const first = transparent ? 1 : 0;
  const nearest = (r: number, g: number, b: number) => {
    let best = first;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let colorIndex = first; colorIndex < palette.length; colorIndex += 1) {
      const color = palette[colorIndex] ?? [0, 0, 0];
      const dr = r - (color[0] ?? 0);
      const dg = g - (color[1] ?? 0);
      const db = b - (color[2] ?? 0);
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = colorIndex;
      }
    }
    return best;
  };
  for (let i = 0; i < count; i += 1) {
    const offset = i * 4;
    if ((source[offset + 3] ?? 0) < ALPHA_CUT) {
      index[i] = 0;
      continue;
    }
    index[i] = nearest(source[offset] ?? 0, source[offset + 1] ?? 0, source[offset + 2] ?? 0);
  }
  return { index, palette, transparent };
}

/** Each source pixel becomes a scale×scale block of the same index. No new colors. */
function scaleIndexNearest(index: Uint8Array, width: number, height: number, scale: number): Uint8Array {
  if (scale === 1) return index;
  const outW = width * scale;
  const out = new Uint8Array(outW * height * scale);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let dy = 0; dy < scale; dy += 1) {
      const destRow = (y * scale + dy) * outW;
      for (let x = 0; x < width; x += 1) {
        const value = index[row + x] ?? 0;
        const start = destRow + x * scale;
        out.fill(value, start, start + scale);
      }
    }
  }
  return out;
}

export function encodeSpriteGif(doc: SpriteDoc, scale = 1): Uint8Array | null {
  if (doc.frames.length === 0) return null;
  const factor = clampGifScale(scale);
  const cell = cellSize(doc.frames);
  const sized = spriteGifOutputSize(cell.width, cell.height, factor);
  if (!sized) return null;
  const played = playbackFrames(doc);
  if (played.steps.length === 0) return null;
  const gif = GIFEncoder();
  const repeat = gifRepeatCount(doc.loop, doc.loopCount);
  played.steps.forEach((step, stepIndex) => {
    const indexed = indexNearest(step.rgba, played.width, played.height);
    const pixels = factor === 1 ? indexed.index : scaleIndexNearest(indexed.index, played.width, played.height, factor);
    gif.writeFrame(pixels, sized.width, sized.height, {
      palette: indexed.palette,
      delay: step.ms,
      repeat: stepIndex === 0 ? repeat : 0,
      transparent: indexed.transparent,
      transparentIndex: 0,
      dispose: 2,
    });
  });
  gif.finish();
  return gif.bytes();
}
