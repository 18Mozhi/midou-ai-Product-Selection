import assert from "node:assert/strict";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { backupPagePlugin } from "./lib/backup-page-preview.mjs";
import { backupReviewFixtures } from "./lib/backup-review-fixtures.mjs";
import { statusReviewFixtures } from "./lib/status-review-fixtures.mjs";

// Observations, not an acceptance gate for the observed lifecycle policy.
// No production APIs, files, clipboard writes, backups or restores.
assert.equal(process.argv.length, 2, "No arguments; diagnostic emits JSON only");
const { fixture, nav } = await backupReviewFixtures();
const status = (await statusReviewFixtures()).fixture;
const envelope = (data, id = "local-backup-seed") => ({ data, request_id: id, trace_id: id });
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [backupPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P64 read lifecycle diagnostic ${origin}`);
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
      acceptDownloads: false,
    });
    context.setDefaultTimeout(8000);
    const page = await context.newPage(),
      requests = [],
      unexpected = [],
      errors = [],
      observation = { width };
    let held,
      mode = "success";
    const navigate = async (target) => {
      await page.evaluate(async (target) => {
        const { router } = await import("/src/router.ts");
        await router.push(target);
      }, target);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
    };
    const readReference = () =>
      page.evaluate(() => {
        const root = window.__backupDiagnosticElement;
        return {
          path: location.pathname,
          connected: root.isConnected,
          state:
            root.querySelector(".truth-banner")?.getAttribute("data-kind") ??
            root.querySelector(".state-card")?.getAttribute("data-kind"),
          snapshotId: root.querySelector("footer .technical-details code")?.textContent ?? null,
          failureId:
            root.querySelector(
              ".refresh-notice .technical-details code, .state-card .technical-details code",
            )?.textContent ?? null,
          busy: root.querySelector(".backup-read-action")?.getAttribute("aria-busy"),
          dialogs: document.querySelectorAll(".responsive-data-view__overlay").length,
          inertBodyChildren: [...document.body.children]
            .filter((el) => el.inert)
            .map((el) => el.id || el.tagName),
        };
      });
    const release = async (response) => {
      assert.ok(held, "controlled request is live");
      const route = held;
      held = null;
      await route.fulfill(response);
      await page.waitForFunction(
        () =>
          window.__backupDiagnosticElement
            .querySelector(".backup-read-action")
            ?.getAttribute("aria-busy") === "false",
        null,
        { timeout: 5000 },
      );
    };
    try {
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("download", () => unexpected.push("download"));
      page.on("requestfailed", (request) => {
        const entry = requests.find(
          (item) => item.outgoingId === request.headers()["x-request-id"],
        );
        if (entry) entry.failed = request.failure()?.errorText;
      });
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          key = `${req.method()} ${url.pathname}`;
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
        if (
          key === "GET /api/v1/platform/management" &&
          url.searchParams.get("domain") === "status"
        )
          return route.fulfill({ json: envelope(status) });
        if (key !== "GET /api/v1/platform/operations/backup-recovery" || url.search) {
          unexpected.push(key);
          return route.abort();
        }
        requests.push({ mode, outgoingId: req.headers()["x-request-id"], body: req.postData() });
        if (mode === "hold") {
          if (held != null) {
            unexpected.push("overlapping-local-read");
            return route.abort();
          }
          held = route;
          return;
        }
        return route.fulfill({ json: envelope(fixture) });
      });
      const target = "/platform-admin/operations",
        away = "/platform-admin/status";
      await page.goto(origin + target);
      const surface = page.locator(".backup-center--review"),
        refresh = surface.getByRole("button", { name: "刷新事实", exact: true });
      await surface.locator(".truth-banner").waitFor();
      await surface.evaluate((el) => {
        window.__backupDiagnosticElement = el;
      });
      await navigate(away);
      observation.idleAway = await readReference();
      await navigate(target);
      observation.idleReturn = { ...(await readReference()), reads: requests.length };
      for (const [name, response] of [
        [
          "lateSuccess",
          {
            json: envelope(
              { ...fixture, observed_at: "2026-09-15T08:00:00Z" },
              "local-late-success",
            ),
          },
        ],
        [
          "lateFailure",
          {
            status: 400,
            json: {
              request_id: "local-late-failure",
              error: {
                code: "local_unavailable",
                message: "本地迟到失败",
                action_hint: "本地诊断失败，无真实恢复操作。",
              },
            },
          },
        ],
        [
          "lateForbidden",
          {
            status: 403,
            json: {
              request_id: "local-late-forbidden",
              error: { code: "forbidden", message: "本地拒绝", action_hint: "本地权限样例。" },
            },
          },
        ],
      ]) {
        mode = "hold";
        await refresh.click();
        await surface.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
        const deadline = Date.now() + 5000;
        while (!held && Date.now() < deadline)
          await new Promise((resolve) => setTimeout(resolve, 20));
        assert.ok(held, "one controlled read reached local fixture");
        await navigate(away);
        const before = {
          ...(await readReference()),
          requestFailed: requests.at(-1).failed ?? null,
        };
        await release(response);
        const after = await readReference();
        await navigate(target);
        observation[name] = {
          before,
          after,
          returned: { ...(await readReference()), reads: requests.length },
        };
      }
      mode = "success";
      await refresh.click();
      await surface.locator(".truth-banner").waitFor();
      if (width === 390) {
        await surface
          .locator("#p64-assets")
          .getByRole("button", { name: /数据库完整备份/ })
          .click();
        await page.getByRole("dialog", { name: "数据库完整备份", exact: true }).waitFor();
        observation.detailBefore = await readReference();
        // Programmatic router navigation models route replacement, not clicking inert background.
        await navigate(away);
        observation.detailAway = await readReference();
        await navigate(target);
        observation.detailReturn = await readReference();
      } else {
        const menu = surface.locator(".table-view-controls__toolbar details");
        await menu.locator("summary").click();
        await navigate(away);
        await navigate(target);
        observation.columnDisclosureAfterReturn = (await menu.getAttribute("open")) !== null;
      }
      assert.deepEqual(unexpected, [], "local read-only diagnostic");
      assert.deepEqual(errors, [], "no browser errors");
      observation.requests = requests;
      results.push(observation);
      console.log(JSON.stringify(observation));
    } finally {
      if (held) await held.abort().catch(() => {});
      await context.close();
    }
  }
  console.log(
    JSON.stringify({ diagnosticOnly: true, groups: results.length, filesWritten: 0, port }),
  );
} finally {
  await browser?.close();
  await server.close();
}
