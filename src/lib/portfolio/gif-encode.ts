/**
 * 256-color GIF frames. gifenc has no dither, so Floyd–Steinberg is applied here.
 * Semi-transparent pixels are expected to already be composited onto the photo.
 * Only the uncovered margin stays transparent.
 */

import { GIFEncoder, quantize } from "gifenc/dist/gifenc.esm.js";
import { GIF_COLORS, GIF_DELAY_MS } from "./gif-record.ts";

const ALPHA_CUT = 8;

export function indexGifFrame(
  source: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): { index: Uint8Array; palette: number[][]; transparent: boolean } {
  const count = width * height;
  const pixels = new Uint8Array(count * 4);
  pixels.set(source.subarray(0, count * 4));
  let opaque = 0;
  for (let i = 0; i < count; i += 1) if ((pixels[i * 4 + 3] ?? 0) >= ALPHA_CUT) opaque += 1;
  const transparent = opaque < count;
  const packed = new Uint8Array(Math.max(4, opaque * 4));
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const offset = i * 4;
    if ((pixels[offset + 3] ?? 0) < ALPHA_CUT) continue;
    packed[cursor] = pixels[offset] ?? 0;
    packed[cursor + 1] = pixels[offset + 1] ?? 0;
    packed[cursor + 2] = pixels[offset + 2] ?? 0;
    packed[cursor + 3] = 255;
    cursor += 4;
  }
  const found = opaque > 0 ? quantize(new Uint8Array(packed.subarray(0, cursor)), transparent ? GIF_COLORS - 1 : GIF_COLORS, { format: "rgb565" }) : [[0, 0, 0]];
  const palette: number[][] = transparent ? [[0, 0, 0], ...found] : found;
  const index = new Uint8Array(count);
  const cache = new Int32Array(65536);
  cache.fill(-1);
  const error = new Float32Array(count * 3);
  const first = transparent ? 1 : 0;
  const nearest = (r: number, g: number, b: number) => {
    const rr = Math.max(0, Math.min(255, Math.round(r)));
    const gg = Math.max(0, Math.min(255, Math.round(g)));
    const bb = Math.max(0, Math.min(255, Math.round(b)));
    const key = ((rr >> 3) << 11) | ((gg >> 2) << 5) | (bb >> 3);
    const cached = cache[key] ?? -1;
    if (cached >= 0) return cached;
    let best = first;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let colorIndex = first; colorIndex < palette.length; colorIndex += 1) {
      const color = palette[colorIndex] ?? [0, 0, 0];
      const dr = rr - (color[0] ?? 0);
      const dg = gg - (color[1] ?? 0);
      const db = bb - (color[2] ?? 0);
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = colorIndex;
      }
    }
    cache[key] = best;
    return best;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const offset = pixel * 4;
      if ((pixels[offset + 3] ?? 0) < ALPHA_CUT) {
        index[pixel] = 0;
        continue;
      }
      const slot = pixel * 3;
      const red = (pixels[offset] ?? 0) + (error[slot] ?? 0);
      const green = (pixels[offset + 1] ?? 0) + (error[slot + 1] ?? 0);
      const blue = (pixels[offset + 2] ?? 0) + (error[slot + 2] ?? 0);
      const chosen = nearest(red, green, blue);
      index[pixel] = chosen;
      const color = palette[chosen] ?? [0, 0, 0];
      const errR = red - (color[0] ?? 0);
      const errG = green - (color[1] ?? 0);
      const errB = blue - (color[2] ?? 0);
      const spill = (dx: number, dy: number, weight: number) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
        const next = ny * width + nx;
        if ((pixels[next * 4 + 3] ?? 0) < ALPHA_CUT) return;
        const at = next * 3;
        error[at] = (error[at] ?? 0) + errR * weight;
        error[at + 1] = (error[at + 1] ?? 0) + errG * weight;
        error[at + 2] = (error[at + 2] ?? 0) + errB * weight;
      };
      spill(1, 0, 7 / 16);
      spill(-1, 1, 3 / 16);
      spill(0, 1, 5 / 16);
      spill(1, 1, 1 / 16);
    }
  }
  return { index, palette, transparent };
}

export function beginGif(delayMs = GIF_DELAY_MS): {
  frame: (rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, frameDelay?: number) => void;
  finish: () => Uint8Array;
} {
  const gif = GIFEncoder();
  return {
    frame(rgba, width, height, frameDelay = delayMs) {
      const indexed = indexGifFrame(rgba, width, height);
      gif.writeFrame(indexed.index, width, height, {
        palette: indexed.palette,
        delay: frameDelay,
        repeat: 0,
        transparent: indexed.transparent,
        transparentIndex: 0,
      });
    },
    finish() {
      gif.finish();
      return gif.bytes();
    },
  };
}

export function encodeGif(frames: { rgba: Uint8Array | Uint8ClampedArray; width: number; height: number }[], delayMs = GIF_DELAY_MS): Uint8Array {
  const gif = beginGif(delayMs);
  for (const frame of frames) gif.frame(frame.rgba, frame.width, frame.height);
  return gif.finish();
}
