import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GIFEncoder } from "gifenc/dist/gifenc.esm.js";
import { GifDecodeError, openGifReader } from "./gif-decode.ts";

function lzwEncode(indices: number[], minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  const dict = new Map<string, number>();
  const parts: number[] = [];
  const write = (code: number) => {
    parts.push(code, codeSize);
  };
  write(clear);
  let phrase: number[] = [];
  const key = (list: number[]) => list.join(",");
  for (const pixel of indices) {
    const nextPhrase = phrase.concat(pixel);
    const known = nextPhrase.length === 1 || dict.has(key(nextPhrase));
    if (known) {
      phrase = nextPhrase;
      continue;
    }
    write(phrase.length === 1 ? (phrase[0] ?? 0) : (dict.get(key(phrase)) ?? 0));
    dict.set(key(nextPhrase), next);
    next += 1;
    if (next > 1 << codeSize && codeSize < 12) codeSize += 1;
    phrase = [pixel];
  }
  if (phrase.length > 0) write(phrase.length === 1 ? (phrase[0] ?? 0) : (dict.get(key(phrase)) ?? 0));
  write(eoi);
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    acc |= (parts[index] ?? 0) << bits;
    bits += parts[index + 1] ?? 0;
    while (bits >= 8) {
      out.push(acc & 255);
      acc >>>= 8;
      bits -= 8;
    }
  }
  if (bits > 0) out.push(acc & 255);
  return Uint8Array.from(out);
}

function blocks(data: Uint8Array): number[] {
  const out: number[] = [];
  for (let index = 0; index < data.length; index += 255) {
    const slice = data.subarray(index, index + 255);
    out.push(slice.length, ...slice);
  }
  out.push(0);
  return out;
}

function gif(options: {
  width: number;
  height: number;
  colors: number[][];
  frames: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    indices: number[];
    delayCs?: number;
    disposal?: number;
    transparent?: number;
    interlace?: boolean;
  }[];
}): Uint8Array {
  const countBits = Math.max(0, Math.ceil(Math.log2(Math.max(2, options.colors.length))) - 1);
  const tableSize = 1 << (countBits + 1);
  const colors: number[] = [];
  for (let index = 0; index < tableSize; index += 1) {
    const color = options.colors[index] ?? [0, 0, 0];
    colors.push(color[0] ?? 0, color[1] ?? 0, color[2] ?? 0);
  }
  const bytes: number[] = [
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    options.width & 255, (options.width >> 8) & 255,
    options.height & 255, (options.height >> 8) & 255,
    0x80 | countBits,
    0,
    0,
    ...colors,
  ];
  const minCodeSize = Math.max(2, countBits + 1);
  for (const frame of options.frames) {
    const disposal = frame.disposal ?? 1;
    const transparent = frame.transparent ?? -1;
    bytes.push(
      0x21, 0xf9, 4,
      ((disposal & 7) << 2) | (transparent >= 0 ? 1 : 0),
      (frame.delayCs ?? 10) & 255,
      ((frame.delayCs ?? 10) >> 8) & 255,
      transparent >= 0 ? transparent : 0,
      0,
    );
    const width = frame.width ?? options.width;
    const height = frame.height ?? options.height;
    const left = frame.left ?? 0;
    const top = frame.top ?? 0;
    bytes.push(
      0x2c,
      left & 255, (left >> 8) & 255,
      top & 255, (top >> 8) & 255,
      width & 255, (width >> 8) & 255,
      height & 255, (height >> 8) & 255,
      frame.interlace ? 0x40 : 0,
      minCodeSize,
      ...blocks(lzwEncode(frame.indices, minCodeSize)),
    );
  }
  bytes.push(0x3b);
  return Uint8Array.from(bytes);
}

function pixel(frame: { rgba: Uint8ClampedArray }, index: number): number[] {
  const at = index * 4;
  return [frame.rgba[at] ?? 0, frame.rgba[at + 1] ?? 0, frame.rgba[at + 2] ?? 0, frame.rgba[at + 3] ?? 0];
}

