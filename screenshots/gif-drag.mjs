import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await page.evaluate(async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#2080e0";
  ctx.fillRect(0, 0, 8, 8);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], "GIF_Frame_001.png", { type: "image/png" });
  const blobUrl = URL.createObjectURL(file);
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#fff";
  host.innerHTML = `
    <img id="img" src="${blobUrl}" draggable="true" style="position:absolute;left:30px;top:30px;width:120px;height:80px;background:#ddd" />
    <a id="link" href="${blobUrl}" download="GIF_Frame_001.png" draggable="true" style="position:absolute;left:180px;top:30px;width:120px;height:80px;background:#cde;display:block">link</a>
    <div id="file" draggable="true" style="position:absolute;left:330px;top:30px;width:120px;height:80px;background:#edc">file</div>
    <iframe id="box" style="position:absolute;left:30px;top:280px;width:700px;height:220px;border:0"></iframe>
  `;
  document.body.append(host);
  host.querySelector("#file").addEventListener("dragstart", (event) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", file.name);
    event.dataTransfer.setData("DownloadURL", `image/png:${file.name}:${dataUrl}`);
    event.dataTransfer.items.add(file);
  });
  host.querySelector("#link").addEventListener("dragstart", (event) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("DownloadURL", `image/png:GIF_Frame_001.png:${dataUrl}`);
    event.dataTransfer.items.add(file);
  });
  host.querySelector("#img").addEventListener("dragstart", (event) => {
    window.__imgStart = {
      types: [...event.dataTransfer.types],
      files: [...event.dataTransfer.files].map((item) => ({ name: item.name, type: item.type, size: item.size })),
    };
  });
  const frame = host.querySelector("#box");
  frame.srcdoc = `<!doctype html><div id="drop" style="height:200px;background:#efe">drop</div><script>
    const drop = document.getElementById("drop");
    drop.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; });
    drop.addEventListener("drop", (event) => {
      event.preventDefault();
      const got = event.dataTransfer.files[0];
      parent.postMessage({
        types: [...event.dataTransfer.types],
        file: got ? { name: got.name, type: got.type, size: got.size } : null,
        plain: event.dataTransfer.getData("text/plain").slice(0, 40),
        html: event.dataTransfer.getData("text/html").slice(0, 80),
        uri: event.dataTransfer.getData("text/uri-list").slice(0, 80),
      }, "*");
    });
  </script>`;
  window.__hits = [];
  window.addEventListener("message", (event) => window.__hits.push(event.data));
  window.__blobUrl = blobUrl;
});
await page.waitForTimeout(200);
async function pull(id) {
  const from = await page.locator(id).boundingBox();
  const to = await page.locator("#box").boundingBox();
  await page.mouse.move(from.x + 20, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(to.x + 80, to.y + 80, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}
await pull("#img");
await pull("#link");
await pull("#file");
const report = await page.evaluate(() => ({ hits: window.__hits, imgStart: window.__imgStart || null }));
console.log(JSON.stringify(report, null, 2));
await browser.close();
