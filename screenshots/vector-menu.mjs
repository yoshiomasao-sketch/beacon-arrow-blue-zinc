import { chromium } from "playwright";
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
      raw[at] = 80;
      raw[at + 1] = 140;
      raw[at + 2] = 210;
      raw[at + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.setInputFiles("input[aria-label='画像を取り込む']", {
    name: "vector-src.png",
    mimeType: "image/png",
    buffer: png(320, 240),
  });
  await page.waitForSelector("button[aria-label$='を拡大']", { timeout: 15000 });
  await page.locator("button[aria-label$='を拡大']").first().click();
  await page.locator("button[aria-label='機能を表示']").click({ clickCount: 3 });
  await page.locator("button[aria-label='ベクトルマーカー設置']").click();
  await page.waitForSelector(".vector-kind-row");
  const names = await page.locator(".vector-kind-name").allTextContents();
  const lines = await page.locator(".vector-kind-line").evaluateAll((rows) =>
    rows.map((row) => [...row.querySelectorAll(".vector-kind-name")].map((node) => node.textContent)),
  );
  const push = page.getByRole("button", { name: "プッシュ 普通" });
  await push.click({ force: true });
  const pressed = await push.getAttribute("aria-pressed");
  const paces = await page.locator("[aria-label='プッシュ'] button").allTextContents();
  await page.screenshot({ path: "/workspace/screenshots/vector-push-menu.png" });
  const box = await page.locator(".vector-kind-row").boundingBox();
  console.log(JSON.stringify({ names, lines, pressed, paces, box }, null, 2));
} finally {
  await browser.close();
}
