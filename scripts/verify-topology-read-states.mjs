import assert from "node:assert/strict";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { chromium } from "playwright";
import { topologyPagePlugin, topologyPageSources } from "./lib/topology-page-preview.mjs";
import {
  topologyReviewFixtures,
  topologyFixtureFile,
  topologyPolicyFile,
} from "./lib/topology-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length ? path.resolve(`output/playwright/p66-read-states-${args[1]}`) : null;
if (output) await mkdir(output);
const { fixture, nav } = await topologyReviewFixtures(),
  probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
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
    "scripts/verify-topology-read-states.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "apps/web/vite.config.ts",
  ]),
  images = [],
  results = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const envelope = (data, id = "p66-local-snapshot") => ({ data, request_id: id, trace_id: id });
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P66 actual Vue read states ${origin}`);
  const cases = [1440, 390].flatMap((width) =>
    ["reduce", "no-preference"].map((motion) => ({ width, motion })),
  );
  const outcomes = await Promise.allSettled(
    cases.map(async ({ width, motion }) => {
      const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          locale: "zh-CN",
          reducedMotion: motion,
        }),
        page = await context.newPage(),
        requests = [],
        held = [],
        unexpected = [],
        errors = [];
      context.setDefaultTimeout(8000);
      let mode = "hold",
        checks = 0;
      const check = (a, b, label) => {
        assert.deepEqual(a, b, `${width}/${motion}: ${label}`);
        checks++;
      };
      const capture = async (name, locator) => {
        await page.evaluate(() => document.fonts.ready);
        await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        const issues = await locator.evaluate((el) =>
          [...el.querySelectorAll("h1,h2,h3,p,code,button,a,summary")]
            .filter((n) => n.checkVisibility())
            .flatMap((n) => {
              const r = n.getBoundingClientRect(),
                hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              return r.top < 0 ||
                r.bottom > innerHeight ||
                r.left < 0 ||
                r.right > innerWidth ||
                (!n.contains(hit) && !hit?.contains(n))
                ? [n.textContent]
                : [];
            }),
        );
        check(issues, [], "visible state region " + name);
        check(
          await locator.evaluate((el) =>
            [...el.querySelectorAll("button,a,summary")]
              .filter((control) => control.checkVisibility())
              .every((control) => {
                const rect = control.getBoundingClientRect();
                const hit = document.elementFromPoint(
                  rect.x + rect.width / 2,
                  rect.y + rect.height / 2,
                );
                return hit !== null && (control === hit || control.contains(hit));
              }),
          ),
          true,
          "visible controls not occluded: " + name,
        );
        if (!output || motion !== "reduce") return;
        await page.evaluate(() => document.fonts.ready);
        const b = await locator.screenshot({ animations: "disabled" }),
          file = `${width}-${name}.png`;
        await writeFile(path.join(output, file), b);
        images.push({
          file,
          sha256: hash(b),
          pixelWidth: b.readUInt32BE(16),
          pixelHeight: b.readUInt32BE(20),
        });
      };
      try {
        page.on("pageerror", (e) => errors.push(e.message));
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
          if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: envelope(nav) });
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: envelope({ authenticated: true }) });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({ status: 503, json: { error: { code: "local_preferences" } } });
          if (key !== "GET /api/v1/platform/operations/topology" || url.search) {
            unexpected.push(key + url.search);
            return route.abort();
          }
          requests.push({
            mode,
            body: req.postData(),
            at: Date.now(),
            requestId: req.headers()["x-request-id"],
          });
          if (mode === "hold") {
            held.push(route);
            return;
          }
          if (mode === "success" || mode === "empty")
            return route.fulfill({
              json: envelope(
                mode === "success"
                  ? fixture
                  : {
                      ...fixture,
                      state: "empty",
                      nodes: [],
                      active_api_instances: 0,
                    },
              ),
            });
          return route.fulfill({
            status: Number(mode),
            json: {
              error: {
                code: "local_read_" + mode,
                message: "本地读取失败",
                action_hint: "本地样例：请按现有权限和运行状态核对。",
              },
              request_id: "p66-local-failure-" + mode,
            },
          });
        });
        await page.addInitScript(() => {
          window.__topologyCopyWrites = [];
          window.__topologyCopyReject = false;
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
              writeText: async (value) => {
                window.__topologyCopyWrites.push(value);
                if (window.__topologyCopyReject) throw new Error("local clipboard denial");
              },
            },
          });
        });
        await page.goto(origin + "/platform-admin/topology");
        const surface = page.locator(".topology-center--review"),
          state = surface.locator(".topology-state"),
          notice = surface.locator(".topology-refresh-notice"),
          header = surface.locator(".topology-hero"),
          truth = surface.locator(".topology-verdict"),
          refresh = () => header.getByRole("button");
        const trace = async (host, expected) => {
          const details = host.locator(".technical-details");
          check(
            await details.locator("code").textContent(),
            expected,
            "trace belongs to this result",
          );
          const summary = details.locator("summary");
          if ((await details.getAttribute("open")) === null) await summary.click();
        };
        const snapshotTrace = async () => {
          check(
            await surface.locator(".topology-footer .technical-details code").textContent(),
            "p66-local-snapshot",
            "retained snapshot keeps successful request identity",
          );
        };
        await state.getByRole("heading", { name: "正在读取单机运行事实", exact: true }).waitFor();
        check(await state.getAttribute("aria-busy"), "true", "loading region busy");
        check(
          await surface.getByRole("region", { name: "正在读取单机运行事实", exact: true }).count(),
          1,
          "named loading region",
        );
        check(
          await refresh().getAttribute("aria-disabled"),
          "true",
          "busy refresh is aria-disabled and handler guarded",
        );
        check(await truth.count(), 0, "no fabricated initial snapshot");
        await capture("initial-loading", state);
        await state
          .getByRole("heading", { name: "读取运行事实超时", exact: true })
          .waitFor({ timeout: 22000 });
        check(
          Date.now() - requests[0].at >= 14000,
          true,
          "real original 15s timeout, no clock acceleration",
        );
        check(requests.length, 1, "abort stops safe retries");
        check(await state.getAttribute("aria-busy"), "false", "timeout clears region busy");
        check(
          (await state.innerText()).includes("保留"),
          false,
          "initial timeout does not claim prior facts",
        );
        check(
          await state
            .getByText("本次请求已在 15 秒后停止，请检查服务状态再重试。", { exact: true })
            .count(),
          1,
          "timeout recovery does not suggest a login failure",
        );
        await trace(state, requests.at(-1).requestId);
        check(
          await state
            .getByRole("button", { name: "重新核验", exact: true })
            .evaluate((el) => getComputedStyle(el).borderTopColor),
          "rgb(23, 72, 160)",
          "C retry border does not inherit orange",
        );
        await capture("initial-timeout", state);
        const firstFailure = async (code, name, attempts, image) => {
          mode = code;
          const before = requests.length;
          await refresh().click();
          await state.getByRole("heading", { name, exact: true }).waitFor();
          check(requests.length - before, attempts, "original safe retry count " + code);
          check(
            await surface.getAttribute("data-state"),
            { 503: "unavailable", 429: "rate_limited", 403: "forbidden", 401: "expired" }[code],
            "failure mapping",
          );
          check(
            await surface.locator(".p66-summary").count(),
            0,
            "first failure has no topology metrics",
          );
          check(await state.getAttribute("aria-busy"), "false", "settled named failure not busy");
          await trace(state, "p66-local-failure-" + code);
          check(
            await surface.locator(".topology-footer").count(),
            0,
            "no snapshot trace on first failure",
          );
          await capture(image, state);
        };
        await firstFailure("503", "运行状态暂不可用", 3, "initial-unavailable");
        await firstFailure("429", "刷新过于频繁", 3, "initial-rate-limited");
        await firstFailure("403", "没有平台运维权限", 1, "initial-forbidden");
        check(
          await state.getByRole("button", { name: "重新核验", exact: true }).count(),
          1,
          "original forbidden retry remains available",
        );
        await firstFailure("401", "登录已失效", 1, "initial-expired");
        check(
          await state.getByRole("link", { name: "重新登录", exact: true }).getAttribute("href"),
          "/login",
          "original login target only, not followed",
        );
        mode = "success";
        await refresh().click();
        await truth.waitFor();
        check(
          await surface.locator(".p66-summary").count(),
          1,
          "original E2E snapshot restored without recomputing its verdict",
        );
        check(await state.count(), 0, "failure region removed after successful read");
        await capture("recovered-original", truth);
        mode = "hold";
        const beforeHold = requests.length;
        await refresh().click();
        await header.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
        check(
          await truth.getAttribute("data-verdict"),
          "ready",
          "pending retains service conclusion",
        );
        check(await notice.count(), 0, "no invented pending failure");
        await refresh().evaluate((el) => {
          el.click();
          el.click();
        });
        check(requests.length - beforeHold, 1, "handler guarded refresh does not duplicate read");
        await capture("retained-pending-button", header);
        await notice
          .getByRole("heading", { name: "刷新已超时", exact: true })
          .waitFor({ timeout: 22000 });
        check(Date.now() - requests.at(-1).at >= 14000, true, "retained timeout uses real 15s");
        check(await notice.getAttribute("aria-busy"), "false", "settled refresh notice not busy");
        check(
          (await notice.innerText()).includes("保留上次成功"),
          true,
          "retained timeout identifies prior snapshot",
        );
        check(await surface.locator(".p66-summary").count(), 1, "timeout keeps old metrics");
        await trace(notice, requests.at(-1).requestId);
        await snapshotTrace();
        await capture("retained-timeout", notice);
        await trace(surface.locator(".topology-footer"), "p66-local-snapshot");
        await capture("retained-snapshot-trace", surface.locator(".topology-footer"));
        const snapshotCopy = surface
          .locator(".topology-footer")
          .getByRole("button", { name: "复制请求编号", exact: true });
        await snapshotCopy.click();
        await surface.locator(".topology-footer").getByText("已复制", { exact: true }).waitFor();
        check(
          await page.evaluate(() => window.__topologyCopyWrites.at(-1)),
          "p66-local-snapshot",
          "snapshot copy consumer does not use failure ID",
        );
        await capture("snapshot-copy-success", surface.locator(".topology-footer"));
        await page.evaluate(() => {
          window.__topologyCopyReject = true;
        });
        await snapshotCopy.click();
        await surface.locator(".topology-footer").getByRole("status").waitFor();
        check(
          await surface.locator(".topology-footer").getByRole("status").textContent(),
          "暂时无法复制请求编号，可以选中上方内容后手动复制。",
          "copy denial remains explicit",
        );
        check(
          await page.evaluate(() => window.__topologyCopyWrites.length),
          2,
          "two simulated clipboard attempts only",
        );
        await capture("snapshot-copy-denied", surface.locator(".topology-footer"));
        for (const code of ["503", "429"]) {
          mode = code;
          const before = requests.length;
          await notice.getByRole("button", { name: "重新核验", exact: true }).click();
          await notice.getByRole("heading", { name: "刷新未完成", exact: true }).waitFor();
          check(requests.length - before, 3, "retained safe retries " + code);
          check(
            await truth.getAttribute("data-verdict"),
            "ready",
            "failed refresh cannot replace service conclusion",
          );
          check(await surface.locator(".p66-summary").count(), 1, "retained data after " + code);
          await trace(notice, "p66-local-failure-" + code);
          await snapshotTrace();
          await capture("retained-" + code, notice);
        }
        mode = "403";
        await notice.getByRole("button", { name: "重新核验", exact: true }).click();
        await state.getByRole("heading", { name: "没有平台运维权限", exact: true }).waitFor();
        check(await truth.count(), 0, "403 clears prior conclusion");
        check(await surface.locator(".p66-summary").count(), 0, "403 clears old metrics");
        check(await notice.count(), 0, "403 is not a retained failure");
        await trace(state, "p66-local-failure-403");
        check(await surface.locator(".topology-footer").count(), 0, "403 clears snapshot trace");
        await capture("cleared-forbidden", state);
        mode = "success";
        await refresh().click();
        await truth.waitFor();
        mode = "401";
        await refresh().click();
        await state.getByRole("heading", { name: "登录已失效", exact: true }).waitFor();
        check(await truth.count(), 0, "401 clears prior conclusion");
        check(await surface.locator(".p66-summary").count(), 0, "401 clears old metrics");
        await trace(state, "p66-local-failure-401");
        check(await surface.locator(".topology-footer").count(), 0, "401 clears snapshot trace");
        await capture("cleared-expired", state);
        mode = "empty";
        await refresh().click();
        await truth.getByText("尚无当前 API 心跳", { exact: true }).waitFor();
        check(
          await surface.getByText("没有当前节点可绘制", { exact: true }).count(),
          1,
          "successful empty read remains empty, not error",
        );
        await capture("recovered-empty", truth);
        check(
          await surface.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          true,
          "no horizontal overflow",
        );
        check(unexpected, [], "no writes/real navigation/downloads/external requests");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks, requests });
        console.log(JSON.stringify({ width, motion, checks, reads: requests.length }));
      } finally {
        for (const route of held) await route.abort().catch(() => {});
        await context.close();
      }
    }),
  );
  const failures = outcomes.filter((r) => r.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((r) => r.reason),
      "P66 read-state checks failed",
    );
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const f = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (f && !f.startsWith("..") && !f.includes("node_modules") && /\.(vue|ts|css|json)$/.test(f))
      sources.add(f);
  }
  await includeImportedStyleSources(sources, (file) => readFile(file, "utf8"));
  images.sort((a, b) => a.file.localeCompare(b.file));
  results.sort((a, b) => a.width - b.width || a.motion.localeCompare(b.motion));
  if (output) {
    const sourceHashes = Object.fromEntries(
      await Promise.all([...sources].sort().map(async (f) => [f, hash(await readFile(f))])),
    );
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P66",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "local actual Vue read states; real 15s timeout; mock permissions, not live acceptance",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P66读取状态审核</title><style>body{font:16px/1.7 Micr' +
        "osoft YaHei;margin:24px;color:#182739}img{max-width:100%;display:block;border:1px solid #c7d3e4}article{margin" +
        ":28px 0}</style><h1>P66 实际Vue读取状态待审</h1><p>本地接口样例，未运行真实探针/调度。四组检查，双端减少动效图；不代表真实权限或完整读屏验收。</p>" +
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
      checks: results.reduce((sum, r) => sum + r.checks, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
