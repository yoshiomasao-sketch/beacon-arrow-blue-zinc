import { chromium } from "playwright";
import { GIFEncoder } from "/workspace/node_modules/gifenc/dist/gifenc.esm.js";

function noisyGif() {
  const gif = GIFEncoder();
  const palette = [];
  for (let i = 0; i < 256; i += 1) palette.push([(i * 37) % 256, (i * 91) % 256, (i * 13) % 256]);
  const index = new Uint8Array(180 * 120);
  for (let i = 0; i < index.length; i += 1) index[i] = (i * 17 + (i % 180) * 3) % 256;
  gif.writeFrame(index, 180, 120, { palette, delay: 4, dispose: 1 });
  const index2 = new Uint8Array(180 * 120);
  for (let i = 0; i < index2.length; i += 1) index2[i] = (index[i] + 15) % 256;
  gif.writeFrame(index2, 180, 120, { palette, delay: 4, dispose: 2 });
  gif.finish();
  return Buffer.from(gif.bytes());
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
const bytes = noisyGif();
const report = await page.evaluate(async (b64) => {
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
        const dr = Math.abs(shown[p] - ours.rgba[p]);
        const dg = Math.abs(shown[p + 1] - ours.rgba[p + 1]);
        const db = Math.abs(shown[p + 2] - ours.rgba[p + 2]);
        const da = Math.abs(shown[p + 3] - ours.rgba[p + 3]);
        if (dr + dg + db + da > 8) {
          bad += 1;
          if (!first) first = { p: p / 4, browser: [shown[p], shown[p + 1], shown[p + 2], shown[p + 3]], ours: [ours.rgba[p], ours.rgba[p + 1], ours.rgba[p + 2], ours.rgba[p + 3]] };
        }
      }
    }
    frames.push({ i, bad, pixels: canvas.width * canvas.height, first });
    image.close();
  }
  decoder.close();
  return frames;
}, bytes.toString("base64"));
console.log(JSON.stringify(report, null, 2));
await browser.close();
