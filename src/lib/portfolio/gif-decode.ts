/**
 * Pull composited GIF frames one at a time.
 * Disposal 2 clears to transparent, which is how a browser paints the file.
 * The original bytes are never written back.
 */

export class GifDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GifDecodeError";
  }
}

export type GifDecodedFrame = {
  width: number;
  height: number;
  delayMs: number;
  rgba: Uint8ClampedArray;
};

export type GifReader = {
  width: number;
  height: number;
  next: () => GifDecodedFrame | null;
};

type Rgb = [number, number, number];

const DELAY_FALLBACK_MS = 100;

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readPalette(bytes: Uint8Array, offset: number, count: number): Rgb[] {
  const colors: Rgb[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = offset + index * 3;
    colors.push([bytes[at] ?? 0, bytes[at + 1] ?? 0, bytes[at + 2] ?? 0]);
  }
  return colors;
}

function skipBlocks(bytes: Uint8Array, pos: number): number {
  while (pos < bytes.length) {
    const size = bytes[pos] ?? 0;
    pos += 1;
    if (size === 0) break;
    pos += size;
  }
  return pos;
}

function readBlocks(bytes: Uint8Array, pos: number): { data: Uint8Array; pos: number } {
  const parts: Uint8Array[] = [];
  let total = 0;
  while (pos < bytes.length) {
    const size = bytes[pos] ?? 0;
    pos += 1;
    if (size === 0) break;
    const end = Math.min(bytes.length, pos + size);
    parts.push(bytes.subarray(pos, end));
    total += end - pos;
    pos = end;
  }
  const data = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    data.set(part, at);
    at += part.length;
  }
  return { data, pos };
}

function bitReader(data: Uint8Array): { read: (size: number) => number } {
  let pos = 0;
  let acc = 0;
  let bits = 0;
  return {
    read(size: number) {
      while (bits < size) {
        if (pos >= data.length) return -1;
        acc |= (data[pos] ?? 0) << bits;
        bits += 8;
        pos += 1;
      }
      const value = acc & ((1 << size) - 1);
      acc >>>= size;
      bits -= size;
      return value;
    },
  };
}

function lzwDecode(minCodeSize: number, data: Uint8Array, pixelCount: number): Uint8Array {
  if (minCodeSize < 2 || minCodeSize > 11) throw new GifDecodeError("lzw");
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  const first = new Uint8Array(4096);
  prefix.fill(-1);
  for (let index = 0; index < clear; index += 1) {
    suffix[index] = index;
    first[index] = index;
  }
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let prev = -1;
  const out = new Uint8Array(pixelCount);
  const stack = new Uint8Array(pixelCount);
  let outLen = 0;
  const reader = bitReader(data);
  const write = (code: number) => {
    let count = 0;
    let cursor = code;
    while (cursor >= 0 && count < pixelCount) {
      stack[count] = suffix[cursor] ?? 0;
      count += 1;
      cursor = prefix[cursor] ?? -1;
    }
    for (let index = count - 1; index >= 0 && outLen < pixelCount; index -= 1) out[outLen++] = stack[index] ?? 0;
  };
  while (outLen < pixelCount) {
    const code = reader.read(codeSize);
    if (code < 0 || code === eoi) break;
    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = eoi + 1;
      prev = -1;
      continue;
    }
    if (prev < 0) {
      if (code >= clear) throw new GifDecodeError("lzw");
      write(code);
      prev = code;
      continue;
    }
    if (code === next) {
      if (next >= 4096) throw new GifDecodeError("lzw");
      prefix[next] = prev;
      first[next] = first[prev] ?? 0;
      suffix[next] = first[prev] ?? 0;
      write(next);
      prev = next;
      next += 1;
      if (next === 1 << codeSize && codeSize < 12) codeSize += 1;
      continue;
    }
    if (code > next || code >= 4096) throw new GifDecodeError("lzw");
    write(code);
    if (next < 4096) {
      prefix[next] = prev;
      first[next] = first[prev] ?? 0;
      suffix[next] = first[code] ?? 0;
      next += 1;
      if (next === 1 << codeSize && codeSize < 12) codeSize += 1;
    }
    prev = code;
  }
  return out;
}

function deinterlace(indices: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(indices.length);
  const starts = [0, 4, 2, 1];
  const steps = [8, 8, 4, 2];
  let src = 0;
  for (let pass = 0; pass < 4; pass += 1) {
    const start = starts[pass] ?? 0;
    const step = steps[pass] ?? 1;
    for (let y = start; y < height; y += step) {
      const row = indices.subarray(src, src + width);
      out.set(row, y * width);
      src += width;
    }
  }
  return out;
}

