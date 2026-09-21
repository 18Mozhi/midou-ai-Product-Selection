import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
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
const output = args.length ? path.resolve(`output/playwright/p66-metric-display-${args[1]}`) : null;
if (output) await mkdir(output);
const { fixture, nav, policies } = await topologyReviewFixtures(),
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
    topologyFixtureFile,
    topologyPolicyFile,
    "scripts/lib/topology-review-fixtures.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "scripts/lib/ui-imported-style-sources.mjs",
    "scripts/verify-topology-page-preview.mjs",
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
    let current = structuredClone(fixture),
      failure = false,
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
          [...el.querySelectorAll("h2,h3,dt,dd,button,summary,code")]
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
        if (failure)
          return route.fulfill({
            status: 503,
            json: {
              error: {
                code: "local_topology_unavailable",
                message: "本地读取失败",
                action_hint: "本地测试暂未读取到更新。",
              },
              request_id: "p66-local-read-failure",
            },
          });
        return route.fulfill({ json: envelope(current) });
      });
      await page.goto(origin + "/platform-admin/topology");

      const surface = page.locator(".topology-center--review");
      const refresh = surface.getByRole("button", { name: "刷新运行事实", exact: true });
      await surface.locator(".topology-verdict").waitFor();
      const read = async () => {
        const n = requests.length;
        await refresh.click();
        await page.waitForFunction(
          () =>
            document.querySelector(".topology-hero button")?.getAttribute("aria-busy") === "false",
        );
        check(requests.length - n, 1, "one explicit local read");
      };
      check(await surface.getByRole("heading", { level: 1 }).count(), 1, "one actual page title");
      check(
        await surface.locator(".topology-verdict").getAttribute("data-verdict"),
        fixture.state,
        "original verdict not recomputed",
      );
      check(await surface.locator("svg").count(), 0, "no index-spaced restart chart");
      check(
        await surface.locator(".topology-nodes dd").last().textContent(),
        fixture.nodes[0].build_sha,
        "full forty-character build",
      );
      check(
        await surface.locator(".topology-alerts article").count(),
        fixture.alerts.length,
        "alerts separate from ready verdict",
      );
      check(
        await surface.getByText("当前单机运行门无阻断", { exact: true }).count(),
        1,
        "blockers not merged into alerts",
      );
      check(
        (await surface.locator(".p66-relation-note").textContent()).includes(
          "不是本次网络连通性实测",
        ),
        true,
        "deployment explanation not a live probe",
      );
      check(
        await surface.locator(".topology-queue-list > article").count(),
        2,
        "original partial queue fixture preserved",
      );
      check(
        await surface.getByText("当前执行中，不处于等待队列", { exact: true }).count(),
        1,
        "running queue not called idle",
      );
      for (const [label, id] of [
        ["节点与进程", "nodes"],
        ["健康探测", "health"],
        ["队列调度", "queues"],
        ["告警与阻断", "alerts"],
      ]) {
        await surface
          .getByRole("navigation", { name: "服务拓扑页内导航" })
          .getByRole("link", { name: label, exact: true })
          .click();
        check(
          await page.evaluate(() => document.activeElement?.id),
          "p66-" + id,
          "named anchor focus",
        );
      }
      if (width === 390) {
        check(
          await surface
            .locator(".p66-layout")
            .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length),
          1,
          "phone single evidence column",
        );
        check(
          await surface
            .locator(".p66-directory nav")
            .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length),
          2,
          "phone two-column section navigation",
        );
      }
      await capture("default-page", null);
      await capture("node-record", surface.locator(".topology-nodes article").first());
      const failureDisclosure = surface.locator(".topology-processes > article details");
      await failureDisclosure.locator("summary").press("Enter");
      check(
        await failureDisclosure.locator("code").textContent(),
        "exit:1",
        "process failure exact",
      );
      await capture("process-failure", failureDisclosure);
      await failureDisclosure.locator("summary").press("Enter");
      const restart = surface.locator(".p66-restart-records > details").nth(1);
      await restart.locator("summary").press("Enter");
      check(await restart.locator("li").count(), 2, "all original worker restart observations");
      check(
        (await restart.locator("li").last().locator("dd").allTextContents()).map((t) => t.trim()),
        ["running", "3", "2", "否"],
        "restart cumulative delta and reset fields",
      );
      await capture("restart-observations", restart);
      await restart.locator("summary").press("Enter");
      const health = surface.locator(".topology-health-grid article");
      check(await health.count(), 3, "three distinct endpoints");
      for (const [i, expected] of ["9 ms", "44 ms", "73 ms"].entries())
        check(
          (await health.nth(i).locator("dd").nth(1).textContent()).trim(),
          expected,
          "endpoint P95",
        );
      await capture("health-ready", health.nth(1));
      const association = surface.locator(".topology-alert-associations a");
      check(
        await association.getAttribute("href"),
        fixture.alerts[1].business_objects[0].href,
        "original business target retained",
      );
      const alert = surface.locator(".topology-alerts article").nth(1);
      await alert.locator("summary").press("Enter");
      check(
        (await alert.locator("details").textContent()).includes(
          fixture.alerts[1].business_objects[0].id,
        ),
        true,
        "full business UUID disclosed",
      );
      await capture("alert-association", alert);
      await alert.locator("summary").press("Enter");
      check(requests.length, 1, "all local disclosures and anchors add no requests");
      current = structuredClone(fixture);
      current.health_probes.status = "empty";
      for (const ep of current.health_probes.endpoints) {
        for (const field of [
          "sample_count",
          "success_count",
          "http_error_count",
          "timeout_count",
          "network_error_count",
          "availability_basis_points",
        ])
          ep[field] = 0;
        for (const field of [
          "latency_p50_ms",
          "latency_p95_ms",
          "latency_p99_ms",
          "latency_max_ms",
          "last_status_code",
          "last_outcome",
          "last_observed_at",
        ])
          ep[field] = null;
      }
      await read();
      check(
        await surface.getByText("无样本，暂不提供实测可用率", { exact: true }).count(),
        3,
        "empty samples have explicit availability limit",
      );
      check(
        (await surface.locator(".topology-health-grid").textContent()).includes("可用率 0.00%"),
        false,
        "no false measured zero availability",
      );
      await capture("health-empty", surface.locator(".topology-health-grid article").first());
      current = structuredClone(fixture);
      current.alerts = [];
      const entries = Object.entries(policies);
      current.worker_scheduler.queues = entries.map(([name, p]) => ({
        ...fixture.worker_scheduler.queues[0],
        name,
        priority: p.priority,
        effective_priority: p.priority,
        timeout_ms: p.timeoutMs,
        max_retries: p.maxRetries,
        max_concurrency: p.maxConcurrency,
        aging_interval_ms: p.agingIntervalMs,
        maximum_aging_boost: p.maximumAgingBoost,
        active_runs: 0,
        running: false,
        due: false,
        queue_delay_ms: 0,
        longest_running_ms: 0,
        last_result_at: null,
        last_result_status: null,
        last_result_error_code: null,
        last_business_objects: [],
      }));
      current.worker_scheduler.active_runs = 0;
      current.worker_scheduler.due_queue_count = 0;
      await read();
      const queues = surface.locator(".topology-queue-list > article");
      check(await queues.count(), 0, "idle registry hidden by original filter");
      await surface
        .getByRole("button", { name: `查看全部 ${entries.length} 个队列策略`, exact: true })
        .press("Space");
      check(
        await queues.count(),
        entries.length,
        "all registered policies reachable beyond eighteen",
      );
      for (const [i, [name, p]] of entries.entries()) {
        const row = queues.nth(i);
        await row.locator("summary").press("Enter");
        check(await row.locator(".p66-queue-code").textContent(), name, "exact queue identity");
        check(
          (await row.locator("details").textContent())
            .replace(/\\s+/g, " ")
            .includes(`超时 ${p.timeoutMs} ms`),
          true,
          "registered timeout preserved",
        );
        if (i === entries.length - 1) await capture("last-policy", row);
        await row.locator("summary").press("Enter");
      }
      await surface.getByRole("button", { name: "仅看运行与异常", exact: true }).click();
      check(await queues.count(), 0, "original filter restored locally");
      check(requests.length, 3, "queue disclosure/toggle never reads");
      current.worker_scheduler.queues.forEach((q) => {
        q.due = true;
        q.queue_delay_ms = 1;
      });
      current.worker_scheduler.due_queue_count = entries.length;
      await read();
      check(await queues.count(), entries.length, "all due policies retained after refresh");
      check(
        await surface.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        true,
        "no horizontal page overflow",
      );
      check(
        await page.getByRole("dialog").evaluateAll((items) =>
          items
            .map((el) => ({
              label: el.getAttribute("aria-label"),
              class: el.className,
              text: el.textContent.slice(0, 200),
            }))
            .filter(
              (item) => item.class !== "role-navigation-frame" || item.label !== "工作台导航",
            ),
        ),
        [],
        "no invented business dialog",
      );
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
            "actual Vue C review; original partial topology E2E plus explicit empty-health and registry-display variants; no real probe, scheduler or audit",
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
        "<h1>P66 服务拓扑待审</h1><p>本地样例，只读展示；未执行探测、调度或重启，不代表真实权限或生产验收。</p>" +
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
