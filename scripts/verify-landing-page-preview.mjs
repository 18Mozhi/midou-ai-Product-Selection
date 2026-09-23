import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { landingPagePlugin, landingPageSources } from "./lib/landing-page-preview.mjs";

const args = process.argv.slice(2);
const smoke = process.env.P01_SMOKE === "1";
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);

const widths = process.env.P01_VIEWPORT
  ? [Number.parseInt(process.env.P01_VIEWPORT, 10)]
  : smoke
    ? [390]
    : [1440, 390];
const motions = process.env.P01_MOTION
  ? [process.env.P01_MOTION]
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
  ? path.resolve(`output/playwright/p01-page-composition-${args[1]}`)
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
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [landingPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});

const hash = (value) => createHash("sha256").update(value).digest("hex");
const images = [];
const results = [];
let browser;

try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P01 actual Vue review ${origin}`);

  for (const width of widths) {
    for (const motion of motions) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      const page = await context.newPage();
      const errors = [];
      const unexpected = [];
      const reads = [];
      let firstRelease;
      let attempt = 0;
      let checks = 0;

      const releaseFirst = new Promise((resolve) => {
        firstRelease = resolve;
      });
      const check = (actual, expected, label) => {
        assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`);
        checks++;
      };
      const waitForAttempts = async (expected, label) => {
        const deadline = Date.now() + 4_000;
        while (attempt < expected && Date.now() < deadline)
          await new Promise((resolve) => setTimeout(resolve, 25));
        check(attempt, expected, label);
      };
      const capture = async (name) => {
        const bytes = await page.screenshot({ animations: "disabled" });
        const file = `${width}-${name}.png`;
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
            reads.push(`${request.method()} ${new URL(request.url()).pathname}`);
        });
        await page.route("**/*", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin !== origin) return route.abort();
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (request.method() !== "GET" || url.pathname !== "/api/v1/me/landing") {
            unexpected.push(`${request.method()} ${url.pathname}`);
            return route.abort();
          }
          attempt++;
          if (attempt === 1) await releaseFirst;
          return route.fulfill({
            status: 503,
            json: {
              error: { code: "local_landing_unavailable" },
              request_id: "p01-review-request",
            },
          });
        });

        await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
        const root = page.locator(".landing-redirect");
        await root.waitFor();
        check(await root.locator("h1").count(), 1, "single h1");
        check(
          await root.locator(".ui-state-panel").getAttribute("data-kind"),
          "loading",
          "initial loading",
        );
        check(await root.locator(".ui-state-panel button").count(), 0, "loading hides action");
        check(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          "no overflow",
        );
        if (output && motion === "reduce") await capture("loading");

        firstRelease();
        await root.locator(".ui-state-panel[data-kind=blocked]").waitFor();
        await waitForAttempts(3, "initial resolution uses the three safe GET attempts");
        check(
          await root.getByRole("button", { name: "重新检查", exact: true }).count(),
          1,
          "one retry action",
        );
        check(
          await root.locator(".ui-state-panel footer button:visible").count(),
          1,
          "failure keeps one action",
        );
        check(
          (await root.getByText("p01-review-request", { exact: true }).count()) > 0,
          true,
          "failure shows request id",
        );

        const retry = root.getByRole("button", { name: "重新检查", exact: true });
        await retry.focus();
        check(
          await retry.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "retry focus visible",
        );
        if (output && motion === "reduce") await capture("blocked");

        const attemptsBeforeRetry = attempt;
        await retry.click();
        await waitForAttempts(
          attemptsBeforeRetry + 3,
          "retry starts one resolver with the normal three safe GET attempts",
        );
        check(unexpected, [], "no unexpected api");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks, reads: reads.length });
        console.log(JSON.stringify({ width, motion, checks, reads: reads.length }));
      } finally {
        await context.close();
      }
    }
  }

  const sources = new Set(landingPageSources);
  for (const module of server.moduleGraph.idToModuleMap.values()) {
    const file = module.file && path.relative(process.cwd(), module.file).replaceAll("\\\\", "/");
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
      (item, index, values) => values.findLastIndex((value) => value.file === item.file) === index,
    )
    .sort((a, b) => a.file.localeCompare(b.file));
  const allResults = [...(previous?.results ?? []), ...results]
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
          page: "P01",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "local actual Vue C review; landing GET is locally intercepted and always returns a review failure",
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
      reads: allResults.reduce((sum, result) => sum + result.reads, 0),
      images: allImages.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
