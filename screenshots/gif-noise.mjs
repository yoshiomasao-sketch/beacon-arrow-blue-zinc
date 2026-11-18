import { chromium } from "playwright";
import { GIFEncoder } from "/workspace/node_modules/gifenc/dist/gifenc.esm.js";
import { writeFileSync } from "node:fs";

function solidGif() {
  const gif = GIFEncoder();
  const palette = [
    [0, 0, 0],
    [220, 30, 30],
    [30, 180, 60],
    [30, 60, 220],
    [240, 220, 40],
  ];
  const paint = (color) => {
    const index = new Uint8Array(48 * 32);
    for (let y = 0; y < 32; y += 1) index.fill(color, y * 48, y * 48 + 48);
    // a sharp horizontal edge in the middle of the row block
    for (let y = 10; y < 14; y += 1) index.fill(4, y * 48, y * 48 + 48);
    gif.writeFrame(index, 48, 32, { palette, delay: 8, dispose: 1 });
  };
  paint(1);
  paint(2);
  gif.finish();
  return gif.bytes();
}

function deltaGif() {
  const gif = GIFEncoder();
  const palette = [
    [0, 0, 0],
    [200, 20, 20],
    [20, 200, 40],
    [250, 250, 250],
  ];
  const full = new Uint8Array(40 * 24);
  for (let y = 0; y < 24; y += 1) full.fill(1, y * 40, y * 40 + 40);
  gif.writeFrame(full, 40, 24, { palette, delay: 8, dispose: 1 });
  const strip = new Uint8Array(40 * 4);
  strip.fill(2);
  gif.writeFrame(strip, 40, 4, { palette, delay: 8, dispose: 1, transparent: false });
  // gifenc writeFrame may not support top offset. We'll patch after if needed.
  gif.finish();
  return gif.bytes();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
const solid = Buffer.from(solidGif());
const delta = Buffer.from(deltaGif());
writeFileSync("/tmp/solid.gif", solid);
writeFileSync("/tmp/delta.gif", delta);

const report = await page.evaluate(async ({ solidB64, deltaB64 }) => {
  const toBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const { openGifReader } = await import("/src/lib/portfolio/gif-decode.ts");
  const rowsOf = (data, width, height) => {
    const rows = [];
    for (let y = 0; y < height; y += 1) {
      const at = (y * width) * 4;
      rows.push([data[at], data[at + 1], data[at + 2], data[at + 3]]);
    }
    return rows;
  };
  const browserFrames = async (bytes) => {
    const decoder = new ImageDecoder({ data: bytes, type: "image/gif" });
    await decoder.tracks.ready;
    const count = decoder.tracks.selectedTrack?.frameCount ?? 0;
    const frames = [];
    for (let i = 0; i < count; i += 1) {
      const { image } = await decoder.decode({ frameIndex: i });
      const canvas = document.createElement("canvas");
      canvas.width = image.displayWidth;
      canvas.height = image.displayHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      frames.push({ w: canvas.width, h: canvas.height, rows: rowsOf(data, canvas.width, canvas.height) });
      image.close();
    }
    decoder.close();
    return frames;
  };
  const ours = (bytes) => {
    const reader = openGifReader(bytes);
    const frames = [];
    for (;;) {
      const frame = reader.next();
      if (!frame) break;
      frames.push({ w: frame.width, h: frame.height, rows: rowsOf(frame.rgba, frame.width, frame.height) });
    }
    return frames;
  };
  const compare = async (name, bytes) => {
    const a = await browserFrames(bytes);
    const b = ours(bytes);
    let mismatch = 0;
    const samples = [];
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i += 1) {
      for (let y = 0; y < a[i].h; y += 1) {
        const left = a[i].rows[y];
        const right = b[i].rows[y];
        if (left.join() !== right.join()) {
          mismatch += 1;
          if (samples.length < 6) samples.push({ frame: i, y, browser: left, ours: right });
        }
      }
    }
    return { name, browser: a.length, ours: b.length, badRows: mismatch, samples };
  };

  const scale = () => {
    const make = (width, height) => {
      const source = document.createElement("canvas");
      source.width = width;
      source.height = height;
      const sctx = source.getContext("2d");
      const img = sctx.createImageData(width, height);
      for (let y = 0; y < height; y += 1) {
        const band = Math.floor(y / 8) % 2 === 0 ? 30 : 220;
        for (let x = 0; x < width; x += 1) {
          const at = (y * width + x) * 4;
          img.data[at] = band;
          img.data[at + 1] = 80;
          img.data[at + 2] = 140;
          img.data[at + 3] = y % 17 === 0 ? 0 : 255;
        }
      }
      sctx.putImageData(img, 0, 0);
      return source;
    };
    const score = (source, smooth) => {
      const dest = document.createElement("canvas");
      dest.width = 240;
      dest.height = Math.max(1, Math.round((240 * source.height) / source.width));
      const dctx = dest.getContext("2d");
      dctx.imageSmoothingEnabled = smooth;
      dctx.drawImage(source, 0, 0, dest.width, dest.height);
      const out = dctx.getImageData(0, 0, dest.width, dest.height).data;
      let spikes = 0;
      for (let y = 1; y < dest.height - 1; y += 1) {
        let left = 0;
        let mid = 0;
        let right = 0;
        for (let x = 0; x < dest.width; x += 1) {
          left += out[((y - 1) * dest.width + x) * 4];
          mid += out[(y * dest.width + x) * 4];
          right += out[((y + 1) * dest.width + x) * 4];
        }
        const expect = (left + right) / 2;
        if (Math.abs(mid - expect) > dest.width * 40) spikes += 1;
      }
      return { spikes, h: dest.height };
    };
    const big = make(960, 640);
    return { smooth: score(big, true), nearest: score(big, false) };
  };

  return {
    solid: await compare("solid", toBytes(solidB64)),
    delta: await compare("delta", toBytes(deltaB64)),
    scale: scale(),
  };
}, { solidB64: solid.toString("base64"), deltaB64: delta.toString("base64") });

console.log(JSON.stringify(report, null, 2));
await browser.close();
