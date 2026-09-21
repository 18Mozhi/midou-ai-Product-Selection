import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { topologyPagePlugin, topologyPageSources } from "./lib/topology-page-preview.mjs";
import { topologyFixtureFile, topologyPolicyFile } from "./lib/topology-review-fixtures.mjs";
import { topologyAlertFixtures, topologyAlertSources } from "./lib/topology-alert-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length ? path.resolve(`output/playwright/p66-alert-queue-${args[1]}`) : null;
if (output) await mkdir(output);
const { cases, nav, clock, policies } = await topologyAlertFixtures(),
  probe = reservePort();
const envelope = (data) => ({
  data,
  request_id: "p66-local-fixture",
  trace_id: "p66-local-fixture",
});
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
    ...topologyAlertSources,
    topologyFixtureFile,
    topologyPolicyFile,
    "scripts/lib/topology-review-fixtures.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "scripts/lib/ui-imported-style-sources.mjs",
    "scripts/verify-topology-alert-queue.mjs",
    "apps/web/vite.config.ts",
    "apps/api/src/runtime-topology-service.ts",
  ]),
  images = [],
  results = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P66 actual Vue review ${origin}`);
  for (const { width, motion } of [1440, 390].flatMap((width) =>
    ["reduce", "no-preference"].map((motion) => ({ width, motion })),
  )) {
    const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: motion,
      }),
      page = await context.newPage(),
      requests = [],
      unexpected = [],
      errors = [];
    context.setDefaultTimeout(8000);
    let current = cases[0].data,
      checks = 0;
    const check = (a, b, label) => {
      assert.deepEqual(a, b, `${width}: ${label}`);
      checks++;
    };
    const capture = async (name, locator) => {
      await page.evaluate(() => document.fonts.ready);
      if (locator) {
        await locator.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        const issues = await locator.evaluate((el) =>
          [...el.querySelectorAll("h2,h3,dt,dd,button,summary,code,strong,p,time,b,small,a,span")]
            .filter((n) => n.checkVisibility())
            .flatMap((n) => {
              const r = n.getBoundingClientRect(),
                hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              return r.top < 0 ||
                r.bottom > innerHeight ||
                r.left < 0 ||
                r.right > innerWidth ||
                (!n.contains(hit) && !hit?.contains(n))
                ? [{ text: n.textContent.slice(0, 60), bounds: r.toJSON(), hit: hit?.className }]
                : [];
            }),
        );
        assert.deepEqual(issues, [], width + " capture visible region " + name);
      }
      if (!output || motion !== "reduce") return;
      const b = locator
        ? await locator.screenshot({ animations: "disabled" })
        : await page.screenshot({ fullPage: true, animations: "disabled" });
      const file = width + "-" + name + ".png";
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
        requests.push({ method: req.method(), body: req.postData() });
        return route.fulfill({ json: envelope(current) });
      });
      await page.goto(origin + "/platform-admin/topology");

      const surface = page.locator(".topology-center--review");
      const refresh = surface.getByRole("button", { name: "刷新运行事实", exact: true });
      await surface.locator(".topology-verdict").waitFor();

      const titles = {
        worker_scheduler_heartbeat_stale: "任务调度观测需核对",
        worker_scheduler_backpressure: "任务调度发生背压",
        worker_scheduler_recent_failures: "最近一分钟存在失败",
        worker_scheduler_suspected_stuck: "存在疑似卡死任务",
        worker_scheduler_queue_circuit_open: "队列连续失败已熔断",
        worker_scheduler_snapshot_publish_failed: "调度状态写入失败",
        worker_business_result_failed: "业务处理返回失败",
        backend_restart_loop: "后端连续重启",
      };
      const trim = (s) => s.replace(/\s+/g, " ").trim();
      for (const [i, row] of cases.entries()) {
        if (i) {
          current = row.data;
          const before = requests.length;
          await refresh.click();
          await page.waitForFunction(
            () =>
              document.querySelector(".topology-hero button")?.getAttribute("aria-busy") ===
              "false",
          );
          check(requests.length - before, 1, row.id + " one explicit local read");
        }
        const data = row.data,
          queues = data.worker_scheduler.queues;
        check(
          await surface.locator(".topology-verdict").getAttribute("data-verdict"),
          data.state,
          row.id + " current verdict not merged with alerts",
        );
        check(
          (await surface.locator(".p66-summary dd").allTextContents()).map(trim),
          [
            data.active_api_instances,
            data.stale_node_count,
            data.alerts.length,
            data.blockers.length,
          ].map(String),
          row.id + " exact summary",
        );
        await capture(row.id + "-summary", surface.locator(".p66-summary"));
        const alerts = surface.locator(".topology-alerts article");
        check(await alerts.count(), data.alerts.length, row.id + " exact alert count");
        for (const [j, item] of data.alerts.entries()) {
          const entry = alerts.nth(j);
          check(
            await entry.getAttribute("data-severity"),
            item.severity,
            row.id + " severity preserved",
          );
          check(
            await entry.locator(":scope > strong").textContent(),
            titles[item.code],
            row.id + " specific alert label",
          );
          check(
            trim(await entry.locator(":scope > p").textContent()),
            item.actionHint,
            row.id + " producer hint",
          );
          const queueGroup = entry
            .locator(".topology-alert-associations")
            .filter({ has: page.locator("span", { hasText: "关联队列" }) });
          check(
            await queueGroup.locator("b").count(),
            item.queues.length,
            row.id + " exact queue association count",
          );
          check(
            (await queueGroup.locator("b").allTextContents()).includes("后台任务"),
            false,
            row.id + " known queue not generic",
          );
          if (item.queues.includes("automatic_selection_evaluation"))
            check(
              await queueGroup.locator("b").textContent(),
              "自动质量评估",
              "nineteenth alert queue label",
            );
          const objects = entry
            .locator(".topology-alert-associations")
            .filter({ has: page.locator("span", { hasText: "关联业务对象" }) });
          check(
            await objects.locator(":scope > a, :scope > b").count(),
            item.business_objects.length,
            row.id + " no invented objects",
          );
          check(
            await objects
              .locator("a")
              .evaluateAll((els) => els.map((el) => el.getAttribute("href"))),
            item.business_objects.filter((o) => o.href).map((o) => o.href),
            row.id + " current normalizer links only",
          );
          await entry.locator("summary").press("Enter");
          check(
            await entry.locator("details").getAttribute("open"),
            "",
            row.id + " keyboard opens details",
          );
          check(
            (await entry.locator("code").allTextContents()).map(trim),
            [
              item.code,
              ...(item.root_cause_code ? ["root_cause " + item.root_cause_code] : []),
              ...item.business_objects.map((o) => o.type + " " + o.id),
            ],
            row.id + " exact code root cause full object identity",
          );
          await capture(row.id + "-alert-" + (j + 1), entry);
          await entry.locator("summary").press("Enter");
          check(
            await entry.locator("details").getAttribute("open"),
            null,
            row.id + " keyboard closes details",
          );
          for (const link of await objects.locator("a").all()) {
            await link.hover();
            await page.waitForFunction(
              () => {
                const el = document.querySelector(".topology-alert-associations a:hover");
                return el && getComputedStyle(el).backgroundColor === "rgb(239, 244, 252)";
              },
              undefined,
              { timeout: 2000 },
            );
            check(
              await link.evaluate((el) => ({
                height: el.getBoundingClientRect().height >= 44,
                underline: getComputedStyle(el).textDecorationLine.includes("underline"),
                color: getComputedStyle(el).color,
              })),
              { height: true, underline: true, color: "rgb(23, 72, 160)" },
              row.id + " C link distinct from plain association",
            );
            await entry.locator("summary").press("Shift+Tab");
            await page.waitForFunction(
              () => {
                const el = document.activeElement;
                return (
                  el?.matches(".topology-alert-associations a:focus-visible") &&
                  getComputedStyle(el).outlineColor === "rgb(23, 72, 160)"
                );
              },
              undefined,
              { timeout: 2000 },
            );
            check(
              await link.evaluate((el) => ({
                active: document.activeElement === el,
                focusVisible: el.matches(":focus-visible"),
                color: getComputedStyle(el).outlineColor,
                width: getComputedStyle(el).outlineWidth,
              })),
              { active: true, focusVisible: true, color: "rgb(23, 72, 160)", width: "3px" },
              row.id + " association keyboard focus",
            );
            await capture(row.id + "-association-focus", entry);
          }
        }
        const rows = surface.locator(".topology-queue-list > article");
        const exceptional = queues.filter(
          (q) =>
            q.running ||
            q.due ||
            q.consecutive_failures > 0 ||
            q.suspected_stuck ||
            q.circuit_state === "open",
        );
        check(await rows.count(), exceptional.length, row.id + " original exceptional filter");
        if (row.id === "all-idle") {
          await capture("idle-hidden", surface.locator(".topology-queue-empty"));
          const toggle = surface.getByRole("button", {
            name: "查看全部 19 个队列策略",
            exact: true,
          });
          await toggle.press("Space");
          check(
            await surface
              .locator(".topology-scheduler-actions button")
              .getAttribute("aria-expanded"),
            "true",
            "all-policy expansion state",
          );
          check(await rows.count(), 19, "all nineteen policies");
          for (const [j, q] of queues.entries()) {
            const entry = rows.nth(j);
            check(
              (await entry.locator(":scope > span").first().locator("b").textContent()) !==
                "后台任务",
              true,
              q.name + " known label",
            );
            await entry.locator("summary").press("Enter");
            check(
              await entry.locator(".p66-queue-code").textContent(),
              q.name,
              q.name + " exact technical identity",
            );
            check(
              trim(await entry.locator("details small").textContent()).includes(
                "超时 " + policies[q.name].timeoutMs + " ms",
              ),
              true,
              q.name + " registered timeout",
            );
            if (j === 18) {
              check(
                await entry.locator(":scope > span").first().locator("b").textContent(),
                "自动质量评估",
                "nineteenth list queue label",
              );
              await capture("nineteenth-policy", entry);
            }
            await entry.locator("summary").press("Enter");
          }
          await surface.getByRole("button", { name: "仅看运行与异常", exact: true }).press("Space");
          check(await rows.count(), 0, "restore original local filter");
        }
        if (
          row.id.startsWith("queue-") ||
          ["backpressure", "recent-failures", "suspected-stuck", "circuit-open"].includes(row.id)
        ) {
          for (const [j, q] of exceptional.entries()) {
            const entry = rows.nth(j),
              boost = Math.max(0, q.effective_priority - q.priority);
            const risk = Boolean(
              q.due &&
              !q.running &&
              q.queue_delay_ms > 0 &&
              q.maximum_aging_boost > 0 &&
              boost >= q.maximum_aging_boost,
            );
            check(
              await entry.locator(".topology-queue-aging").getAttribute("data-risk"),
              String(risk),
              row.id + " exact starvation formula",
            );
            check(
              await entry.locator(":scope > span").nth(1).locator("b").textContent(),
              q.circuit_state === "open"
                ? "已熔断"
                : q.suspected_stuck
                  ? "疑似卡死"
                  : q.running
                    ? "执行中"
                    : q.due
                      ? "等待中"
                      : "空闲",
              row.id + " queue status priority",
            );
            await entry.locator("summary").press("Enter");
            check(
              await entry.locator(".p66-queue-code").textContent(),
              q.name,
              row.id + " complete queue name",
            );
            await capture(row.id + "-queue-" + (j + 1), entry);
            await entry.locator("summary").press("Enter");
          }
        }
        const snapshot = surface.locator(".topology-scheduler > details");
        check(
          await snapshot.count(),
          data.worker_scheduler.snapshot_publish_failed_total ? 1 : 0,
          row.id + " optional snapshot error disclosure",
        );
        if (data.worker_scheduler.snapshot_publish_failed_total) {
          await snapshot.locator("summary").press("Enter");
          check(
            await snapshot.locator("code").textContent(),
            data.worker_scheduler.last_snapshot_error || "写入失败",
            row.id + " exact snapshot error or fallback",
          );
          await capture(row.id + "-snapshot-error", snapshot);
          await snapshot.locator("summary").press("Enter");
        }
        check(requests.length, i + 1, row.id + " local controls add no reads");
        check(
          await surface.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          true,
          row.id + " no horizontal page overflow",
        );
      }
      check(unexpected, [], "no production/write/external/download request");
      check(errors, [], "no browser exceptions");
      results.push({ width, motion, checks, requests });
      console.log(JSON.stringify({ width, motion, checks }));
    } finally {
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
  if (output) {
    const sourceHashes = Object.fromEntries(
      await Promise.all(
        [...sources].sort().map(async (file) => [file, hash(await readFile(file))]),
      ),
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
            "actual Vue C review; 29 cases generated by current Worker outcome normalizer and RuntimeTopologyService with inert snapshots; current queue display formulas and all19 labels; no live scheduler, SQL, probes, navigation or audit",
          clock,
          cases,
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P66服务拓扑审核</title>' +
        "<style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#182739}" +
        "img{max-width:100%;border:1px solid #c7d3e4;display:block}article{margin:28px 0}</style>" +
        "<h1>P66 队列与告警待审</h1><p>本地样例，只读展示；未执行探测、调度或重启，不代表真实权限或生产验收。</p>" +
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
