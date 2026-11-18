import { chromium } from "playwright";
import { GIFEncoder } from "/workspace/node_modules/gifenc/dist/gifenc.esm.js";
import { writeFileSync } from "node:fs";

function noisyGif() {
  const gif = GIFEncoder();
  const palette = [];
  for (let i = 0; i < 256; i += 1) palette.push([(i * 37) % 256, (i * 91) % 256, (i * 13) % 256]);
  const index = new Uint8Array(180 * 120);
  for (let i = 0; i < index.length; i += 1) index[i] = (i * 17 + (i % 180) * 3) % 256;
  gif.writeFrame(index, 180, 120, { palette, delay: 4, dispose: 1 });
  const index2 = new Uint8Array(40 * 20);
  for (let i = 0; i < index2.length; i += 1) index2[i] = (i * 5) % 256;
  gif.writeFrame(index2, 40, 20, { palette, delay: 4, dispose: 2, left: 10, top: 6 });
  gif.finish();
  return Buffer.from(gif.bytes());
}

function pngFile() {
  const gif = GIFEncoder();
  return null;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
const bytes = noisyGif();
const decoded = await page.evaluate(async (b64) => {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const { openGifReader } = await import("/src/lib/portfolio/gif-decode.ts");
  const decoder = new ImageDecoder({ data: raw, type: "image/gif" });
  await decoder.tracks.ready;
  const count = decoder.tracks.selectedTrack?.frameCount ?? 0;
  const reader = openGifReader(raw);
  const frames = [];
  for (let i = 0; i < count; i += 1) {
    const { image } = await decoder.decode({ frameIndex: i });
    const canvas = document.createElement("canvas");
    canvas.width = image.displayWidth;
    canvas.height = image.displayHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const shown = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const ours = reader.next();
    let bad = 0;
    let first = null;
    if (ours) {
      for (let p = 0; p < shown.length; p += 4) {
        const drift = Math.abs(shown[p] - ours.rgba[p]) + Math.abs(shown[p + 1] - ours.rgba[p + 1]) + Math.abs(shown[p + 2] - ours.rgba[p + 2]) + Math.abs(shown[p + 3] - ours.rgba[p + 3]);
        if (drift > 8) {
          bad += 1;
          if (!first) first = { p: p / 4, browser: [shown[p], shown[p + 1], shown[p + 2], shown[p + 3]], ours: [ours.rgba[p], ours.rgba[p + 1], ours.rgba[p + 2], ours.rgba[p + 3]] };
        }
      }
    }
    frames.push({ i, bad, pixels: canvas.width * canvas.height, w: canvas.width, h: canvas.height, ours: ours ? [ours.width, ours.height] : null, first });
    image.close();
  }
  decoder.close();
  return frames;
}, bytes.toString("base64"));

const exported = await page.evaluate(async () => {
  const { renderFavoriteGif } = await import("/src/lib/portfolio/gif-export.ts");
  const { openGifReader } = await import("/src/lib/portfolio/gif-decode.ts");
  const canvas = document.createElement("canvas");
  canvas.width = 80;
  canvas.height = 40;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 80, 40);
  ctx.fillStyle = "#e02020";
  ctx.fillRect(40, 0, 40, 40);
  const bitmap = await createImageBitmap(canvas);
  const play = { kind: "swayX", speed: "normal", reverse: false, zoom: false, twist: false, zoomPace: "normal", twistPace: "normal", tilt: 0 };
  const common = {
    image: bitmap,
    natural: { width: 80, height: 40 },
    play,
    puru: [],
    vectors: [],
    effects: [],
    signal: new AbortController().signal,
    saveId: 0,
    frames: 32,
    onProgress() {},
  };
  const off = await renderFavoriteGif({ ...common, dotByDot: false });
  const on = await renderFavoriteGif({ ...common, dotByDot: true, dotByDotCols: 16, dotByDotColors: 16 });
  bitmap.close();
  const read = (raw) => {
    const reader = openGifReader(raw);
    const frames = [];
    for (;;) {
      const frame = reader.next();
      if (!frame) break;
      let clear = 0;
      let opaque = 0;
      const colors = new Set();
      for (let i = 0; i < frame.rgba.length; i += 4) {
        if ((frame.rgba[i + 3] ?? 0) < 8) clear += 1;
        else {
          opaque += 1;
          colors.add(`${frame.rgba[i]},${frame.rgba[i + 1]},${frame.rgba[i + 2]}`);
        }
      }
      frames.push({ w: reader.width, h: reader.height, fw: frame.width, fh: frame.height, delay: frame.delayMs, clear, opaque, colors: colors.size });
    }
    return { bytes: raw.byteLength, frames };
  };
  return { off: read(off), on: read(on) };
});

