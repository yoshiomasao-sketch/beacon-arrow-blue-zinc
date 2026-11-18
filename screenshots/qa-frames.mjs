import { chromium } from "playwright";
import { GIFEncoder } from "gifenc/dist/gifenc.esm.js";
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
      raw[at] = 210;
      raw[at + 1] = 70;
      raw[at + 2] = 90;
      raw[at + 3] = 255;
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
  [220, 30, 30],
  [20, 160, 60],
  [30, 60, 210],
  [230, 190, 20],
  [0, 0, 0],
];
for (let frame = 0; frame < 36; frame += 1) {
  const index = new Uint8Array(16 * 16);
  index.fill(frame % 4);
  gif.writeFrame(index, 16, 16, { palette, delay: 8, dispose: 1, colorDepth: 3 });
}
gif.finish();
writeFileSync("/tmp/frames.gif", gif.bytes());
writeFileSync("/tmp/dot.png", png(48, 32));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const notes = [];
const fail = (message) => {
  notes.push({ ok: false, message });
  throw new Error(message);
};
const check = (ok, message) => {
  notes.push({ ok, message });
  if (!ok) throw new Error(message);
};
page.on("pageerror", (error) => notes.push({ ok: false, message: `pageerror ${error.message}` }));

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.setInputFiles("input[aria-label='画像を取り込む']", ["/tmp/frames.gif", "/tmp/dot.png"]);
  await page.waitForSelector("button[aria-label$='を拡大']", { timeout: 15000 });
  const cards = page.locator("button[aria-label$='を拡大']");
  check((await cards.count()) >= 2, "both files are in the library");

  await page.locator("button[aria-label$='.gifを拡大']").first().click();
  await page.getByRole("button", { name: "フレームを一覧化する" }).click();
  await page.waitForSelector(".gif-frames-cell", { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll(".gif-frames-cell").length >= 36, null, { timeout: 15000 });
  const cells = await page.locator(".gif-frames-cell").count();
  check(cells === 36, `frame grid has ${cells} cells`);

  await page.evaluate(() => {
    const grid = document.querySelector(".gif-frames-grid");
    grid.style.maxHeight = "150px";
    grid.scrollTop = 240;
  });
  const before = await page.evaluate(() => document.querySelector(".gif-frames-grid").scrollTop);
  check(before > 40, `grid scrolled to ${before}`);
  await page.locator(".gif-frames-cell").nth(8).click();
  await page.waitForSelector(".gif-frames-zoom img");
  const zoomLabel = (await page.locator(".gif-frames-zoom-index").textContent())?.trim();
  check(zoomLabel === "9 / 36", `zoom label ${zoomLabel}`);
  const src = await page.locator(".gif-frames-zoom img").getAttribute("src");
  check(Boolean(src && src.startsWith("blob:")), "zoom image is a still blob, not the gif");

  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelector(".gif-frames-zoom-index")?.textContent?.includes("8 / 36"));
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector(".gif-frames-zoom-index")?.textContent?.includes("9 / 36"));
  for (let i = 0; i < 12; i += 1) await page.keyboard.press("ArrowLeft");
  const atStart = (await page.locator(".gif-frames-zoom-index").textContent())?.trim();
  await page.keyboard.press("ArrowLeft");
  const stayed = (await page.locator(".gif-frames-zoom-index").textContent())?.trim();
  check(atStart === "1 / 36" && stayed === "1 / 36", `start bound ${atStart} -> ${stayed}`);
  const zooming = await page.locator(".gif-frames-zoom").count();
  check(zooming === 1, "arrow at the start stays in the enlarged frame");

  for (let i = 0; i < 40; i += 1) {
    const label = (await page.locator(".gif-frames-zoom-index").textContent())?.trim();
    if (label === "36 / 36") break;
    await page.getByRole("button", { name: "次のフレーム" }).click();
  }
  await page.keyboard.press("ArrowRight");
  const atEnd = (await page.locator(".gif-frames-zoom-index").textContent())?.trim();
  check(atEnd === "36 / 36", `end bound ${atEnd}`);
  await page.getByRole("button", { name: "前のフレーム" }).click();
  const stepped = (await page.locator(".gif-frames-zoom-index").textContent())?.trim();
  check(stepped === "35 / 36", `edge button ${stepped}`);

  const box = await page.locator("textarea, input").count();
  await page.evaluate(() => {
    const field = document.createElement("input");
    field.id = "type-probe";
    field.value = "abc";
    document.querySelector(".gif-frames-bar").append(field);
    field.focus();
  });
  await page.keyboard.press("ArrowLeft");
  const duringType = (await page.locator(".gif-frames-zoom-index").textContent())?.trim();
  check(duringType === "35 / 36", `typing target did not step (${duringType}), inputs ${box}`);
  await page.evaluate(() => document.getElementById("type-probe")?.remove());

  await page.evaluate(() => {
    const zoom = document.querySelector(".gif-frames-zoom");
    const zone = document.createElement("div");
    zone.id = "drop-probe";
    zone.style.cssText = "position:absolute;right:12px;bottom:12px;width:140px;height:90px;z-index:6;background:#204060";
    zoom.appendChild(zone);
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });
    zone.addEventListener("drop", async (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      const bytes = file ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
      window.__drop = {
        name: file?.name ?? "",
        type: file?.type ?? "",
        size: file?.size ?? 0,
        png: bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
        types: [...(event.dataTransfer?.types ?? [])],
      };
    });
  });
  await page.evaluate(() => {
    document.addEventListener(
      "dragstart",
      (event) => {
        const file = event.dataTransfer?.files?.[0];
        window.__drag = {
          name: file?.name ?? "",
          type: file?.type ?? "",
          size: file?.size ?? 0,
          types: [...(event.dataTransfer?.types ?? [])],
        };
      },
      true,
    );
    document.addEventListener("dragstart", (event) => {
      const file = event.dataTransfer?.files?.[0];
      window.__drag = {
        name: file?.name ?? "",
        type: file?.type ?? "",
        size: file?.size ?? 0,
        types: [...(event.dataTransfer?.types ?? [])],
      };
    });
  });
  const imageBox = await page.locator(".gif-frames-drag").boundingBox();
  const zoneBox = await page.locator("#drop-probe").boundingBox();
  if (imageBox && zoneBox) {
    await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(zoneBox.x + 30, zoneBox.y + 30, { steps: 18 });
    await page.mouse.up();
  }
  await page.waitForTimeout(300);
  let dropped = await page.evaluate(() => window.__drop ?? null);
  const nativeDrag = await page.evaluate(() => window.__drag ?? null);
  notes.push({ ok: Boolean(dropped?.png), message: `mouse drag ${JSON.stringify(dropped)} start ${JSON.stringify(nativeDrag)}` });
  if (!dropped) {
    dropped = await page.evaluate(() => {
      const img = document.querySelector(".gif-frames-drag");
      const data = new DataTransfer();
      img.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: data }));
      const file = data.files[0];
      const bytes = file ? null : null;
      return {
        name: file?.name ?? "",
        type: file?.type ?? "",
        size: file?.size ?? 0,
        types: [...data.types],
        synthetic: true,
        bytes,
      };
    });
    if (dropped?.size > 0) {
      const sig = await page.evaluate(async () => {
        const img = document.querySelector(".gif-frames-drag");
        const data = new DataTransfer();
        img.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: data }));
        const file = data.files[0];
        if (!file) return false;
        const bytes = new Uint8Array(await file.arrayBuffer());
        return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      });
      dropped.png = sig;
    }
  }
  notes.push({ ok: Boolean(dropped?.png && dropped.type === "image/png" && dropped.name === "GIF_Frame_035.png"), message: `drag ${JSON.stringify(dropped)}` });
  check(Boolean(dropped?.png && dropped.type === "image/png" && /GIF_Frame_035\.png$/.test(dropped.name)), `png drag payload ${JSON.stringify(dropped)}`);

  await page.getByRole("button", { name: "一覧へ戻る" }).click();
  await page.waitForFunction(() => !document.querySelector(".gif-frames-zoom"));
  const after = await page.evaluate(() => document.querySelector(".gif-frames-grid").scrollTop);
  check(Math.abs(after - before) <= 2, `scroll restored ${before} -> ${after}`);
  await page.screenshot({ path: "/workspace/screenshots/gif-frames-list.png" });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await page.locator("button[aria-label$='.pngを拡大']").first().click();
  await page.getByRole("button", { name: "ドット設定" }).click();
  await page.waitForSelector("input[aria-label='ドット数']");
  await page.evaluate(() => {
    const set = (label, value) => {
      const input = document.querySelector(`input[aria-label='${label}']`);
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      proto.set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const box = (label, on) => {
      const input = document.querySelector(`input[aria-label='${label}']`);
      if (input.checked !== on) input.click();
    };
    box("ドット化", true);
    box("減色", true);
    set("ドット数", "64");
    set("色数", "32");
  });
  const pcBefore = await page.evaluate(() => ({
    cols: document.querySelector("input[aria-label='ドット数']")?.value,
    colors: document.querySelector("input[aria-label='色数']")?.value,
    mosaic: document.querySelector("input[aria-label='ドット化']")?.checked,
    color: document.querySelector("input[aria-label='減色']")?.checked,
    show: document.querySelector("button[aria-label='ドット表示を解除'], button[aria-label='ドット表示']")?.getAttribute("aria-pressed"),
  }));
  check(pcBefore.cols === "64" && pcBefore.colors === "32" && pcBefore.mosaic === true && pcBefore.color === true, `pc settings ${JSON.stringify(pcBefore)}`);
  await page.locator("button[aria-label='ドット表示']").click();
  const showOn = await page.locator("button[aria-label='ドット表示を解除']").getAttribute("aria-pressed");
  check(showOn === "true", `pc master on ${showOn}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForSelector(".lightbox-content.is-phone");
  const phoneUi = await page.evaluate(() => ({
    ranges: [...document.querySelectorAll(".lightbox-content input[type='range']")].map((node) => node.getAttribute("aria-label")),
    checks: [...document.querySelectorAll(".lightbox-content input[type='checkbox']")].map((node) => node.getAttribute("aria-label")),
    panel: document.querySelector("button[aria-label='ドット設定']") !== null,
    pressed: document.querySelector(".phone-dock-row .lightbox-dot button")?.getAttribute("aria-pressed"),
    label: document.querySelector(".phone-dock-row .lightbox-dot button")?.getAttribute("aria-label"),
  }));
  check(phoneUi.ranges.length === 0 && phoneUi.checks.length === 0 && phoneUi.panel === false, `phone chrome ${JSON.stringify(phoneUi)}`);
  check(phoneUi.label === "ドット表示を解除" && phoneUi.pressed === "true", `phone show starts from the saved master ${JSON.stringify(phoneUi)}`);
  await page.locator(".phone-dock-row .lightbox-dot button").click();
  const phoneOff = await page.locator(".phone-dock-row .lightbox-dot button").getAttribute("aria-pressed");
  check(phoneOff === "false", `phone show off ${phoneOff}`);
  await page.screenshot({ path: "/workspace/screenshots/phone-dot.png" });
  await page.locator(".phone-dock-row .lightbox-dot button").click();
  const phoneOn = await page.locator(".phone-dock-row .lightbox-dot button").getAttribute("aria-pressed");
  check(phoneOn === "true", `phone show on ${phoneOn}`);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForSelector(".lightbox-content:not(.is-phone)");
  await page.getByRole("button", { name: "ドット設定" }).click();
  await page.waitForSelector("input[aria-label='ドット数']");
  const pcAfter = await page.evaluate(() => ({
    cols: document.querySelector("input[aria-label='ドット数']")?.value,
    colors: document.querySelector("input[aria-label='色数']")?.value,
    mosaic: document.querySelector("input[aria-label='ドット化']")?.checked,
    color: document.querySelector("input[aria-label='減色']")?.checked,
    sliders: document.querySelectorAll(".lightbox-dot-sliders").length,
  }));
  check(pcAfter.cols === "64" && pcAfter.colors === "32" && pcAfter.mosaic === true && pcAfter.color === true && pcAfter.sliders === 1, `pc kept ${JSON.stringify(pcAfter)}`);

  const opened = await page.evaluate(() => {
    const button = document.querySelector("button[aria-label='機能を表示']");
    if (!button) return false;
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 3 }));
    return true;
  });
  check(opened, "hidden tools button exists");
  await page.waitForTimeout(800);
  const gate = await page.locator(".media-gate").count();
  if (gate) {
    const proceed = page.getByRole("button", { name: "このまま使う" });
    if (await proceed.count()) await proceed.click();
    else await page.waitForSelector("button[aria-label='アニメーションと音声をお気に入り登録'], button[aria-label='アニメーションと音声のお気に入りを確認']", { timeout: 8000 }).catch(() => {});
  }
  const register = page.getByRole("button", { name: "アニメーションと音声をお気に入り登録" });
  if (await register.count()) {
    await register.click();
    await page.getByRole("button", { name: "登録する" }).click();
    await page.waitForTimeout(400);
  }
  const confirm = page.getByRole("button", { name: "アニメーションと音声のお気に入りを確認" });
  if (await confirm.count()) {
    await confirm.click();
    await page.waitForSelector(".gif-frame-count");
    const counts = await page.evaluate(() =>
      [...document.querySelectorAll(".gif-frame-count button")].map((button) => ({
        text: button.textContent?.trim(),
        on: button.getAttribute("aria-checked"),
      })),
    );
    check(JSON.stringify(counts) === JSON.stringify([
      { text: "128", on: "true" },
      { text: "64", on: "false" },
      { text: "32", on: "false" },
    ]), `count switch ${JSON.stringify(counts)}`);
    await page.locator(".gif-frame-count button", { hasText: "64" }).click();
    const selected = await page.locator(".gif-frame-count button.is-on").textContent();
    check(selected?.trim() === "64", `selected ${selected}`);
    await page.screenshot({ path: "/workspace/screenshots/gif-count.png" });
  } else {
    notes.push({ ok: false, message: "favorite dialog did not open" });
  }
  console.log(JSON.stringify(notes, null, 2));
} catch (error) {
  await page.screenshot({ path: "/workspace/screenshots/qa-fail.png" }).catch(() => {});
  console.log(JSON.stringify(notes, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
