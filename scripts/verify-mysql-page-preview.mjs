import assert from "node:assert/strict";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { chromium } from "playwright";
import { mysqlPagePlugin, mysqlPageSources } from "./lib/mysql-page-preview.mjs";
import { buildMysqlDesignData } from "./lib/ui-phase2-mysql-design-data.mjs";
import { statusReviewFixtures, statusFixtureFile } from "./lib/status-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const args = process.argv.slice(2);
const mobileStateReview =
  args.length === 3 &&
  args[0] === "--capture-review" &&
  /^r[1-9]\d*$/.test(args[1]) &&
  args[2] === "--mobile-states";
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])) ||
    mobileStateReview,
);
const output = args.length
  ? path.resolve(`output/playwright/p68-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output);
const { data: designData } = await buildMysqlDesignData(process.cwd());
const { nav } = await statusReviewFixtures();
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [mysqlPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
    ...mysqlPageSources,
    ...designData.sourcePaths,
    statusFixtureFile,
    "scripts/lib/ui-phase2-mysql-design-data.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "scripts/verify-mysql-page-preview.mjs",
    "apps/web/vite.config.ts",
  ]),
  images = [],
  results = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P68 actual Vue review ${origin}`);
  for (const width of mobileStateReview ? [390] : [1440, 390])
    for (const motion of mobileStateReview ? ["reduce"] : ["reduce", "no-preference"]) {
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
          const req = route.request(),
            url = new URL(req.url()),
            key = req.method() + " " + url.pathname;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const envelope = (data) => ({
            data,
            request_id: "p68-local-fixture",
            trace_id: "p68-local-fixture",
          });
          if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: envelope(nav) });
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: envelope({ authenticated: true }) });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({ status: 503, json: { error: { code: "local_preferences" } } });
          if (key !== "GET /api/v1/platform/operations/mysql" || url.search) {
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
        await page.goto(origin + "/platform-admin/mysql");
        const root = page.locator(".mysql-resilience--review"),
          refresh = root.getByRole("button", { name: "刷新运行事实", exact: true });
        await root.locator(".p68-durability").waitFor();
        for (const [name, fixture] of Object.entries(designData.datasets).filter(([name]) =>
          [
            "ready",
            "availability-boundary",
            "capacity-unknown",
            "negative-recovery",
            "probe-null-rpo",
            "row-waits",
          ].includes(name),
        )) {
          current = { data: fixture };
          await refresh.click();
          await page.waitForTimeout(40);
          check(await root.getAttribute("data-state"), fixture.state, name + " verdict");
          check(
            await root.locator(".p68-findings article").count(),
            fixture.findings.length,
            name + " findings",
          );
          check(
            await root.locator(".p68-resource").count(),
            2,
            name + " keeps two resource readings",
          );
          check(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            true,
            name + " no overflow",
          );
          const unavailable = fixture.findings.some((item) => item.code === "mysql_unavailable"),
            measured =
              Number(fixture.connections.maximum > 0) + Number(fixture.storage.total_bytes > 0);
          check(
            await root.locator(".p68-meter").count(),
            unavailable ? 0 : measured,
            name + " independent resource meters",
          );
        }
        check(await page.locator("h1").count(), 1, "single page h1");
        check(
          await root
            .locator("button,summary")
            .evaluateAll((nodes) =>
              nodes
                .filter((node) => node.checkVisibility())
                .every((node) => node.getBoundingClientRect().height >= 44),
            ),
          true,
          "native controls 44px",
        );
        check(
          await root
            .locator(".mysql-resilience__footer")
            .evaluate((element) => getComputedStyle(element).textAlign),
          "left",
          "footer left aligned",
        );
        const focusReviewControl = async (control, label) => {
          await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          });
          let reached = false;
          for (let index = 0; index < 80; index += 1) {
            await page.keyboard.press("Tab");
            if (await control.evaluate((element) => document.activeElement === element)) {
              reached = true;
              break;
            }
          }
          check(reached, true, label + " owns focus");
          check(
            await control.evaluate((element) => {
              const style = getComputedStyle(element);
              return style.outlineWidth === "3px" && style.outlineStyle === "solid";
            }),
            true,
            label + " has visible 3px focus",
          );
        };
        await focusReviewControl(refresh, "top refresh");
        if (output && motion === "reduce") {
          const target = root.locator(".mysql-resilience__hero");
          const buffer = await target.screenshot({ animations: "disabled" });
          const file = `${width}-refresh-focus.png`;
          await writeFile(path.join(output, file), buffer);
          images.push({
            file,
            sha256: hash(buffer),
            pixelWidth: buffer.readUInt32BE(16),
            pixelHeight: buffer.readUInt32BE(20),
          });
        }
        current = { data: designData.datasets.ready };
        await refresh.click();
        await page.waitForTimeout(40);
        current = {
          error: {
            status: 503,
            error: {
              code: "mysql_resilience_dependency_unavailable",
              message: "MySQL 运行事实暂不可用。",
              action_hint: "请在宝塔核对 Node API 与 MySQL。",
            },
            request_id: "p68-local-retained-failure",
            trace_id: "p68-local-retained-failure",
          },
        };
        await refresh.click();
        const retained = root.locator(".mysql-resilience__refresh-notice");
        await retained.waitFor();
        check(await retained.isVisible(), true, "retained unavailable notice visible");
        check(await root.locator(".p68-durability").count(), 1, "retained unavailable keeps facts");
        check(
          (await retained.textContent())?.includes("已保留上次成功的 MySQL 运行事实") ?? false,
          true,
          "retained unavailable names last successful snapshot",
        );
        if (output && motion === "reduce") {
          await page.addStyleTag({
            content: ".role-mobile-nav { visibility: hidden !important; }",
          });
          const buffer = await retained.screenshot({ animations: "disabled" });
          const file = `${width}-retained-notice.png`;
          await writeFile(path.join(output, file), buffer);
          images.push({
            file,
            sha256: hash(buffer),
            pixelWidth: buffer.readUInt32BE(16),
            pixelHeight: buffer.readUInt32BE(20),
          });
        }
        const recheck = retained.getByRole("button", { name: "重新核验", exact: true });
        await focusReviewControl(recheck, "retained recheck");
        if (output && motion === "reduce") {
          const focusBuffer = await retained.screenshot({ animations: "disabled" });
          const focusFile = `${width}-retained-focus.png`;
          await writeFile(path.join(output, focusFile), focusBuffer);
          images.push({
            file: focusFile,
            sha256: hash(focusBuffer),
            pixelWidth: focusBuffer.readUInt32BE(16),
            pixelHeight: focusBuffer.readUInt32BE(20),
          });
        }
        current = {
          error: {
            status: 403,
            error: {
              code: "platform_operate_required",
              message: "当前账号无权读取 MySQL 运行事实。",
              action_hint: "需要 platform:operate 能力。",
            },
            request_id: "p68-local-forbidden",
            trace_id: "p68-local-forbidden",
          },
        };
        await refresh.click();
        const forbidden = root.locator(".mysql-resilience__state--danger");
        await forbidden.waitFor();
        check(await forbidden.isVisible(), true, "forbidden initial state visible");
        check(await root.locator(".p68-durability").count(), 0, "forbidden clears facts");
        check(
          (await forbidden.textContent())?.includes("没有平台运维权限") ?? false,
          true,
          "forbidden names the access boundary",
        );
        if (output && motion === "reduce") {
          const buffer = await forbidden.screenshot({ animations: "disabled" });
          const file = `${width}-forbidden-state.png`;
          await writeFile(path.join(output, file), buffer);
          images.push({
            file,
            sha256: hash(buffer),
            pixelWidth: buffer.readUInt32BE(16),
            pixelHeight: buffer.readUInt32BE(20),
          });
        }
        current = { data: designData.datasets.ready };
        await refresh.click();
        await root.locator(".p68-durability").waitFor();
        if (output && motion === "reduce")
          for (const [name, selector] of [
            ["default", null],
            ["resources", ".p68-resource-grid"],
            ["recovery", ".p68-recovery"],
            ["durability", ".p68-durability"],
          ]) {
            const target = selector ? root.locator(selector) : page;
            if (selector)
              await target.evaluate((element) => element.scrollIntoView({ block: "center" }));
            const buffer = await target.screenshot({
              ...(selector ? {} : { fullPage: true }),
              animations: "disabled",
            });
            const file = `${width}-${name}.png`;
            await writeFile(path.join(output, file), buffer);
            images.push({
              file,
              sha256: hash(buffer),
              pixelWidth: buffer.readUInt32BE(16),
              pixelHeight: buffer.readUInt32BE(20),
            });
          }
        check(unexpected, [], "no writes/downloads/external");
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
          page: "P68",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope: "local actual Vue C review; inert source datasets, not live MySQL or recovery",
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
      checks: results.reduce((sum, result) => sum + result.checks, 0),
      reads: results.reduce((sum, result) => sum + result.reads, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