function clearRect(screen: Uint8ClampedArray, width: number, height: number, left: number, top: number, frameWidth: number, frameHeight: number): void {
  const x0 = Math.max(0, left);
  const y0 = Math.max(0, top);
  const x1 = Math.min(width, left + frameWidth);
  const y1 = Math.min(height, top + frameHeight);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const at = (y * width + x) * 4;
      screen[at] = 0;
      screen[at + 1] = 0;
      screen[at + 2] = 0;
      screen[at + 3] = 0;
    }
  }
}

function blit(
  screen: Uint8ClampedArray,
  width: number,
  height: number,
  indices: Uint8Array,
  frameWidth: number,
  frameHeight: number,
  left: number,
  top: number,
  palette: readonly Rgb[],
  transparent: number,
): void {
  for (let y = 0; y < frameHeight; y += 1) {
    const dy = top + y;
    if (dy < 0 || dy >= height) continue;
    for (let x = 0; x < frameWidth; x += 1) {
      const dx = left + x;
      if (dx < 0 || dx >= width) continue;
      const index = indices[y * frameWidth + x] ?? 0;
      if (transparent >= 0 && index === transparent) continue;
      const color = palette[index] ?? [0, 0, 0];
      const at = (dy * width + dx) * 4;
      screen[at] = color[0];
      screen[at + 1] = color[1];
      screen[at + 2] = color[2];
      screen[at + 3] = 255;
    }
  }
}

/** One reader walks the file in play order. `next` returns null after the last frame. */
export function openGifReader(bytes: Uint8Array): GifReader {
  if (bytes.length < 13 || bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) throw new GifDecodeError("header");
  const width = u16(bytes, 6);
  const height = u16(bytes, 8);
  if (width < 1 || height < 1) throw new GifDecodeError("screen");
  const packed = bytes[10] ?? 0;
  let pos = 13;
  let global: Rgb[] | null = null;
  if (packed & 0x80) {
    const count = 1 << ((packed & 7) + 1);
    global = readPalette(bytes, pos, count);
    pos += count * 3;
  }
  const screen = new Uint8ClampedArray(width * height * 4);
  let saved: Uint8ClampedArray | null = null;
  let prevDisposal = 1;
  let prevRect = { left: 0, top: 0, width: 0, height: 0 };
  let delayCs = 10;
  let disposal = 1;
  let transparent = -1;
  let control = false;

  const next = (): GifDecodedFrame | null => {
    while (pos < bytes.length) {
      const marker = bytes[pos] ?? 0;
      if (marker === 0x3b) return null;
      if (marker === 0x21) {
        const kind = bytes[pos + 1] ?? 0;
        pos += 2;
        if (kind === 0xf9) {
          const size = bytes[pos] ?? 0;
          const block = bytes.subarray(pos + 1, pos + 1 + size);
          const flags = block[0] ?? 0;
          delayCs = (block[1] ?? 0) | ((block[2] ?? 0) << 8);
          disposal = (flags >> 2) & 7;
          transparent = flags & 1 ? (block[3] ?? 0) : -1;
          control = true;
          pos = skipBlocks(bytes, pos);
          continue;
        }
        pos = skipBlocks(bytes, pos);
        continue;
      }
      if (marker !== 0x2c) {
        pos += 1;
        continue;
      }
      const left = u16(bytes, pos + 1);
      const top = u16(bytes, pos + 3);
      const frameWidth = u16(bytes, pos + 5);
      const frameHeight = u16(bytes, pos + 7);
      const imagePacked = bytes[pos + 9] ?? 0;
      pos += 10;
      let palette = global;
      if (imagePacked & 0x80) {
        const count = 1 << ((imagePacked & 7) + 1);
        palette = readPalette(bytes, pos, count);
        pos += count * 3;
      }
      if (!palette) palette = [];
      const minCodeSize = bytes[pos] ?? 0;
      pos += 1;
      const blocks = readBlocks(bytes, pos);
      pos = blocks.pos;
      if (frameWidth < 1 || frameHeight < 1) {
        control = false;
        continue;
      }
      if (prevDisposal === 3 && saved) screen.set(saved);
      else if (prevDisposal === 2) clearRect(screen, width, height, prevRect.left, prevRect.top, prevRect.width, prevRect.height);
      const useDisposal = disposal === 0 ? 1 : disposal;
      saved = useDisposal === 3 ? screen.slice() : saved;
      let indices = lzwDecode(minCodeSize, blocks.data, frameWidth * frameHeight);
      if (imagePacked & 0x40) indices = deinterlace(indices, frameWidth, frameHeight);
      blit(screen, width, height, indices, frameWidth, frameHeight, left, top, palette, control ? transparent : -1);
      const rgba = screen.slice();
      prevDisposal = useDisposal;
      prevRect = { left, top, width: frameWidth, height: frameHeight };
      const delayMs = delayCs === 0 ? DELAY_FALLBACK_MS : delayCs * 10;
      control = false;
      delayCs = 10;
      disposal = 1;
      transparent = -1;
      return { width, height, delayMs, rgba };
    }
    return null;
  };

  return { width, height, next };
}
