import { chromium } from "playwright";
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
const width = 160;
const height = 80;
const raw = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y += 1) {
  const row = y * (width * 4 + 1);
  for (let x = 0; x < width; x += 1) {
    const at = row + 1 + x * 4;
    raw[at] = 220;
    raw[at + 1] = 40;
    raw[at + 2] = 80;
    raw[at + 3] = 255;
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
writeFileSync("/tmp/dot-src.png", Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForSelector("input[aria-label='画像を取り込む']", { timeout: 15000 });
await page.setInputFiles("input[aria-label='画像を取り込む']", ["/tmp/dot-src.png"]);
await page.waitForSelector("button[aria-label$='を拡大']", { timeout: 15000 });
await page.locator("button[aria-label$='.pngを拡大']").first().click();
await page.locator("button[aria-label='機能を表示']").click({ clickCount: 3 });
await page.getByRole("button", { name: "アニメーションと音声をお気に入り登録" }).click();
await page.getByRole("button", { name: "登録する" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "アニメーションと音声のお気に入りを確認" }).click();
await page.waitForSelector("text=ドットバイドットで出力");
const before = await page.locator(".gif-dot-out").evaluate((node) => ({
  on: node.classList.contains("is-on"),
  checked: node.querySelector("input")?.checked ?? null,
  text: node.textContent?.trim() ?? "",
}));
const counts = await page.locator(".gif-frame-count button").allTextContents();
await page.screenshot({ path: "/workspace/screenshots/gif-dot-off.png" });
await page.locator(".gif-dot-out input").click();
const after = await page.locator(".gif-dot-out").evaluate((node) => ({
  on: node.classList.contains("is-on"),
  checked: node.querySelector("input")?.checked ?? null,
}));
await page.locator(".gif-frame-count button", { hasText: "64" }).click();
const selected = await page.locator(".gif-frame-count button.is-on").textContent();
const still = await page.locator(".gif-dot-out input").isChecked();
await page.screenshot({ path: "/workspace/screenshots/gif-dot-on.png" });
console.log(JSON.stringify({ before, after, counts, selected, still }, null, 2));
await browser.close();
