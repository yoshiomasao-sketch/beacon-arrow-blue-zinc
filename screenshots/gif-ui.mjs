import { chromium } from "playwright";
import { GIFEncoder } from "/workspace/node_modules/gifenc/dist/gifenc.esm.js";
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}
function png(width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    for (let x = 0; x < width; x += 1) {
      const at = row + 1 + x * 4;
      raw[at] = x < width / 2 ? 0 : 220;
      raw[at + 1] = 40;
      raw[at + 2] = 80;
      raw[at + 3] = x < 8 ? 0 : 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const gif = GIFEncoder();
const palette = [
  [120, 190, 240],
  [40, 150, 70],
  [210, 40, 50],
  [250, 220, 80],
  [20, 20, 30],
];
for (let frame = 0; frame < 8; frame += 1) {
  const index = new Uint8Array(120 * 80);
  for (let y = 0; y < 80; y += 1) {
    for (let x = 0; x < 120; x += 1) index[y * 120 + x] = y < 48 ? 0 : 1;
  }
  const cx = 20 + frame * 10;
  const cy = 36;
  for (let y = 0; y < 80; y += 1) {
    for (let x = 0; x < 120; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < 12 * 12) index[y * 120 + x] = 2;
    }
  }
  gif.writeFrame(index, 120, 80, { palette, delay: 10, dispose: 1, colorDepth: 3 });
}
gif.finish();
writeFileSync("/tmp/scene.gif", gif.bytes());
writeFileSync("/tmp/dot-src.png", png(160, 80));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const notes = [];
const check = (ok, message) => {
  notes.push({ ok, message });
  if (!ok) throw new Error(message);
};
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.setInputFiles("input[aria-label='画像を取り込む']", ["/tmp/scene.gif", "/tmp/dot-src.png"]);
await page.waitForSelector("button[aria-label$='を拡大']", { timeout: 15000 });
await page.locator("button[aria-label$='.gifを拡大']").first().click();
await page.getByRole("button", { name: "フレームを一覧化する" }).click();
await page.waitForSelector(".gif-frames-cell", { timeout: 15000 });
await page.waitForFunction(() => document.querySelectorAll(".gif-frames-cell").length >= 8);
await page.screenshot({ path: "/workspace/screenshots/gif-frames-clean.png" });
await page.locator(".gif-frames-cell").nth(3).click();
await page.waitForSelector(".gif-frames-zoom img");
await page.screenshot({ path: "/workspace/screenshots/gif-frame-zoom.png" });
const zoomLabel = (await page.locator(".gif-frames-zoom-index").textContent())?.trim();
check(zoomLabel === "4 / 8", `zoom ${zoomLabel}`);
let copied = "skip";
try {
  await page.getByRole("button", { name: "コピー" }).click();
  await page.waitForTimeout(800);
  copied = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const types = items.map((item) => item.types);
    let size = 0;
    let mime = "";
    for (const item of items) {
      if (item.types.includes("image/png")) {
        const blob = await item.getType("image/png");
        mime = blob.type;
        size = blob.size;
      }
    }
    return { types, mime, size };
  });
} catch (error) {
  copied = String(error).slice(0, 180);
}
console.log("copied", JSON.stringify(copied));
await page.locator(".gif-frames").getByRole("button", { name: "閉じる" }).click({ force: true });
await page.waitForSelector(".gif-frames", { state: "detached", timeout: 5000 });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await page.locator("button[aria-label$='.pngを拡大']").first().click();
await page.locator("button[aria-label='機能を表示']").click({ clickCount: 3 });
await page.waitForTimeout(200);
await page.getByRole("button", { name: "アニメーションと音声をお気に入り登録" }).click();
await page.getByRole("button", { name: "登録する" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "アニメーションと音声のお気に入りを確認" }).click();
await page.waitForSelector("text=ドットバイドットで出力");
const before = await page.locator(".gif-dot-out").evaluate((node) => ({
  on: node.classList.contains("is-on"),
  checked: node.querySelector("input")?.checked ?? null,
}));
await page.screenshot({ path: "/workspace/screenshots/gif-dot-off.png" });
await page.locator(".gif-dot-out input").click();
const after = await page.locator(".gif-dot-out").evaluate((node) => ({
  on: node.classList.contains("is-on"),
  checked: node.querySelector("input")?.checked ?? null,
}));
await page.screenshot({ path: "/workspace/screenshots/gif-dot-on.png" });
const counts = await page.locator(".gif-frame-count button").allTextContents();
console.log(JSON.stringify({ notes, zoomLabel, copied, before, after, counts }, null, 2));
await browser.close();
