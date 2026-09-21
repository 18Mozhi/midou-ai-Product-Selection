import assert from "node:assert/strict";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { chromium } from "playwright";
import { schedulerPagePlugin, schedulerPageSources } from "./lib/scheduler-page-preview.mjs";
import { buildSchedulerDesignData } from "./lib/ui-phase2-scheduler-design-data.mjs";
import { statusFixtureFile, statusReviewFixtures } from "./lib/status-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length
  ? path.resolve(`output/playwright/p70-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output, { recursive: true });
const { data: designData } = await buildSchedulerDesignData(process.cwd());
const { nav } = await statusReviewFixtures();
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [schedulerPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
    ...schedulerPageSources,
    ...designData.sourcePaths,
    statusFixtureFile,
    "scripts/lib/ui-phase2-scheduler-design-data.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "scripts/verify-scheduler-page-preview.mjs",
    "apps/web/vite.config.ts",
  ]),
  images = [],
  results = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const envelope = (data) => ({
  data,
  request_id: "p70-local-fixture",
  trace_id: "p70-local-fixture",
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
  console.log(`P70 actual Vue review ${origin}`);
  for (const width of [1440, 390])
    for (const motion of ["reduce", "no-preference"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      const page = await context.newPage(),
        errors = [],
        unexpected = [],
        reads = [];
      let current = { data: designData.datasets.ready },
        checks = 0;
      const check = (actual, expected, label) => {
        assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`);
        checks++;
      };
      try {
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("download", () => unexpected.push("download"));
        await page.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            key = request.method() + " " + url.pathname;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: envelope(nav) });
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: envelope({ authenticated: true }) });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({ status: 503, json: { error: { code: "local_preferences" } } });
          if (key !== "GET /api/v1/platform/operations/crawler-scheduler" || url.search) {
            unexpected.push(key);
            return route.abort();
          }
          reads.push(key);
          if ("error" in current)
            return route.fulfill({
              status: current.error.status,
              json: {
                error: current.error.error,
                request_id: current.error.request_id,
                trace_id: current.error.trace_id,
              },
            });
          return route.fulfill({ json: envelope(current.data) });
        });
        await page.goto(origin + "/platform-admin/crawler-scheduler");
        const root = page.locator(".crawler-scheduler--review"),
          refresh = root.getByRole("button", { name: "刷新运行事实", exact: true });
        await root.locator(".p70-providers").waitFor();
        for (const [name, fixture] of Object.entries(designData.datasets).filter(([name]) =>
          ["ready", "circuit", "spool-missing", "no-providers", "many", "all-empty-lists"].includes(
            name,
          ),
        )) {
          current = { data: fixture };
          await refresh.click();
          await page.waitForTimeout(40);
          check(await root.getAttribute("data-state"), fixture.state, name + " verdict");
          check(
            await root.locator(".p70-findings article").count(),
            fixture.findings.length,
            name + " findings",
          );
          check(
            (await root.locator(".p70-provider-list article").count()) <= 12,
            true,
            name + " page size",
          );
          check(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            true,
            name + " no horizontal overflow",
          );
        }
        check(await page.locator("h1").count(), 1, "single page h1");
        check(
          await root
            .locator("button, input, select, summary")
            .evaluateAll((nodes) =>
              nodes
                .filter((node) => node.checkVisibility())
                .every((node) => node.getBoundingClientRect().height >= 44),
            ),
          true,
          "native controls are at least 44px",
        );
        const focusReviewControl = async (control, label) => {
          await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          });
          let reached = false;
          for (let index = 0; index < 100; index += 1) {
            await page.keyboard.press("Tab");
            if (await control.evaluate((element) => document.activeElement === element)) {
              reached = true;
              break;
            }
          }
          check(reached, true, label + " owns keyboard focus");
          check(
            await control.evaluate((element) => {
              const style = getComputedStyle(element);
              return style.outlineWidth === "3px" && style.outlineStyle === "solid";
            }),
            true,
            label + " has visible 3px focus",
          );
        };
        current = { data: designData.datasets.ready };
        await refresh.click();
        await page.waitForTimeout(40);
        await focusReviewControl(refresh, "top refresh");
        if (output && motion === "reduce")
          await capture(root.locator(".crawler-scheduler__hero"), `${width}-refresh-focus.png`);
        current = {
          error: {
            status: 503,
            error: { code: "crawler_scheduler_unavailable", message: "调度事实暂不可用。" },
            request_id: "p70-local-retained-failure",
            trace_id: "p70-local-retained-failure",
          },
        };
        await refresh.click();
        const retained = root.locator(".crawler-scheduler__refresh-notice");
        await retained.waitFor();
        check(await retained.isVisible(), true, "retained unavailable notice visible");
        check(await root.locator(".p70-providers").count(), 1, "retained unavailable keeps facts");
        if (output && motion === "reduce") await capture(retained, `${width}-retained-notice.png`);
        const recheck = retained.getByRole("button", { name: "重新核验", exact: true });
        await focusReviewControl(recheck, "retained recheck");
        if (output && motion === "reduce") await capture(retained, `${width}-retained-focus.png`);
        current = {
          error: {
            status: 403,
            error: { code: "platform_operate_required", message: "当前账号无权读取调度事实。" },
            request_id: "p70-local-forbidden",
            trace_id: "p70-local-forbidden",
          },
        };
        await refresh.click();
        const forbidden = root.locator('.crawler-scheduler__state[data-kind="forbidden"]');
        await forbidden.waitFor();
        check(await forbidden.isVisible(), true, "forbidden initial state visible");
        check(await root.locator(".p70-providers").count(), 0, "forbidden clears facts");
        if (output && motion === "reduce") await capture(forbidden, `${width}-forbidden-state.png`);
        current = { data: designData.datasets.ready };
        await refresh.click();
        await root.locator(".p70-providers").waitFor();
        if (output && motion === "reduce")
          for (const [name, selector] of [
            ["default", null],
            ["providers", ".p70-providers"],
            ["evidence", ".p70-evidence"],
            ["trend", ".p70-trend"],
          ]) {
            const target = selector ? root.locator(selector) : page;
            if (selector)
              await target.evaluate((element) => element.scrollIntoView({ block: "center" }));
            await capture(target, `${width}-${name}.png`);
          }
        check(unexpected, [], "no writes downloads or external requests");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks, reads: reads.length });
        console.log(JSON.stringify({ width, motion, checks, reads: reads.length }));
      } finally {
        await context.close();
      }
    }
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
  await includeImportedStyleSources(sources, (file) => readFile(file, "utf8"));
  images.sort((a, b) => a.file.localeCompare(b.file));
  results.sort((a, b) => a.width - b.width || a.motion.localeCompare(b.motion));
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P70",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "local actual Vue C review; inert source datasets, never a live scheduler read or recovery",
          sources: Object.fromEntries(
            await Promise.all(
              [...sources].sort().map(async (file) => [file, hash(await readFile(file))]),
            ),
          ),
          images,
          results,
        },
        null,
        2,
      ) + "\n",
    );
  console.log(
    JSON.stringify({
      groups: results.length,
      checks: results.reduce((sum, item) => sum + item.checks, 0),
      reads: results.reduce((sum, item) => sum + item.reads, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