describe("gif frames", () => {
  it("reads a one-pixel gif", () => {
    const bytes = Uint8Array.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      0x02, 0x02, 0x44, 0x01, 0x00,
      0x3b,
    ]);
    const reader = openGifReader(bytes);
    const frame = reader.next();
    assert.equal(reader.width, 1);
    assert.equal(frame?.width, 1);
    assert.equal(frame?.height, 1);
    assert.equal(frame?.delayMs, 100);
    assert.deepEqual(frame ? pixel(frame, 0) : [], [0, 0, 0, 255]);
    assert.equal(reader.next(), null);
  });

  it("round-trips a long index stream", () => {
    const indices = Array.from({ length: 180 }, (_, index) => index % 5);
    const file = gif({
      width: 18,
      height: 10,
      colors: [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255]],
      frames: [{ indices, delayCs: 5 }],
    });
    const frame = openGifReader(file).next();
    assert.equal(frame?.delayMs, 50);
    assert.deepEqual(frame ? pixel(frame, 0) : [], [255, 0, 0, 255]);
    assert.deepEqual(frame ? pixel(frame, 4) : [], [255, 0, 255, 255]);
    assert.deepEqual(frame ? pixel(frame, 5) : [], [255, 0, 0, 255]);
  });

  it("keeps earlier pixels when a later frame is transparent", () => {
    const file = gif({
      width: 2,
      height: 1,
      colors: [[255, 0, 0], [0, 0, 255]],
      frames: [
        { indices: [0, 0], delayCs: 8, disposal: 1 },
        { indices: [1, 1], delayCs: 8, disposal: 1, transparent: 1 },
      ],
    });
    const reader = openGifReader(file);
    const first = reader.next();
    const second = reader.next();
    assert.deepEqual(first ? pixel(first, 0) : [], [255, 0, 0, 255]);
    assert.deepEqual(second ? pixel(second, 0) : [], [255, 0, 0, 255]);
    assert.deepEqual(second ? pixel(second, 1) : [], [255, 0, 0, 255]);
    assert.equal(reader.next(), null);
  });

  it("clears the previous patch on disposal 2 and restores the earlier picture on disposal 3", () => {
    const cleared = gif({
      width: 2,
      height: 2,
      colors: [[255, 0, 0], [0, 0, 255]],
      frames: [
        { indices: [0, 0, 0, 0], disposal: 2, delayCs: 4 },
        { indices: [1], width: 1, height: 1, left: 0, top: 0, disposal: 1, delayCs: 4 },
      ],
    });
    const clearedReader = openGifReader(cleared);
    assert.deepEqual(pixel(clearedReader.next()!, 0), [255, 0, 0, 255]);
    const hole = clearedReader.next();
    assert.deepEqual(hole ? pixel(hole, 0) : [], [0, 0, 255, 255]);
    assert.deepEqual(hole ? pixel(hole, 1) : [], [0, 0, 0, 0]);

    const restored = gif({
      width: 2,
      height: 2,
      colors: [[255, 0, 0], [0, 0, 255], [0, 255, 0]],
      frames: [
        { indices: [0, 0, 0, 0], disposal: 1, delayCs: 4 },
        { indices: [1], width: 1, height: 1, left: 0, top: 0, disposal: 3, delayCs: 4 },
        { indices: [2], width: 1, height: 1, left: 1, top: 1, disposal: 1, delayCs: 0 },
      ],
    });
    const reader = openGifReader(restored);
    reader.next();
    const second = reader.next();
    const third = reader.next();
    assert.deepEqual(second ? pixel(second, 0) : [], [0, 0, 255, 255]);
    assert.deepEqual(second ? pixel(second, 1) : [], [255, 0, 0, 255]);
    assert.deepEqual(third ? pixel(third, 0) : [], [255, 0, 0, 255]);
    assert.deepEqual(third ? pixel(third, 3) : [], [0, 255, 0, 255]);
    assert.equal(third?.delayMs, 100);
  });

  it("puts interlaced rows back in display order", () => {
    const file = gif({
      width: 1,
      height: 8,
      colors: [[10, 0, 0], [20, 0, 0], [30, 0, 0], [40, 0, 0], [50, 0, 0], [60, 0, 0], [70, 0, 0], [80, 0, 0]],
      frames: [{ indices: [0, 1, 2, 3, 4, 5, 6, 7], interlace: true }],
    });
    const frame = openGifReader(file).next();
    const rows = Array.from({ length: 8 }, (_, index) => (frame ? pixel(frame, index)[0] : 0));
    assert.deepEqual(rows, [10, 50, 30, 60, 20, 70, 40, 80]);
  });

  it("rejects a file that is not a gif", () => {
    assert.throws(() => openGifReader(Uint8Array.from([1, 2, 3, 4])), GifDecodeError);
  });

  it("matches a gifenc file across a clear code and a transparent frame", () => {
    const gif = GIFEncoder();
    const width = 96;
    const height = 96;
    const palette = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
      [255, 0, 255],
      [0, 255, 255],
      [255, 128, 0],
      [0, 0, 0],
    ];
    const first = new Uint8Array(width * height);
    for (let index = 0; index < first.length; index += 1) first[index] = (index * 3) % 7;
    gif.writeFrame(first, width, height, { palette, delay: 40, dispose: 2, colorDepth: 3 } as never);
    const second = new Uint8Array(width * height);
    second[width + 2] = 2;
    gif.writeFrame(second, width, height, {
      palette,
      delay: 80,
      dispose: 1,
      transparent: true,
      transparentIndex: 0,
      colorDepth: 3,
    } as never);
    gif.finish();
    const reader = openGifReader(gif.bytes());
    const opening = reader.next();
    const cleared = reader.next();
    assert.equal(opening?.delayMs, 40);
    assert.equal(opening?.width, width);
    assert.deepEqual(opening ? pixel(opening, 0) : [], [255, 0, 0, 255]);
    assert.deepEqual(opening ? pixel(opening, 1) : [], [255, 255, 0, 255]);
    assert.deepEqual(opening ? pixel(opening, width * height - 1) : [], palette[(first[first.length - 1] ?? 0)]!.concat(255));
    assert.equal(cleared?.delayMs, 80);
    assert.deepEqual(cleared ? pixel(cleared, 0) : [], [0, 0, 0, 0]);
    assert.deepEqual(cleared ? pixel(cleared, width + 2) : [], [0, 0, 255, 255]);
    assert.equal(reader.next(), null);
  });

  it("matches every pixel of a high-entropy gifenc frame", () => {
    const gif = GIFEncoder();
    const width = 180;
    const height = 120;
    const palette: number[][] = [];
    for (let color = 0; color < 256; color += 1) palette.push([(color * 37) % 256, (color * 91) % 256, (color * 13) % 256]);
    const index = new Uint8Array(width * height);
    for (let pixelIndex = 0; pixelIndex < index.length; pixelIndex += 1) index[pixelIndex] = (pixelIndex * 17 + (pixelIndex % width) * 3) % 256;
    gif.writeFrame(index, width, height, { palette, delay: 4 });
    gif.finish();
    const frame = openGifReader(gif.bytes()).next();
    assert.ok(frame);
    let bad = 0;
    for (let pixelIndex = 0; pixelIndex < index.length; pixelIndex += 1) {
      const expect = palette[index[pixelIndex] ?? 0]?.[0];
      if (frame.rgba[pixelIndex * 4] !== expect) bad += 1;
    }
    assert.equal(bad, 0);
  });
});
