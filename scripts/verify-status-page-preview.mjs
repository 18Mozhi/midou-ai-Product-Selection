import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { statusPagePlugin, statusPageSources } from "./lib/platform-status-page-preview.mjs";
import {
  statusReviewFixtures,
  statusEnvelope,
  statusFixtureFile,
} from "./lib/status-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
  "Use no arguments or --capture-review rN",
);
const output = args.length
  ? path.resolve(`output/playwright/p61-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output);
const { fixture, metrics, nav } = await statusReviewFixtures(),
  probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [statusPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
    ...statusPageSources,
    statusFixtureFile,
    "scripts/lib/status-review-fixtures.mjs",
    "scripts/verify-status-page-preview.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "apps/web/vite.config.ts",
  ]),
  results = [],
  images = [],
  hash = (b) => createHash("sha256").update(b).digest("hex");
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log("P61 actual Vue review " + origin);
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: "reduce",
      }),
      page = await context.newPage(),
      requests = [],
      unexpected = [],
      errors = [];
    let current = structuredClone(fixture),
      failed = false,
      pending,
      hold = false,
      checks = 0;
    const check = (a, b, m) => {
      assert.deepEqual(a, b, width + ": " + m);
      checks++;
    };
    const capture = async (name, locator, viewport = false) => {
      if (!output) return;
      await page.evaluate(() => document.fonts.ready);
      const b = locator
        ? await locator.screenshot({ animations: "disabled" })
        : await page.screenshot({ fullPage: !viewport, animations: "disabled" });
      const file = `${width}-${name}.png`;
      await writeFile(path.join(output, file), b);
      images.push({
        file,
        sha256: hash(b),
        pixelWidth: b.readUInt32BE(16),
        pixelHeight: b.readUInt32BE(20),
        scope: "actual Vue review; synthetic GET data; pending approval",
      });
    };
    try {
      await page.addInitScript(
        (m) => sessionStorage.setItem("scoutops:realtime-client-metrics", JSON.stringify(m)),
        metrics,
      );
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          unexpected.push("external");
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const key = req.method() + " " + url.pathname;
        if (key === "GET /api/v1/me/navigation")
          return route.fulfill({ json: statusEnvelope(nav) });
        if (key === "GET /api/v1/auth/session-status")
          return route.fulfill({ json: statusEnvelope({ authenticated: true }) });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({
            status: 503,
            json: { error: { code: "local_preferences_unavailable" } },
          });
        if (
          key !== "GET /api/v1/platform/management" ||
          url.searchParams.get("domain") !== "status"
        ) {
          unexpected.push(key);
          return route.abort();
        }
        requests.push({ key, search: url.search, body: req.postData() });
        if (hold) {
          pending = route;
          hold = false;
          return;
        }
        return route.fulfill(
          failed
            ? {
                status: 503,
                json: {
                  error: { message: "本地状态读取失败", action_hint: "本地读取暂不可用。" },
                  request_id: "p61-read-failed",
                },
              }
            : { json: statusEnvelope(current) },
        );
      });
      await page.goto(origin + "/platform-admin/status");
      const surface = page.locator(".platform-management--status-review"),
        workspace = surface.locator(".p61-workspace"),
        refresh = surface.getByRole("button", { name: "刷新数据", exact: true });
      await workspace.waitFor();
      for (const [key, title] of [
        ["attention", "需核查"],
        ["dependencies", "依赖目录"],
        ["session", "浏览器会话"],
        ["activity", "业务汇总"],
      ]) {
        const button = surface.locator(`[data-status-view="${key}"]`);
        await button.click();
        const panel = surface.locator(`#p61-panel-${key}`);
        check(await panel.isVisible(), true, "selected panel visible");
        check(
          await surface.locator(".p61-panel:visible").count(),
          1,
          "only one visible work region",
        );
        check(
          await surface.locator('.p61-directory [aria-pressed="true"]').count(),
          1,
          "one selected native button",
        );
        check(
          await panel.getByRole("heading", { name: title, exact: true, level: 2 }).count(),
          1,
          "named work region",
        );
        check(await surface.locator("h1").count(), 1, "one main heading");
        check(await page.locator(".role-page-title").count(), 0, "no duplicate shell heading");
        check(requests.length, 1, "local switch sends no GET");
        check(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          "no horizontal overflow",
        );
        if (key === "attention") {
          check(
            await panel.locator(".platform-propagation-alert").count(),
            2,
            "two actual warnings",
          );
          check(
            (await panel.innerText()).includes("如异常持续"),
            true,
            "conditional propagation not actual failures",
          );
        }
        if (key === "dependencies") {
          check(
            await panel.locator(".platform-topology-node").count(),
            6,
            "six original dependencies",
          );
        }
        if (key === "session")
          check((await panel.innerText()).includes("20.00%"), true, "original browser-only rate");
        if (key === "activity")
          check(
            await panel.locator(".platform-management-kpis article").count(),
            5,
            "all original summary values",
          );
        await page.evaluate(() => scrollTo(0, 0));
        await capture(key);
        if (width === 390) await capture(key + "-viewport", null, true);
        if (key === "attention") {
          await panel.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await capture("attention-region", panel);
        }
      }
      const hrefs = await workspace
        .locator("a")
        .evaluateAll((ns) => [...new Set(ns.map((n) => n.getAttribute("href")))].sort());
      check(
        hrefs,
        [
          "/platform-admin/collection/overview",
          "/platform-admin/crawler-scheduler",
          "/platform-admin/files",
          "/platform-admin/mysql",
          "/platform-admin/providers/sources",
          "/platform-admin/redis",
          "/platform-admin/topology",
        ].sort(),
        "seven actual management destinations",
      );
      await surface.locator('[data-status-view="attention"]').focus();
      await page.keyboard.press("Enter");
      check(
        await surface.locator("#p61-panel-attention").isVisible(),
        true,
        "keyboard switches view",
      );
      const summary = surface.locator("footer summary");
      await summary.focus();
      await page.keyboard.press("Space");
      check(
        await surface.locator("footer details").getAttribute("open"),
        "",
        "keyboard opens trace",
      );
      await capture("technical", surface.locator(":scope > footer"));
      hold = true;
      await refresh.click();
      await surface.getByRole("button", { name: "刷新中…", exact: true }).waitFor();
      check(await workspace.isVisible(), true, "busy retains workspace");
      check(
        await surface.getByRole("button", { name: "刷新中…", exact: true }).isDisabled(),
        true,
        "original busy disabled",
      );
      await capture("refresh-busy");
      assert.ok(pending);
      await pending.fulfill({
        status: 503,
        json: { error: { message: "本地状态读取失败" }, request_id: "p61-read-failed" },
      });
      pending = null;
      failed = true;
      await surface.locator(".platform-management-message").waitFor();
      check(
        (await surface.locator(".platform-management-message").innerText()).includes(
          "已保留上次成功数据",
        ),
        true,
        "retained read failure",
      );
      await capture("refresh-failed");
      failed = false;
      await refresh.click();
      await surface.locator(".platform-management-message").waitFor({ state: "detached" });
      check(
        await surface.locator(".platform-propagation-alert").count(),
        2,
        "recovery does not erase observed warnings",
      );
      check(
        JSON.parse(
          await page.evaluate(() => sessionStorage.getItem("scoutops:realtime-client-metrics")),
        ),
        metrics,
        "management refresh leaves session metrics unchanged",
      );
      current = { ...structuredClone(fixture), services: [] };
      await refresh.click();
      await surface.getByText("需核查依赖 6 项", { exact: true }).waitFor();
      check(
        await surface.locator(".platform-propagation-alert").count(),
        6,
        "missing observations are unknown warnings",
      );
      await capture("missing-observations");
      current = structuredClone(fixture);
      current.services = current.services.map((s) => ({ ...s, status: "ready" }));
      await refresh.click();
      await surface.locator(".platform-propagation-empty").waitFor();
      await capture("no-warnings");
      check(requests.length, 7, "initial,three retry attempts,recovery,missing,no-warning GETs");
      check(errors, [], "no browser errors");
      check(unexpected, [], "no unknown/external requests");
      results.push({ width, checks, requests });
      console.log(`P61 ${width} passed ${checks}`);
    } finally {
      if (pending) await pending.abort().catch(() => {});
      await context.close();
    }
  }
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const f = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (f && !f.startsWith("..") && !f.includes("node_modules") && /\.(vue|ts|css|json)$/.test(f))
      sources.add(f);
  }
  await includeImportedStyleSources(sources, (f) => readFile(f, "utf8"));
  if (output) {
    const sourceHashes = Object.fromEntries(
      await Promise.all([...sources].sort().map(async (f) => [f, hash(await readFile(f))])),
    );
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P61",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "actual Vue review-only layout;original status script/slots and GET semantics;synthetic data and isolated browser session;not production",
          sources: sourceHashes,
          images,
          results,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      path.join(output, "index.html"),
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P61 C实际Vue审核</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#17253c}img{display:block;max-width:100%;border:1px solid #c7d3e4}article{margin:28px 0}</style><h1>P61 C实际Vue待审</h1><p>合成状态、非生产观测；未部署。完整布局/控件及真实权限仍待验。</p>' +
        images
          .map(
            (i) =>
              `<article><h2>${i.file}</h2><img src="${i.file}" alt="${i.file} 待审"></article>`,
          )
          .join("\n") +
        "</html>",
    );
  }
  console.log(
    JSON.stringify({
      groups: results.length,
      checks: results.reduce((n, r) => n + r.checks, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
