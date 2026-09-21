import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { competitorPagePlugin, competitorReviewCss } from "./lib/competitor-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const smoke = process.env.P19_SMOKE === "1",
  widths = smoke ? [390] : [1440, 390],
  motions = smoke ? ["reduce"] : ["reduce", "no-preference"],
  output = args.length ? path.resolve(`output/playwright/p19-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [],
  results = [];
const competitorId = "00000000-0000-4000-8000-000000001919";
const envelope = (data, request_id = "p19-request") => ({ data, request_id, trace_id: request_id });
const failure = () => ({
  status: 503,
  json: {
    error: {
      code: "competitor_unavailable",
      message: "competitor_unavailable",
      action_hint: "本地审核恢复提示",
    },
    request_id: "p19-failure",
    trace_id: "p19-failure",
  },
});
const nav = {
  shell: "member",
  organization_id: "p19-org",
  workspace_id: "p19-workspace",
  roles: ["member"],
  capabilities: ["competitor:read", "competitor:manage", "task:create"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const snapshot = {
  id: "p19-snapshot",
  current_price: 39.99,
  currency: "USD",
  rank_value: 127,
  review_count: 428,
  rating_value: 4.7,
  availability: "in_stock",
  captured_at: "2026-09-20T08:30:00.000Z",
  freshness: "fresh",
  source_status: "healthy",
  evidence_id: "p19-evidence",
};
const item = {
  id: competitorId,
  market: "US",
  source_site: "Amazon",
  external_id: "B0P19TEST",
  product_url: "https://example.test/p19",
  title: "可折叠厨房收纳架",
  status: "active",
  revision: 3,
  snapshot_count: 2,
  latest_snapshot: snapshot,
  latest_collection: {
    task_id: "p19-collection",
    status: "succeeded",
    last_error_code: null,
    attempt_count: 1,
    available_result_count: 1,
    updated_at: "2026-09-20T08:30:00.000Z",
  },
};
const detail = {
  ...item,
  snapshots: [
    snapshot,
    {
      ...snapshot,
      id: "p19-baseline",
      current_price: 42.99,
      captured_at: "2026-09-19T08:30:00.000Z",
      evidence_id: "p19-baseline-evidence",
    },
  ],
  changes: [
    {
      id: "p19-change",
      field: "current_price",
      previous: "42.99",
      current: "39.99",
      changed_at: "2026-09-20T08:30:00.000Z",
      evidence_id: "p19-evidence",
      impact_explanation: "价格下降，等待人工验证。",
    },
  ],
  alerts: [
    {
      id: "p19-alert",
      change_id: "p19-change",
      rule_id: "p19-rule",
      notification_status: "delivered",
      task_status: "created",
      payload: {},
      created_at: "2026-09-20T08:31:00.000Z",
    },
  ],
};
const rules = [
  {
    id: "p19-rule",
    competitor_id: competitorId,
    metric: "price",
    direction: "decrease",
    threshold_value: 1,
    status: "enabled",
    revision: 2,
    updated_at: "2026-09-20T08:00:00.000Z",
  },
];
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [competitorPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P19 actual Vue review ${origin}`);
  for (const width of widths)
    for (const motion of motions) {
      let scene = "ready",
        checks = 0;
      const writes = [],
        errors = [],
        unexpected = [];
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1050 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      const check = (actual, expected, label) => {
        assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`);
        checks += 1;
      };
      const capture = async (page, name) => {
        if (!output || motion !== "reduce") return;
        await page.evaluate(
          () =>
            new Promise((resolve) => {
              scrollTo(0, 0);
              requestAnimationFrame(resolve);
            }),
        );
        const bytes = await page.screenshot({ animations: "disabled", fullPage: true }),
          file = `${width}-${name}.png`;
        await writeFile(path.join(output, file), bytes);
        images.push({
          file,
          sha256: hash(bytes),
          pixelWidth: bytes.readUInt32BE(16),
          pixelHeight: bytes.readUInt32BE(20),
        });
      };
      try {
        context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
        await context.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (url.origin !== origin) return route.abort();
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const key = `${request.method()} ${url.pathname}`;
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: envelope({ authenticated: true }, "p19-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p19-nav") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p19-theme"),
            });
          if (key === "GET /api/v1/competitors")
            return scene === "failure"
              ? route.fulfill(failure())
              : route.fulfill({ json: envelope([item], "p19-list") });
          if (key === "GET /api/v1/competitor-monitor-rules")
            return route.fulfill({ json: envelope(rules, "p19-rules") });
          if (key === `GET /api/v1/competitors/${competitorId}`)
            return route.fulfill({ json: envelope(detail, "p19-detail") });
          if (request.method() !== "GET") {
            writes.push({ key, body: request.postData() });
            return route.fulfill({ json: envelope({}, "p19-write") });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/competitors`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".competitor-monitor");
        await root
          .getByRole("heading", { name: "可折叠厨房收纳架", exact: true })
          .waitFor({ timeout: 8000 });
        await root.getByText("USD 39.99", { exact: true }).first().waitFor({ timeout: 8000 });
        assert.ok(
          (await root.getByText("证据 p19-evidence", { exact: true }).count()) >= 1,
          `${width}/${motion}: shows the actual evidence identifier`,
        );
        checks += 1;
        assert.match(
          await root.locator(".competitor-timeline-conclusion").innerText(),
          /价格下降，等待人工验证。/,
          `${width}/${motion}: keeps a human verification conclusion`,
        );
        checks += 1;
        const collect = root.getByRole("button", { name: "立即采集", exact: true });
        await collect.focus();
        check(
          await collect.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "collection focus visible",
        );
        await capture(page, "ready");
        await root.getByText("帮助：竞品监控如何工作", { exact: true }).click();
        assert.match(
          await root.locator(".competitor-guide").innerText(),
          /只有达到显式规则时才生成告警与任务/,
          `${width}/${motion}: help disclosure`,
        );
        checks += 1;
        await capture(page, "history");
        check(writes, [], "no monitor action submitted");
        scene = "failure";
        const failed = await context.newPage();
        await failed.goto(`${origin}/competitors`, { waitUntil: "domcontentloaded" });
        await failed.getByText("依赖暂时受阻", { exact: true }).waitFor({ timeout: 8000 });
        check(
          await failed.getByRole("button", { name: "稍后重试", exact: true }).count(),
          1,
          "failure retry",
        );
        await capture(failed, "failure");
        check(unexpected, [], "no unexpected API");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks, writes: writes.length });
        console.log(JSON.stringify({ width, motion, checks, writes: writes.length }));
      } finally {
        await context.close();
      }
    }
  const sources = [
    "apps/web/src/components/CompetitorMonitor.vue",
    "apps/web/src/competitor.css",
    "scripts/lib/competitor-page-preview.mjs",
    "scripts/verify-competitor-page-preview.mjs",
    competitorReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P19",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; navigation and competitor responses are locally intercepted",
          sources: Object.fromEntries(
            await Promise.all(
              sources.sort().map(async (file) => [file, hash(await readFile(file))]),
            ),
          ),
          images: images.sort((a, b) => a.file.localeCompare(b.file)),
          results: results.sort((a, b) => a.width - b.width || a.motion.localeCompare(b.motion)),
        },
        null,
        2,
      ) + "\n",
    );
  console.log(
    JSON.stringify({
      groups: results.length,
      checks: results.reduce((n, row) => n + row.checks, 0),
      writes: results.reduce((n, row) => n + row.writes, 0),
      images: images.length,
      sources: sources.length,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
