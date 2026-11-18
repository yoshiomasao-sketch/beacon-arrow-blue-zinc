import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
const report = await page.evaluate(async () => {
  const width = 960;
  const height = 640;
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const sctx = source.getContext("2d");
  const img = sctx.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    const on = y % 2 === 0;
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      img.data[at] = on ? 240 : 10;
      img.data[at + 1] = on ? 220 : 10;
      img.data[at + 2] = on ? 180 : 10;
      img.data[at + 3] = 255;
    }
  }
  sctx.putImageData(img, 0, 0);
  const spikes = (data, w, h) => {
    let count = 0;
    const rows = [];
    for (let y = 1; y < h - 1; y += 1) {
      let mid = 0;
      let neighbors = 0;
      for (let x = 0; x < w; x += 1) {
        mid += data[(y * w + x) * 4];
        neighbors += data[((y - 1) * w + x) * 4] + data[((y + 1) * w + x) * 4];
      }
      if (Math.abs(mid - neighbors / 2) > w * 30) {
        count += 1;
        if (rows.length < 12) rows.push(y);
      }
    }
    return { count, rows, h };
  };
  const viaCanvas = () => {
    const dest = document.createElement("canvas");
    dest.width = 240;
    dest.height = 160;
    const ctx = dest.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, 240, 160);
    return spikes(ctx.getImageData(0, 0, 240, 160).data, 240, 160);
  };
  const viaBitmap = async () => {
    const bitmap = await createImageBitmap(source, { resizeWidth: 240, resizeHeight: 160, resizeQuality: "high" });
    const dest = document.createElement("canvas");
    dest.width = 240;
    dest.height = 160;
    const ctx = dest.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return spikes(ctx.getImageData(0, 0, 240, 160).data, 240, 160);
  };
  const viaNearest = () => {
    const dest = document.createElement("canvas");
    dest.width = 240;
    dest.height = 160;
    const ctx = dest.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, 240, 160);
    return spikes(ctx.getImageData(0, 0, 240, 160).data, 240, 160);
  };
  return { canvas: viaCanvas(), bitmap: await viaBitmap(), nearest: viaNearest() };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