const drag = await page.evaluate(async () => {
  const png = await new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 8, 8);
    ctx.fillStyle = "#20c060";
    ctx.fillRect(0, 0, 4, 8);
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
  const file = new File([png], "GIF_Frame_001.png", { type: "image/png" });
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#fff";
  host.innerHTML = `
    <div id="src" draggable="true" style="position:absolute;left:40px;top:40px;width:160px;height:100px;background:#ccc">drag</div>
    <div id="drop" style="position:absolute;left:40px;top:420px;width:280px;height:160px;background:#def">drop</div>
    <iframe id="box" style="position:absolute;left:420px;top:420px;width:360px;height:200px;border:1px solid #000"></iframe>
  `;
  document.body.append(host);
  const frame = host.querySelector("#box");
  frame.srcdoc = `<!doctype html><body style="margin:0"><div id="drop" style="width:300px;height:160px;background:#fec">iframe</div>
  <script>
    const drop = document.getElementById("drop");
    const note = (event, name) => {
      event.preventDefault();
      if (name !== "drop") return;
      const file = event.dataTransfer.files[0];
      parent.postMessage({
        name,
        types: [...event.dataTransfer.types],
        file: file ? { name: file.name, type: file.type, size: file.size } : null,
        download: event.dataTransfer.getData("DownloadURL").slice(0, 80),
      }, "*");
    };
    drop.addEventListener("dragover", (event) => note(event, "over"));
    drop.addEventListener("drop", (event) => note(event, "drop"));
  </script></body>`;
  const src = host.querySelector("#src");
  window.__dragLog = [];
  src.addEventListener("dragstart", (event) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", file.name);
    event.dataTransfer.setData("DownloadURL", `image/png:${file.name}:${dataUrl}`);
    event.dataTransfer.items.add(file);
    window.__dragLog.push({
      event: "start",
      types: [...event.dataTransfer.types],
      files: [...event.dataTransfer.files].map((item) => ({ name: item.name, type: item.type, size: item.size })),
    });
  });
  let same = null;
  const drop = host.querySelector("#drop");
  drop.addEventListener("dragover", (event) => event.preventDefault());
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    const got = event.dataTransfer.files[0];
    same = {
      types: [...event.dataTransfer.types],
      file: got ? { name: got.name, type: got.type, size: got.size } : null,
      download: event.dataTransfer.getData("DownloadURL").slice(0, 60),
    };
    window.__dragLog.push({ event: "drop", ...same });
  });
  const iframeNotes = [];
  window.addEventListener("message", (event) => iframeNotes.push(event.data));
  const box = (node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x + 20, y: rect.y + 20, dx: rect.x + rect.width / 2, dy: rect.y + 40 };
  };
  return { ready: true, src: box(src), drop: box(drop), frame: box(frame), same, iframeNotes };
});

async function pull(from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 16 });
  await page.mouse.up();
}

await page.waitForTimeout(200);
await pull(drag.src, drag.drop);
await page.waitForTimeout(100);
const same = await page.evaluate(() => window.__sameDrop || null);
await page.evaluate(() => {
  const drop = document.querySelector("#drop");
  drop.addEventListener("drop", (event) => {
    const got = event.dataTransfer.files[0];
    window.__sameDrop = {
      types: [...event.dataTransfer.types],
      file: got ? { name: got.name, type: got.type, size: got.size } : null,
    };
  }, { once: true });
});
await pull(drag.src, drag.drop);
await page.waitForTimeout(150);
const sameAfter = await page.evaluate(() => window.__sameDrop || null);
await pull(drag.src, drag.frame);
await page.waitForTimeout(300);
const iframeHit = await page.evaluate(() => window.__iframeHit || null);
await page.exposeBinding("__noop", () => {});
await page.evaluate(() => {
  window.addEventListener("message", (event) => {
    window.__iframeHit = event.data;
  });
});
await pull(drag.src, drag.frame);
await page.waitForTimeout(400);
const iframeAfter = await page.evaluate(() => window.__iframeHit || null);

const report = {
  chrome: browser.version(),
  decoded,
  exported: {
    off: { bytes: exported.off.bytes, n: exported.off.frames.length, first: exported.off.frames[0], last: exported.off.frames.at(-1), delaySum: exported.off.frames.reduce((sum, frame) => sum + frame.delay, 0) },
    on: { bytes: exported.on.bytes, n: exported.on.frames.length, first: exported.on.frames[0], last: exported.on.frames.at(-1), delaySum: exported.on.frames.reduce((sum, frame) => sum + frame.delay, 0), sizes: [...new Set(exported.on.frames.map((frame) => `${frame.w}x${frame.h}`))] },
  },
  sameAfter,
  iframeAfter,
  log: await page.evaluate(() => window.__dragLog || null),
};
writeFileSync("/workspace/screenshots/gif-check.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
void pngFile;
