import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { topologyPagePlugin, topologyPageSources } from "./lib/topology-page-preview.mjs";
import {
  topologyReviewFixtures,
  topologyFixtureFile,
  topologyPolicyFile,
} from "./lib/topology-review-fixtures.mjs";
import { statusReviewFixtures } from "./lib/status-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

// Observations, not acceptance of the existing cache/reading policy. No production calls or files.
assert.equal(process.argv.length, 2, "No arguments; diagnostic emits JSON only");
const { fixture, nav } = await topologyReviewFixtures();
const status = (await statusReviewFixtures()).fixture;
const envelope = (data, id = "local-topology-seed") => ({ data, request_id: id, trace_id: id });
const target = "/platform-admin/topology",
  away = "/platform-admin/status";
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [topologyPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
  ...topologyPageSources,
  topologyFixtureFile,
  topologyPolicyFile,
  "scripts/lib/topology-review-fixtures.mjs",
  "scripts/lib/status-review-fixtures.mjs",
  "tests/e2e/m06-02-platform-dashboard.spec.ts",
  "scripts/lib/ui-imported-style-sources.mjs",
  "scripts/diagnose-topology-read-lifecycle.mjs",
  "apps/web/vite.config.ts",
  "apps/api/src/runtime-topology-routes.ts",
  "apps/api/src/runtime-topology-service.ts",
]);
const results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P66 read lifecycle diagnostic ${origin}`);
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
    const frames = () =>
      page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
    const keyboardNavigate = async (destination) => {
      const link = page
        .getByRole("navigation", { name: "系统运维二级导航", exact: true })
        .locator(`a[href="${destination}"]`);
      await link.press("Enter");
      await page.waitForURL(origin + destination);
      await frames();
    };
    const routeReplace = async (destination) => {
      await page.evaluate(async (destination) => {
        const { router } = await import("/src/router.ts");
        await router.push(destination);
      }, destination);
      await frames();
    };
    const readReference = () =>
      page.evaluate(() => {
        const root = window.__topologyDiagnosticElement,
          visibleRoot = document.querySelector(".topology-center--review"),
          active = document.activeElement;
        return {
          path: location.pathname,
          connected: root.isConnected,
          sameVisibleInstance: root === document.querySelector(".topology-center--review"),
          visibleState: visibleRoot?.getAttribute("data-state") ?? null,
          visibleBusy:
            visibleRoot?.querySelector(".topology-read-action")?.getAttribute("aria-busy") ?? null,
          visibleSnapshotId:
            visibleRoot
              ?.querySelector(".topology-footer .technical-details code")
              ?.textContent?.trim() ?? null,
          state: root.getAttribute("data-state"),
          busy: root.querySelector(".topology-read-action")?.getAttribute("aria-busy"),
          snapshotId:
            root.querySelector(".topology-footer .technical-details code")?.textContent?.trim() ??
            null,
          failureId:
            root
              .querySelector(
                ".topology-refresh-notice .technical-details code,.topology-state .technical-details code",
              )
              ?.textContent?.trim() ?? null,
          refreshNotice:
            root
              .querySelector(".topology-refresh-notice")
              ?.textContent?.replace(/\s+/g, " ")
              .trim() ?? null,
          queueExpanded:
            root
              .querySelector(".topology-scheduler-actions button")
              ?.getAttribute("aria-expanded") ?? null,
          policyOpen: root.querySelector(".topology-queue-list article details")?.open ?? null,
          traceOpen: root.querySelector(".topology-footer .technical-details")?.open ?? null,
          active: {
            tag: active?.tagName,
            href: active?.getAttribute("href"),
            text: active?.textContent?.trim().slice(0, 70),
            connected: active?.isConnected,
            visible: active?.checkVisibility(),
            insideTopology: root.contains(active),
            focusVisible: active?.matches(":focus-visible"),
          },
          visibleTopologyCount: document.querySelectorAll(".topology-center--review").length,
          inertBodyChildren: [...document.body.children]
            .filter((el) => el.inert)
            .map((el) => el.id || el.tagName),
        };
      });
    const waitUntil = async (predicate, label, ms = 5000) => {
      const deadline = Date.now() + ms;
      while (!predicate() && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 20));
      assert.ok(predicate(), label);
    };
    const waitSettled = () =>
      page.waitForFunction(
        () =>
          window.__topologyDiagnosticElement
            .querySelector(".topology-read-action")
            ?.getAttribute("aria-busy") === "false",
        null,
        { timeout: 18000 },
      );
    const release = async (response) => {
      assert.ok(held, "controlled request currently held");
      const route = held;
      held = null;
      await route.fulfill(response);
      await waitSettled();
      await frames();
    };
    try {
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("download", () => unexpected.push("download"));
      page.on("requestfailed", (request) => {
        const row = requests.find((x) => x.outgoingId === request.headers()["x-request-id"]);
        if (row) {
          row.failed = request.failure()?.errorText;
          row.failureElapsedMs = Date.now() - row.startedAt;
        }
      });
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          key = req.method() + " " + url.pathname;
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
        if (key !== "GET /api/v1/platform/operations/topology" || url.search) {
          unexpected.push(key + url.search);
          return route.abort();
        }
        requests.push({
          mode,
          outgoingId: req.headers()["x-request-id"],
          body: req.postData(),
          startedAt: Date.now(),
        });
        if (mode === "hold") {
          if (held) {
            unexpected.push("overlapping read");
            return route.abort();
          }
          held = route;
          return;
        }
        return route.fulfill({ json: envelope(fixture) });
      });
      await page.goto(origin + target);
      const surface = page.locator(".topology-center--review"),
        refresh = surface.getByRole("button", { name: "刷新运行事实", exact: true });
      await surface.locator(".topology-verdict").waitFor();
      await surface.evaluate((el) => {
        window.__topologyDiagnosticElement = el;
      });
      await surface.getByRole("button", { name: /查看全部.*个队列策略/ }).press("Space");
      await surface.locator(".topology-queue-list article details summary").first().press("Enter");
      await surface.locator(".topology-footer .technical-details summary").press("Enter");
      observation.idleBefore = await readReference();
      await keyboardNavigate(away);
      observation.idleAway = await readReference();
      await keyboardNavigate(target);
      observation.idleReturn = { ...(await readReference()), reads: requests.length };

      const holdRead = async () => {
        mode = "hold";
        await refresh.click();
        await waitUntil(() => Boolean(held), "controlled local read reached route");
      };
      await holdRead();
      await keyboardNavigate(away);
      observation.pendingAway = {
        ...(await readReference()),
        failed: requests.at(-1).failed ?? null,
      };
      await keyboardNavigate(target);
      observation.pendingReturn = { ...(await readReference()), reads: requests.length };
      await release({ json: envelope(fixture, "local-pending-return") });
      observation.pendingSettled = { ...(await readReference()), reads: requests.length };

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
                action_hint: "本地读取失败样例。",
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
        await holdRead();
        await keyboardNavigate(away);
        const before = { ...(await readReference()), failed: requests.at(-1).failed ?? null };
        await release(response);
        const after = await readReference();
        await keyboardNavigate(target);
        observation[name] = {
          before,
          after,
          returned: { ...(await readReference()), reads: requests.length },
        };
      }
      mode = "success";
      await refresh.click();
      await waitSettled();
      await holdRead();
      await keyboardNavigate(away);
      const timeoutBefore = { ...(await readReference()), failed: requests.at(-1).failed ?? null };
      await waitSettled();
      await waitUntil(
        () => Boolean(requests.at(-1).failed),
        "actual timed-out request failed",
        3000,
      );
      const timeoutAfter = await readReference();
      assert.ok(
        requests.at(-1).failureElapsedMs >= 14000,
        "real fifteen-second timer, not accelerated",
      );
      if (held) {
        await held.abort().catch(() => {});
        held = null;
      }
      await keyboardNavigate(target);
      observation.timeoutAway = {
        before: timeoutBefore,
        after: timeoutAfter,
        returned: { ...(await readReference()), reads: requests.length },
        failureElapsedMs: requests.at(-1).failureElapsedMs,
      };

      // The real catch-all is shell:null. This route replacement models actual unmount, not cache eviction.
      await holdRead();
      await routeReplace("/local-topology-lifecycle-missing");
      await waitUntil(
        () => Boolean(requests.at(-1).failed),
        "actual unmount abort reached browser",
        3000,
      );
      const unmounted = await readReference();
      const unmountRequest = { ...requests.at(-1) };
      if (held) {
        const route = held;
        held = null;
        await route.fulfill({ json: envelope(fixture, "local-after-unmount") }).catch(() => {});
      }
      await frames();
      const afterLate = await readReference();
      mode = "success";
      await routeReplace(target);
      await surface.locator(".topology-verdict").waitFor();
      observation.trueUnmount = {
        unmounted,
        afterLate,
        returned: { ...(await readReference()), reads: requests.length },
        request: unmountRequest,
      };
      assert.deepEqual(
        unexpected,
        [],
        "local diagnostic must not call unrelated APIs or external services",
      );
      assert.deepEqual(errors, [], "no browser exceptions");
      observation.requests = requests;
      results.push(observation);
      console.log(JSON.stringify(observation));
    } finally {
      if (held) await held.abort().catch(() => {});
      await context.close();
    }
  }
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const file = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (
      file &&
      !file.startsWith("..") &&
      !file.includes("node_modules") &&
      /\.(vue|ts|css|json)$/.test(file)
    )
      sources.add(file);
  }
  await includeImportedStyleSources(sources, (file) => readFile(file, "utf8"));
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      [...sources].sort().map(async (file) => [
        file,
        createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
      ]),
    ),
  );
  console.log(
    JSON.stringify({
      diagnosticOnly: true,
      groups: results.length,
      filesWritten: 0,
      port,
      sourceHashes,
      summary: results.map((row) => ({
        width: row.width,
        reads: row.requests.length,
        idleReturnReads: row.idleReturn.reads,
        pendingReturnReads: row.pendingReturn.reads,
        lateSuccessId: row.lateSuccess.returned.snapshotId,
        lateFailureIds: [row.lateFailure.returned.snapshotId, row.lateFailure.returned.failureId],
        forbiddenState: row.lateForbidden.returned.state,
        timeoutMs: row.timeoutAway.failureElapsedMs,
        unmountedRequestFailed: row.trueUnmount.request.failed,
      })),
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
