import assert from "node:assert/strict";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { chromium } from "playwright";
import { apiCoveragePagePlugin, apiCoveragePageSources } from "./lib/api-coverage-page-preview.mjs";
import { buildApiCoverageDesignData } from "./lib/ui-phase2-api-coverage-design-data.mjs";
import { statusFixtureFile, statusReviewFixtures } from "./lib/status-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const args = process.argv.slice(2);
const smoke = process.env.P63_SMOKE === "1";
const targetWidths = process.env.P63_VIEWPORT
  ? [Number.parseInt(process.env.P63_VIEWPORT, 10)]
  : smoke
    ? [390]
    : [1440, 390];
const targetMotions = process.env.P63_MOTION
  ? [process.env.P63_MOTION]
  : smoke
    ? ["reduce"]
    : ["reduce", "no-preference"];
assert.deepEqual(
  targetWidths.every((width) => [390, 1440].includes(width)),
  true,
);
assert.deepEqual(
  targetMotions.every((motion) => ["reduce", "no-preference"].includes(motion)),
  true,
);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length
  ? path.resolve(`output/playwright/p63-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output, { recursive: true });
const priorManifest = output
  ? await readFile(path.join(output, "manifest.json"), "utf8")
      .then(JSON.parse)
      .catch(() => null)
  : null;
const { data: designData } = await buildApiCoverageDesignData(process.cwd());
const { nav } = await statusReviewFixtures();
const coverageNav = {
  ...nav,
  platform_roles: [...nav.platform_roles, "platform_superadmin"],
  platform_capabilities: [...nav.platform_capabilities, "platform:superadmin"],
};
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [apiCoveragePagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
    ...apiCoveragePageSources,
    ...designData.sourcePaths,
    statusFixtureFile,
    "scripts/lib/ui-phase2-api-coverage-design-data.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "scripts/verify-api-coverage-page-preview.mjs",
    "apps/web/vite.config.ts",
  ]),
  images = [],
  results = [],
  hash = (value) => createHash("sha256").update(value).digest("hex");
const envelope = (data) => ({
  data,
  request_id: "p63-local-fixture",
  trace_id: "p63-local-fixture",
});
const capture = async (target, file) => {
  const buffer = await target.screenshot({ animations: "disabled" });
  await writeFile(path.join(output, file), buffer);
  images.push({
    file,
    sha256: hash(buffer),
    pixelWidth: buffer.readUInt32BE(16),
    pixelHeight: buffer.readUInt32BE(20),
  });
};
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P63 actual Vue review ${origin}`);
  for (const width of targetWidths)
    for (const motion of targetMotions) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      const page = await context.newPage(),
        errors = [],
        unexpected = [],
        reads = [],
        requests = [],
        consoleErrors = [];
      page.setDefaultTimeout(smoke ? 25_000 : 8_000);
      let current = designData.datasets.current,
        checks = 0;
      const check = (a, b, label) => {
        assert.deepEqual(a, b, `${width}/${motion}: ${label}`);
        checks++;
      };
      try {
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("request", (request) =>
          requests.push(
            request.method() +
              " " +
              new URL(request.url()).pathname +
              new URL(request.url()).search,
          ),
        );
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("download", () => unexpected.push("download"));
        await page.route("**/*", async (route) => {
          const r = route.request(),
            url = new URL(r.url()),
            key = r.method() + " " + url.pathname;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(coverageNav) });
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: envelope({ authenticated: true }) });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({ status: 503, json: { error: { code: "local_preferences" } } });
          if (
            key !== "GET /api/v1/platform/management" ||
            url.searchParams.get("domain") !== "api_coverage"
          ) {
            unexpected.push(key + url.search);
            return route.abort();
          }
          reads.push(key);
          return route.fulfill({ json: envelope(current) });
        });
        await page.goto(origin + "/platform-admin/api-coverage", { waitUntil: "domcontentloaded" });
        const root = page.locator(".api-coverage--c");
        try {
          await root.waitFor({ state: "attached" });
        } catch {
          throw new Error(
            "P63 dashboard missing: " +
              page.url() +
              " " +
              (await page.locator("#app").innerHTML()).slice(0, 2000) +
              " errors=" +
              JSON.stringify({ errors, consoleErrors, requests }),
          );
        }
        await root.locator(".p63-operations").waitFor();
        for (const [name, fixture] of Object.entries(designData.datasets).filter(([n]) =>
          (smoke
            ? ["current"]
            : ["current", "missing", "invalid", "outdated", "wrong-operation-id"]
          ).includes(n),
        )) {
          current = fixture;
          await page.reload();
          await root.locator(".p63-operations").waitFor();
          check(
            await root.locator(".p63-truth").getAttribute("data-state"),
            fixture.report_status,
            name + " report state",
          );
          check(
            await root.locator(".p63-operations article").count(),
            fixture.operations.length,
            name + " displayed operations",
          );
          const overflow = await page.evaluate(() => {
            const widest = [...document.querySelectorAll(".api-coverage--c *")]
              .filter((element) => element.scrollWidth > innerWidth + 1)
              .sort((a, b) => b.scrollWidth - a.scrollWidth)[0];
            return {
              fits: (() => {
                const page = document.querySelector(".api-coverage--c");
                return Boolean(page && page.scrollWidth <= page.clientWidth + 1);
              })(),
              documentFits: document.documentElement.scrollWidth <= innerWidth + 1,
              overflowing: [...document.querySelectorAll(".api-coverage--c *")]
                .filter((element) => element.scrollWidth > element.clientWidth + 1)
                .slice(0, 8)
                .map((element) => ({
                  tag: element.tagName,
                  className: element.className,
                  clientWidth: element.clientWidth,
                  scrollWidth: element.scrollWidth,
                  text: element.textContent?.trim().slice(0, 60),
                })),
              widest: widest
                ? {
                    className: widest.className,
                    tag: widest.tagName,
                    width: widest.scrollWidth,
                    clientWidth: widest.clientWidth,
                    text: widest.textContent?.trim().slice(0, 100),
                    ancestors: (() => {
                      const rows = [];
                      let node = widest;
                      while (node && rows.length < 5) {
                        rows.push(`${node.tagName}.${String(node.className).replaceAll(" ", ".")}`);
                        node = node.parentElement;
                      }
                      return rows;
                    })(),
                  }
                : null,
            };
          });
          check(overflow.fits, true, name + " no overflow " + JSON.stringify(overflow));
        }
        check(await page.locator("h1:visible").count(), 1, "single visible page h1");
        check(
          await root
            .locator("summary")
            .evaluateAll((nodes) =>
              nodes
                .filter((n) => n.checkVisibility())
                .every((n) => n.getBoundingClientRect().height >= 44),
            ),
          true,
          "details controls 44px",
        );
        const details = root.locator("details").first();
        await details.locator("summary").focus();
        check(
          await details.locator("summary").evaluate((e) => getComputedStyle(e).outlineWidth),
          "3px",
          "visible focus",
        );
        if (output && motion === "reduce") {
          current = designData.datasets.current;
          await page.reload();
          await root.locator(".p63-operations").waitFor();
          for (const [name, sel] of [
            ["default", null],
            ["truth", ".p63-truth"],
            ["operations", ".p63-operations"],
          ]) {
            const target = sel ? root.locator(sel) : page;
            if (sel) await target.evaluate((e) => e.scrollIntoView({ block: "center" }));
            await capture(target, `${width}-${name}.png`);
          }
        }
        check(unexpected, [], "no writes downloads or external");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks, reads: reads.length });
        console.log(JSON.stringify({ width, motion, checks, reads: reads.length }));
      } finally {
        await context.close();
      }
    }
  for (const m of server.moduleGraph.idToModuleMap.values()) {
    const file = m.file && path.relative(process.cwd(), m.file).replaceAll("\\", "/");
    if (
      file &&
      !file.startsWith("..") &&
      !file.includes("node_modules") &&
      /\.(vue|ts|css|json)$/.test(file)
    )
      sources.add(file);
  }
  await includeImportedStyleSources(sources, (file) => readFile(file, "utf8"));
  const allImages = [...(priorManifest?.images ?? []), ...images]
      .filter(
        (image, index, values) =>
          values.findLastIndex((item) => item.file === image.file) === index,
      )
      .sort((a, b) => a.file.localeCompare(b.file)),
    allResults = [...(priorManifest?.results ?? []), ...results]
      .filter(
        (result, index, values) =>
          values.findLastIndex(
            (item) => item.width === result.width && item.motion === result.motion,
          ) === index,
      )
      .sort((a, b) => a.width - b.width || a.motion.localeCompare(b.motion));
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P63",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "local actual Vue C review; inert report datasets, never a production report or API probe",
          sources: Object.fromEntries(
            await Promise.all([...sources].sort().map(async (f) => [f, hash(await readFile(f))])),
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
      checks: allResults.reduce((s, x) => s + x.checks, 0),
      reads: allResults.reduce((s, x) => s + x.reads, 0),
      images: allImages.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
