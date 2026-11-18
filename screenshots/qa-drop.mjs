import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.setInputFiles("input[aria-label='画像を取り込む']", ["/tmp/frames.gif"]);
  await page.waitForSelector("button[aria-label$='を拡大']", { timeout: 15000 });
  await page.locator("button[aria-label$='.gifを拡大']").first().click();
  await page.getByRole("button", { name: "フレームを一覧化する" }).click();
  await page.locator(".gif-frames-cell").first().click();
  await page.waitForSelector(".gif-frames-drag");
  await page.evaluate(() => {
    const zoom = document.querySelector(".gif-frames-zoom");
    const zone = document.createElement("div");
    zone.id = "drop-probe";
    zone.style.cssText = "position:fixed;left:8px;top:8px;width:180px;height:120px;z-index:2147483647;background:#204060";
    document.body.appendChild(zone);
    const input = document.createElement("input");
    input.type = "file";
    input.id = "file-probe";
    input.style.cssText = "position:fixed;left:8px;top:140px;z-index:2147483647";
    document.body.appendChild(input);
    const take = async (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      const bytes = file ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
      window.__drop = {
        name: file?.name ?? "",
        type: file?.type ?? "",
        size: file?.size ?? 0,
        png: bytes[0] === 0x89 && bytes[1] === 0x50,
        types: [...(event.dataTransfer?.types ?? [])],
      };
    };
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });
    zone.addEventListener("drop", take);
    input.addEventListener("dragover", (event) => event.preventDefault());
    input.addEventListener("drop", take);
  });
  await page.locator(".gif-frames-drag").dragTo(page.locator("#drop-probe"), { targetPosition: { x: 40, y: 40 } });
  await page.waitForTimeout(500);
  const dropped = await page.evaluate(() => window.__drop ?? null);
  console.log(JSON.stringify(dropped));
  await page.screenshot({ path: "/workspace/screenshots/gif-zoom.png" });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
