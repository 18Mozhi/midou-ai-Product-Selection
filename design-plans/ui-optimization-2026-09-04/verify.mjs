import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routes } from "./assets/catalog.generated.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const pngSize = async (file) => {
  const bytes = await readFile(file);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};
const folders = { desktop: [73, 1440], mobile: [73, 390], boards: [13, 1440] };
for (const [folder, [expected, width]] of Object.entries(folders)) {
  const files = (await readdir(path.join(here, folder === "boards" ? folder : `screens/${folder}`))).filter((name) => name.endsWith(".png"));
  if (files.length !== expected) throw new Error(`${folder}: expected ${expected} images, got ${files.length}`);
  for (const name of files) {
    const [actualWidth] = await pngSize(path.join(here, folder === "boards" ? folder : `screens/${folder}`, name));
    if (actualWidth !== width) throw new Error(`${folder}/${name}: expected width ${width}, got ${actualWidth}`);
  }
}

const types = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png" };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1"), file = path.resolve(here, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    if (!file.startsWith(here) || !existsSync(file)) throw new Error("not found");
    response.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }); response.end(await readFile(file));
  } catch { response.writeHead(404); response.end("not found"); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch({ headless: true });
const failures = [];
for (const [index, route] of routes.entries()) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.goto(`${base}/screen.html?route=${encodeURIComponent(route.path)}`, { waitUntil: "networkidle" });
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    h1: document.querySelectorAll("h1").length,
    tinyButtons: [...document.querySelectorAll("button")].filter((button) => {
      const rect = button.getBoundingClientRect(), style = getComputedStyle(button);
      return style.display !== "none" && rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
    }).length,
  }));
  if (result.overflow || result.h1 !== 1 || result.tinyButtons || errors.length) failures.push({ index: index + 1, path: route.path, ...result, errors });
  await page.close();
}
const indexPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await indexPage.goto(base, { waitUntil: "networkidle" });
const cardCount = await indexPage.locator(".review-card").count();
if (cardCount !== 73) failures.push({ index: "review", cardCount });
await indexPage.close();
await browser.close();
await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("PASS: 159 images, 73 routes, 390px overflow, heading, button hit-area and review-index checks");
