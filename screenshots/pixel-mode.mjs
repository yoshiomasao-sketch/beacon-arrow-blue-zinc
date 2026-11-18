import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

async function readCanvas() {
  return page.locator(".pixel-pane canvas").evaluate((canvas) => {
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const at = (x, y) => {
      const i = (y * canvas.width + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    };
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque += 1;
    return { w: canvas.width, h: canvas.height, opaque, origin: at(0, 0), hole: at(4, 0), neighbor: at(3, 0), below: at(0, 1), edge: at(8, 0) };
  });
}

async function stroke(from, to) {
  const box = await page.locator(".pixel-pane canvas").boundingBox();
  const size = await page.locator(".pixel-pane canvas").evaluate((canvas) => canvas.width);
  const zoom = box.width / size;
  const pt = (x, y) => ({ x: box.x + (x + 0.5) * zoom, y: box.y + (y + 0.5) * zoom });
  const start = pt(from.x, from.y);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  if (to) {
    const end = pt(to.x, to.y);
    await page.mouse.move(end.x, end.y, { steps: 8 });
  }
  await page.mouse.up();
}

async function kvCanvas() {
  return page.evaluate(async () => {
    const names = (await indexedDB.databases()).map((db) => db.name).filter(Boolean);
    const out = {};
    for (const name of names) {
      const value = await new Promise((resolve) => {
        const req = indexedDB.open(name);
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("kv")) {
            db.close();
            resolve(null);
            return;
          }
          const get = db.transaction("kv", "readonly").objectStore("kv").get("canvasPlacements");
          get.onsuccess = () => {
            const row = get.result;
            db.close();
            resolve(row && "value" in row ? row.value : null);
          };
          get.onerror = () => {
            db.close();
            resolve(null);
          };
        };
      });
      if (value != null) out[name] = String(value).slice(0, 240);
    }
    return out;
  });
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForFunction(() => {
  const button = [...document.querySelectorAll(".canvas-mode-cluster button")].find((node) => node.textContent?.trim() === "ピクセル");
  return button && !button.disabled;
}, null, { timeout: 20000 });

const clusterBefore = await page.locator(".canvas-mode-cluster button").allTextContents();
await page.locator(".canvas-mode-cluster").getByRole("button", { name: "キャンバスモード" }).click();
await page.locator("section.canvas-pane").waitFor();
await page.waitForTimeout(500);
const canvasKvBefore = await kvCanvas();
await page.locator(".canvas-mode-cluster").getByRole("button", { name: "ピクセル" }).click();
await page.locator(".pixel-pane").waitFor();
await page.waitForTimeout(300);
const opened = {
  cluster: await page.locator(".canvas-mode-cluster button").allTextContents(),
  pixelPressed: await page.locator(".canvas-mode-cluster").getByRole("button", { name: "ピクセル" }).getAttribute("aria-pressed"),
  canvasPressed: await page.locator(".canvas-mode-cluster").getByRole("button", { name: "キャンバスモード" }).getAttribute("aria-pressed"),
  grid: await page.getByRole("button", { name: "グリッド" }).getAttribute("aria-pressed"),
  gridNode: await page.locator(".pixel-grid").count(),
  swatches: await page.locator(".pixel-swatches button").count(),
  sizes: await page.locator("select[aria-label='キャンバスサイズ'] option").allTextContents(),
  tools: await page.locator(".pixel-tools button").allTextContents(),
  canvasGone: await page.locator("section.canvas-pane:not(.pixel-pane)").count(),
};
await page.screenshot({ path: "/workspace/screenshots/pixel-mode.png" });

const beforeColor = await readCanvas();
await page.locator("button[aria-label='色 36 36 255']").click();
const afterColor = await readCanvas();
await page.locator(".pixel-tools").getByRole("button", { name: "ペン" }).click();
await stroke({ x: 0, y: 0 }, { x: 8, y: 0 });
const lined = await readCanvas();
await page.locator(".pixel-tools").getByRole("button", { name: "消しゴム" }).click();
await stroke({ x: 4, y: 0 });
const erased = await readCanvas();
await page.locator(".canvas-mode-cluster").getByRole("button", { name: "コピー" }).click();
await page.waitForTimeout(300);
const copied = await page.evaluate(async () => {
  const items = await navigator.clipboard.read();
  const types = items.map((item) => item.types);
  const blob = await items[0].getType("image/png");
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const below = ctx.getImageData(0, 1, 1, 1).data;
  const hole = ctx.getImageData(4, 0, 1, 1).data;
  const line = ctx.getImageData(3, 0, 1, 1).data;
  bitmap.close();
  return { w: canvas.width, h: canvas.height, bytes: blob.size, types, below: [...below], hole: [...hole], line: [...line] };
});
await page.locator("button[aria-label='色 36 219 36']").click();
await page.locator(".pixel-tools").getByRole("button", { name: "塗りつぶし" }).click();
await stroke({ x: 4, y: 0 });
const filled = await readCanvas();
const withGrid = await readCanvas();
await page.getByRole("button", { name: "グリッド" }).click();
const gridOff = {
  pressed: await page.getByRole("button", { name: "グリッド" }).getAttribute("aria-pressed"),
  node: await page.locator(".pixel-grid").count(),
  same: JSON.stringify(withGrid) === JSON.stringify(await readCanvas()),
};
await page.getByRole("button", { name: "グリッド" }).click();

