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
import { topologyStateFixtures, topologyStateSources } from "./lib/topology-state-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length ? path.resolve(`output/playwright/p66-state-matrix-${args[1]}`) : null;
if (output) await mkdir(output);
const { cases, nav, clock } = await topologyStateFixtures(),
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
    ...topologyStateSources,
    topologyFixtureFile,
    topologyPolicyFile,
    "scripts/lib/topology-review-fixtures.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "scripts/lib/ui-imported-style-sources.mjs",
    "scripts/verify-topology-state-matrix.mjs",
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
          [...el.querySelectorAll("h2,h3,dt,dd,button,summary,code,strong,p,time")]
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

      const labels = {
        runtime_nodes_empty: "尚无 API 节点记录",
        api_node_missing: "预期 API 节点未找到",
        api_unavailable: "API 尚未就绪",
        api_host_identity_mismatch: "API 主机身份不一致",
        api_heartbeat_stale: "API 心跳已过期",
        backend_supervisor_degraded: "后端进程异常",
      };
      const titles = {
        ready: "单机运行门已满足",
        empty: "尚无当前 API 心跳",
        blocked: "单机运行条件未满足",
        stale: "运行观测需重新核验",
      };
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
          check(requests.length - before, 1, row.id + " one explicit read");
        }
        const data = row.data,
          verdict = surface.locator(".topology-verdict");
        check(await verdict.getAttribute("data-verdict"), data.state, row.id + " service verdict");
        check(
          await verdict.locator("strong").textContent(),
          titles[data.state],
          row.id + " readable verdict",
        );
        check(
          (await surface.locator(".p66-summary dd").allTextContents()).map((x) => x.trim()),
          [
            data.active_api_instances,
            data.stale_node_count,
            data.alerts.length,
            data.blockers.length,
          ].map(String),
          row.id + " exact summary",
        );
        check(
          await surface.locator(".topology-nodes > article").count(),
          data.nodes.length,
          row.id + " exact node count",
        );
        await capture(row.id + "-verdict", verdict);
        const blockers = surface.locator(".topology-blockers article");
        check(
          await blockers.count(),
          data.blockers.length,
          row.id + " blockers separate from alerts",
        );
        if (!data.blockers.length) {
          check(
            await surface.locator(".topology-clear").isVisible(),
            true,
            row.id + " no blocker statement",
          );
        }
        for (const [j, item] of data.blockers.entries()) {
          const entry = blockers.nth(j);
          check(
            await entry.locator("strong").textContent(),
            labels[item.code],
            row.id + " specific blocker label",
          );
          check(
            (await entry.locator("p").textContent()).trim(),
            item.actionHint,
            row.id + " producer hint unchanged",
          );
          await entry.locator("summary").press("Enter");
          check(
            await entry.locator("details").getAttribute("open"),
            "",
            row.id + " keyboard opens code",
          );
          check(
            await entry.locator("code").textContent(),
            item.code,
            row.id + " exact blocker code",
          );
          check(
            await entry.locator("strong").evaluate((el) => getComputedStyle(el).color),
            "rgb(24, 45, 74)",
            row.id + " C blocker text color",
          );
          check(
            await entry.locator("summary").evaluate((el) => {
              const box = el.getBoundingClientRect(),
                parent = el.closest("article").getBoundingClientRect(),
                style = getComputedStyle(el);
              const inset = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
              return (
                document.activeElement === el &&
                style.outlineColor === "rgb(23, 72, 160)" &&
                style.outlineStyle === "solid" &&
                style.outlineWidth === "3px" &&
                box.left - inset >= parent.left &&
                box.right + inset <= parent.right
              );
            }),
            true,
            row.id + " blue focus fits blocker region",
          );
          await capture(row.id + "-blocker-" + (j + 1), entry);
          await entry.locator("summary").press("Enter");
          check(
            await entry.locator("details").getAttribute("open"),
            null,
            row.id + " keyboard closes code",
          );
        }
        const alerts = surface.locator(".topology-alerts article");
        check(await alerts.count(), data.alerts.length, row.id + " service alert count");
        if (row.id.startsWith("worker-")) {
          check(data.stale_node_count, 0, row.id + " not an expired node");
          check(data.blockers.length, 0, row.id + " not an API blocker");
          const entry = alerts.first();
          check(
            await entry.locator("strong").textContent(),
            "任务调度观测需核对",
            row.id + " neutral Worker label",
          );
          check(
            (await entry.locator("p").textContent()).trim(),
            data.alerts[0].actionHint,
            row.id + " real Worker hint",
          );
          await entry.locator("summary").press("Enter");
          check(
            await entry.locator("code").first().textContent(),
            "worker_scheduler_heartbeat_stale",
            row.id + " exact technical code",
          );
          await capture(row.id + "-alert", entry);
          await entry.locator("summary").press("Enter");
        }
        if (row.id === "health-unavailable") {
          check(
            await surface
              .locator(".topology-health-probes > header [data-node-state]")
              .getAttribute("data-node-state"),
            "unavailable",
            "unavailable summary not healthy",
          );
          await capture(row.id + "-header", surface.locator(".topology-health-probes > header"));
        }
        if (row.id === "restart-counter-reset") {
          const entry = surface
            .locator(".p66-restart-records > details")
            .filter({ has: page.locator("summary", { hasText: "Node Worker" }) });
          await entry.locator("summary").press("Enter");
          check(await entry.locator("li").count(), 2, "reset original observations");
          check(
            (await entry.locator("li").last().locator("dd").allTextContents()).map((t) => t.trim()),
            ["running", "0", "0", "是"],
            "counter reset not negative delta",
          );
          await capture(row.id + "-record", entry);
          await entry.locator("summary").press("Enter");
        }
        check(
          await surface.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          true,
          row.id + " no horizontal overflow",
        );
        check(requests.length, i + 1, row.id + " disclosures do not request");
      }
      check(
        await surface.getByRole("heading", { level: 1 }).count(),
        1,
        "single actual C page heading",
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
            "actual Vue C review; 18 cases generated by current domain evaluator and RuntimeTopologyService with inert local dependencies; no live probe, scheduler, SQL or audit",
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
        "<h1>P66 运行结论与阻断待审</h1><p>本地样例，只读展示；未执行探测、调度或重启，不代表真实权限或生产验收。</p>" +
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
