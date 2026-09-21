import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { chromium } from "playwright";
import { notFoundPagePlugin, notFoundPageSources } from "./lib/not-found-page-preview.mjs";

const args = process.argv.slice(2),
  smoke = process.env.P73_SMOKE === "1";
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const widths = process.env.P73_VIEWPORT
    ? [Number.parseInt(process.env.P73_VIEWPORT, 10)]
    : smoke
      ? [390]
      : [1440, 390],
  motions = process.env.P73_MOTION
    ? [process.env.P73_MOTION]
    : smoke
      ? ["reduce"]
      : ["reduce", "no-preference"];
assert.deepEqual(
  widths.every((value) => [390, 1440].includes(value)),
  true,
);
assert.deepEqual(
  motions.every((value) => ["reduce", "no-preference"].includes(value)),
  true,
);
const output = args.length
  ? path.resolve(`output/playwright/p73-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output, { recursive: true });
const previous = output
  ? await readFile(path.join(output, "manifest.json"), "utf8")
      .then(JSON.parse)
      .catch(() => null)
  : null;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  plugins: [notFoundPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [],
  results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P73 actual Vue review ${origin}`);
  for (const width of widths)
    for (const motion of motions) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      const page = await context.newPage(),
        errors = [],
        unexpected = [];
      let checks = 0;
      const check = (actual, expected, label) => {
        assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`);
        checks++;
      };
      const capture = async (name) => {
        const bytes = await page.screenshot({ animations: "disabled" }),
          file = `${width}-${name}.png`;
        await writeFile(path.join(output, file), bytes);
        images.push({
          file,
          sha256: hash(bytes),
          pixelWidth: bytes.readUInt32BE(16),
          pixelHeight: bytes.readUInt32BE(20),
        });
      };
      try {
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (request) => {
          if (new URL(request.url()).pathname.startsWith("/api/"))
            unexpected.push(request.method() + " " + new URL(request.url()).pathname);
        });
        await page.goto(`${origin}/not-registered/p73-review-very-long-path-${"x".repeat(120)}`, {
          waitUntil: "domcontentloaded",
        });
        const root = page.locator(".not-found-page--review");
        await root.waitFor();
        check(await root.locator("h1").count(), 1, "single h1");
        check(
          await root.locator("h1").evaluate((node) => node === document.activeElement),
          true,
          "heading receives focus",
        );
        check(
          await root.locator(".not-found-orbit,.not-found-satellite").count(),
          0,
          "no orbital decoration",
        );
        check(
          await root
            .locator(".p73-route code")
            .innerText()
            .then((value) => value.endsWith("…")),
          true,
          "long route truncation",
        );
        check(
          await root
            .locator("nav a")
            .evaluateAll((nodes) =>
              nodes.every((node) => node.getBoundingClientRect().height >= 44),
            ),
          true,
          "recovery controls 44px",
        );
        check(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          "no overflow",
        );
        const primary = root.locator(".not-found-primary");
        await primary.focus();
        check(
          await primary.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "primary focus visible",
        );
        if (output && motion === "reduce") await capture("default");
        check(unexpected, [], "no api request");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks });
        console.log(JSON.stringify({ width, motion, checks }));
      } finally {
        await context.close();
      }
    }
  const sources = new Set(notFoundPageSources);
  for (const module of server.moduleGraph.idToModuleMap.values()) {
    const file = module.file && path.relative(process.cwd(), module.file).replaceAll("\\", "/");
    if (
      file &&
      !file.startsWith("..") &&
      !file.includes("node_modules") &&
      /\.(vue|ts|css|json)$/.test(file)
    )
      sources.add(file);
  }
  const allImages = [...(previous?.images ?? []), ...images]
      .filter(
        (item, index, values) =>
          values.findLastIndex((value) => value.file === item.file) === index,
      )
      .sort((a, b) => a.file.localeCompare(b.file)),
    allResults = [...(previous?.results ?? []), ...results]
      .filter(
        (item, index, values) =>
          values.findLastIndex(
            (value) => value.width === item.width && value.motion === item.motion,
          ) === index,
      )
      .sort((a, b) => a.width - b.width || a.motion.localeCompare(b.motion));
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P73",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope: "local actual Vue C review; no route recovery was clicked and no API was read",
          sources: Object.fromEntries(
            await Promise.all(
              [...sources].sort().map(async (file) => [file, hash(await readFile(file))]),
            ),
          ),
          images: allImages,
          results: allResults,
        },
        null,
        2,
      ) + "\n",
    );
  console.log(
    JSON.stringify({
      groups: allResults.length,
      checks: allResults.reduce((sum, result) => sum + result.checks, 0),
      images: allImages.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