await page.locator("select[aria-label='キャンバスサイズ']").selectOption("128");
const sizeAsk = await page.locator(".pixel-ask-dialog").innerText();
await page.locator(".pixel-ask-dialog").getByRole("button", { name: "キャンセル" }).click();
const afterSizeCancel = await readCanvas();

async function dropSample() {
  return page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 20;
    canvas.height = 10;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgb(10, 180, 40)";
    ctx.fillRect(0, 0, 20, 10);
    ctx.clearRect(0, 0, 1, 1);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const file = new File([blob], "drop.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const pane = document.querySelector(".pixel-pane");
    pane.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    pane.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    return { files: transfer.files.length, type: file.type, size: file.size };
  });
}

const dropTry = await dropSample();
await page.waitForTimeout(300);
const importDialog = await page.locator(".pixel-ask-dialog").count();
let importText = "";
let afterDropCancel = null;
let afterDropConfirm = null;
if (importDialog) {
  importText = await page.locator(".pixel-ask-dialog").innerText();
  await page.screenshot({ path: "/workspace/screenshots/pixel-import-ask.png" });
  await page.locator(".pixel-ask-dialog").getByRole("button", { name: "キャンセル" }).click();
  afterDropCancel = await readCanvas();
  await dropSample();
  await page.getByRole("button", { name: "キャンバスサイズに合わせてドット化する" }).waitFor({ timeout: 5000 });
  await page.locator(".pixel-ask-dialog").getByRole("button", { name: "キャンバスサイズに合わせてドット化する" }).click();
  await page.waitForTimeout(200);
  afterDropConfirm = await readCanvas();
  await page.screenshot({ path: "/workspace/screenshots/pixel-imported.png" });
}

const sampleBeforeLeave = await readCanvas();
await page.locator(".canvas-mode-cluster").getByRole("button", { name: "キャンバスモード" }).click();
await page.locator("section.canvas-pane:not(.pixel-pane)").waitFor();
await page.waitForTimeout(400);
const canvasKvAfter = await kvCanvas();
const backToCanvas = {
  pixel: await page.locator(".pixel-pane").count(),
  canvas: await page.locator("section.canvas-pane:not(.pixel-pane)").count(),
  cluster: await page.locator(".canvas-mode-cluster button").allTextContents(),
  canvasPressed: await page.locator(".canvas-mode-cluster").getByRole("button", { name: "キャンバスモード" }).getAttribute("aria-pressed"),
};
await page.locator(".canvas-mode-cluster").getByRole("button", { name: "ピクセル" }).click();
await page.locator(".pixel-pane canvas").waitFor();
await page.waitForTimeout(600);
const restored = await readCanvas();

await page.getByRole("button", { name: "新規" }).click();
const freshText = await page.locator(".pixel-ask-dialog").innerText();
await page.locator(".pixel-ask-dialog").getByRole("button", { name: "キャンセル" }).click();
const afterFreshCancel = await readCanvas();
await page.getByRole("button", { name: "新規" }).click();
await page.locator(".pixel-ask-dialog").getByRole("button", { name: "作成" }).click();
await page.waitForTimeout(200);
const fresh = await readCanvas();

const saveProbe = await page.evaluate(async () => {
  const has = typeof window.showSaveFilePicker === "function";
  return { has };
});
await page.locator(".canvas-mode-cluster").getByRole("button", { name: "保存" }).click();
await page.waitForTimeout(500);
const notices = await page.locator(".notice-stack").allTextContents();

const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await phone.waitForTimeout(800);
const phoneUi = await phone.evaluate(() => {
  const cluster = document.querySelector(".canvas-mode-cluster");
  const pixel = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "ピクセル");
  return {
    clusterDisplay: cluster ? getComputedStyle(cluster).display : "missing",
    pixelVisible: pixel ? pixel.getClientRects().length > 0 : false,
    pixelPane: document.querySelectorAll(".pixel-pane").length,
  };
});

console.log(
  JSON.stringify(
    {
      errors,
      clusterBefore,
      canvasKvBefore,
      opened,
      colorUntouched: JSON.stringify(beforeColor) === JSON.stringify(afterColor),
      lined,
      erased,
      filled,
      gridOff,
      copied,
      sizeAsk,
      sizeCancelKept: JSON.stringify(afterSizeCancel) === JSON.stringify(filled),
      dropTry,
      importDialog,
      importText,
      dropCancelKept: afterDropCancel ? JSON.stringify(afterDropCancel) === JSON.stringify(filled) : null,
      afterDropConfirm,
      sampleBeforeLeave,
      backToCanvas,
      canvasKvSame: JSON.stringify(canvasKvBefore) === JSON.stringify(canvasKvAfter),
      canvasKvAfter,
      restored,
      restoredSame: JSON.stringify(restored) === JSON.stringify(sampleBeforeLeave),
      freshText,
      freshCancelKept: JSON.stringify(afterFreshCancel) === JSON.stringify(restored),
      fresh,
      saveProbe,
      notices,
      phoneUi,
    },
    null,
    2,
  ),
);
await browser.close();
