import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { chromium } from "playwright";
import { uiStatePagePlugin, uiStatePageSources } from "./lib/ui-state-page-preview.mjs";

const args = process.argv.slice(2), smoke = process.env.P72_SMOKE === "1";
assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])));
const widths = process.env.P72_VIEWPORT ? [Number.parseInt(process.env.P72_VIEWPORT, 10)] : smoke ? [390] : [1440, 390],
  motions = process.env.P72_MOTION ? [process.env.P72_MOTION] : smoke ? ["reduce"] : ["reduce", "no-preference"];
assert.deepEqual(widths.every((value) => [390, 1440].includes(value)), true);
assert.deepEqual(motions.every((value) => ["reduce", "no-preference"].includes(value)), true);
const output = args.length ? path.resolve(`output/playwright/p72-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const previous = output
  ? await readFile(path.join(output, "manifest.json"), "utf8").then(JSON.parse).catch(() => null)
  : null;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  plugins: [uiStatePagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [], results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P72 actual Vue review ${origin}`);
  for (const width of widths) for (const motion of motions) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, locale: "zh-CN", reducedMotion: motion });
    const page = await context.newPage(), errors = [], unexpected = [];
    let checks = 0;
    const check = (actual, expected, label) => { assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`); checks++; };
    const capture = async (name, target = page) => {
      const bytes = await target.screenshot({ animations: "disabled" }), file = `${width}-${name}.png`;
      await writeFile(path.join(output, file), bytes);
      images.push({ file, sha256: hash(bytes), pixelWidth: bytes.readUInt32BE(16), pixelHeight: bytes.readUInt32BE(20) });
    };
    try {
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) unexpected.push(request.method() + " " + new URL(request.url()).pathname); });
      await page.goto(`${origin}/ui-states?state=empty`, { waitUntil: "domcontentloaded" });
      const root = page.locator(".state-showcase--review");
      await root.waitFor();
      check(await root.locator("h1").count(), 1, "single h1");
      check(await root.locator(".p72-state-picker button").count(), 8, "eight state controls");
      check(await root.locator(".p72-state-picker button").evaluateAll((nodes) => nodes.every((node) => node.getBoundingClientRect().height >= 44)), true, "state controls 44px");
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "no overflow");
      for (const [label, kind] of [["加载", "loading"], ["空结果", "empty"], ["错误", "error"], ["无权限", "forbidden"], ["已过期", "expired"], ["受阻", "blocked"], ["已恢复", "recovery"], ["404", "not_found"]]) {
        await root.getByRole("button", { name: label, exact: true }).click();
        check(await root.locator("#ui-state-preview").getAttribute("data-kind"), kind, `${kind} selection`);
      }
      await root.getByRole("button", { name: "加载", exact: true }).click();
      check(await root.locator("#ui-state-preview button").count(), 0, "loading hides actions");
      await root.getByRole("button", { name: "受阻", exact: true }).click();
      const trigger = root.getByRole("button", { name: "查看高影响确认弹窗", exact: true });
      if (output && motion === "reduce") await capture("default");
      await trigger.focus();
      check(await trigger.evaluate((node) => getComputedStyle(node).outlineWidth), "3px", "trigger focus visible");
      await trigger.click();
      const dialog = page.getByRole("alertdialog", { name: "确认撤销示例授权？", exact: true }), cancel = dialog.getByRole("button", { name: "取消", exact: true }), confirm = dialog.getByRole("button", { name: "确认演示", exact: true });
      check(await cancel.evaluate((node) => node === document.activeElement), true, "dialog starts at cancel");
      check(await confirm.isDisabled(), true, "confirmation disabled initially");
      await dialog.getByRole("checkbox").check();
      await dialog.getByRole("textbox").fill("  确认撤销  ");
      check(await confirm.isEnabled(), true, "trimmed confirmation enables action");
      if (output && motion === "reduce") await capture("dialog", dialog);
      await page.keyboard.press("Escape");
      check(await trigger.evaluate((node) => node === document.activeElement), true, "escape restores trigger focus");
      check(unexpected, [], "no api requests");
      check(errors, [], "no page errors");
      results.push({ width, motion, checks });
      console.log(JSON.stringify({ width, motion, checks }));
    } finally { await context.close(); }
  }
  const sources = new Set(uiStatePageSources);
  for (const module of server.moduleGraph.idToModuleMap.values()) {
    const file = module.file && path.relative(process.cwd(), module.file).replaceAll("\\", "/");
    if (file && !file.startsWith("..") && !file.includes("node_modules") && /\.(vue|ts|css|json)$/.test(file)) sources.add(file);
  }
  const allImages = [...(previous?.images ?? []), ...images].filter((item, index, values) => values.findLastIndex((value) => value.file === item.file) === index).sort((a, b) => a.file.localeCompare(b.file)),
    allResults = [...(previous?.results ?? []), ...results].filter((item, index, values) => values.findLastIndex((value) => value.width === item.width && value.motion === item.motion) === index).sort((a, b) => a.width - b.width || a.motion.localeCompare(b.motion));
  if (output) await writeFile(path.join(output, "manifest.json"), JSON.stringify({ page: "P72", revision: args[1], capturedAt: new Date().toISOString(), sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), scope: "local actual Vue C review; dev-only state demonstration with no API writes", sources: Object.fromEntries(await Promise.all([...sources].sort().map(async (file) => [file, hash(await readFile(file))]))), images: allImages, results: allResults }, null, 2) + "\n");
  console.log(JSON.stringify({ groups: allResults.length, checks: allResults.reduce((sum, result) => sum + result.checks, 0), images: allImages.length, sources: sources.size, port }));
} finally { await browser?.close(); await server.close(); }
