import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { trendPagePlugin, trendReviewCss } from "./lib/trend-page-preview.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const smoke = process.env.P14_SMOKE === "1",
  widths = smoke ? [390] : [1440, 390],
  motions = smoke ? ["reduce"] : ["reduce", "no-preference"],
  output = args.length ? path.resolve(`output/playwright/p14-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  images = [],
  results = [];
const nav = {
  shell: "member",
  organization_id: "p14-org",
  workspace_id: "p14-workspace",
  roles: ["member"],
  capabilities: [
    "trend:read",
    "trend:manage",
    "task:read",
    "opportunity:read",
    "competitor:read",
    "sourcing:read",
    "notification:read",
  ],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const topic = (id, title, followed = false) => ({
  id,
  title,
  category: "Home & Kitchen",
  market: "US",
  language: "en-US",
  status: "active",
  signal_count: 18,
  source_count: 3,
  heat: { value: 18, unit: "signals" },
  momentum_percent: 24,
  confidence: { score: 82, status: "measured" },
  first_seen_at: "2026-09-18T08:00:00.000Z",
  last_seen_at: "2026-09-20T08:00:00.000Z",
  source_fresh_at: "2026-09-20T07:50:00.000Z",
  followed,
  version: 4,
});
const base = topic("p14-topic", "便携咖啡机"),
  detail = () => ({
    ...base,
    keywords: [
      { keyword: "portable coffee maker", type: "topic", language: "en-US", market: "US" },
    ],
    timeline: [
      { at: "2026-09-19T08:00:00.000Z", signal_count: 8, source_count: 2 },
      { at: "2026-09-20T08:00:00.000Z", signal_count: 18, source_count: 3 },
    ],
    timeline_sources: [
      {
        source_id: "source-1",
        source_label: "公开来源",
        points: [{ at: "2026-09-20T08:00:00.000Z", signal_count: 18 }],
      },
    ],
    evidence: [
      {
        id: "evidence-1",
        title: "便携咖啡机需求变化",
        publisher: "公开来源",
        canonical_url: "https://example.test/evidence",
        published_at: "2026-09-20T07:00:00.000Z",
        observed_at: "2026-09-20T08:00:00.000Z",
        provider_id: "source-1",
        raw_evidence_id: "raw-1",
      },
    ],
    data_quality: { coverage_status: "covered", evidence_count: 1, source_count: 3, stale: false },
    relevance_history: [],
  });
const rule = {
  id: "p14-rule",
  name: "厨房便携用品",
  include_keywords: ["coffee maker"],
  negative_keywords: [],
  market: "US",
  language: "en-US",
  category: "Home & Kitchen",
  notification_channel: "in_app",
  collection_interval_minutes: 60,
  recommendation_min_source_count: 2,
  status: "enabled",
  last_evaluated_at: "2026-09-20T07:00:00.000Z",
  last_collection_at: "2026-09-20T07:00:00.000Z",
  next_collection_at: "2026-09-20T09:00:00.000Z",
  last_collection_task_id: null,
  last_failed_sources: [],
  version: 3,
  updated_at: "2026-09-20T08:00:00.000Z",
};
const envelope = (data, id = "p14-request", meta) => ({
    data,
    request_id: id,
    trace_id: id,
    ...(meta ? { meta } : {}),
  }),
  failure = (status, code, id) => ({
    status,
    json: {
      error: { code, message: code, action_hint: "本地审核恢复提示" },
      request_id: id,
      trace_id: id,
    },
  });
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [trendPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P14 actual Vue review ${origin}`);
  for (const width of widths)
    for (const motion of motions) {
      let scene = "ready",
        followed = false,
        writes = [],
        checks = 0;
      const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1050 },
          locale: "zh-CN",
          reducedMotion: motion,
        }),
        errors = [],
        unexpected = [];
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
            return route.fulfill({ json: envelope({ authenticated: true }, "p14-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p14-nav") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p14-theme"),
            });
          if (key === "GET /api/v1/trends") {
            if (scene === "failure")
              return route.fulfill(failure(503, "trends_unavailable", "p14-failure"));
            return route.fulfill({
              json: envelope(
                [
                  topic("p14-topic", "便携咖啡机", followed),
                  topic("p14-topic-2", "可折叠收纳", false),
                ],
                "p14-list",
                { total: 2 },
              ),
            });
          }
          if (key === "GET /api/v1/trends/monitoring-rules")
            return route.fulfill({ json: envelope([rule], "p14-rules") });
          if (key === "GET /api/v1/trends/change-requests")
            return route.fulfill({ json: envelope([], "p14-governance") });
          if (key === "GET /api/v1/trends/p14-topic")
            return route.fulfill({ json: envelope({ ...detail(), followed }, "p14-detail") });
          if (key === "PUT /api/v1/trends/p14-topic/follow") {
            writes.push({ key, body: request.postData() });
            followed = true;
            return route.fulfill({ json: envelope({ followed: true }, "p14-follow") });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/trends`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".p14-trend");
        await root
          .getByRole("heading", { name: "先核对证据，再决定是否持续监控", exact: true })
          .waitFor({ timeout: 8000 });
        check(
          await root
            .getByText("热度仅代表当前信号数；候选和建议采纳之间仍须通过五项质量门。", {
              exact: true,
            })
            .count(),
          1,
          "quality gate boundary",
        );
        const follow = root.getByRole("button", { name: "关注", exact: true });
        await follow.focus();
        check(
          await follow.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "follow focus visible",
        );
        await capture(page, "ready");
        await follow.click();
        await page.waitForFunction(() =>
          [...document.querySelectorAll(".trend-actions button")].some(
            (button) => button.textContent?.trim() === "已关注",
          ),
        );
        check(
          writes[0],
          { key: "PUT /api/v1/trends/p14-topic/follow", body: null },
          "exact follow request",
        );
        await capture(page, "followed");
        await root.getByRole("button", { name: /监控规则/, exact: false }).click();
        await root
          .getByRole("heading", { name: "趋势监控规则", exact: true })
          .waitFor({ timeout: 8000 });
        await capture(page, "rules");
        scene = "failure";
        const failed = await context.newPage();
        await failed.goto(`${origin}/trends`, { waitUntil: "domcontentloaded" });
        const failedRoot = failed.locator(".p14-trend");
        await failedRoot.getByText("趋势读取暂时受阻", { exact: true }).waitFor({ timeout: 8000 });
        check(
          await failedRoot.getByRole("button", { name: "重新加载", exact: true }).count(),
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
    "apps/web/src/components/TrendDashboard.vue",
    "apps/web/src/components/TrendFilterPanel.vue",
    "apps/web/src/components/TrendDetailPanel.vue",
    "scripts/lib/trend-page-preview.mjs",
    "scripts/verify-trend-page-preview.mjs",
    trendReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P14",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; navigation and trend responses are locally intercepted",
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
      checks: results.reduce((n, x) => n + x.checks, 0),
      writes: results.reduce((n, x) => n + x.writes, 0),
      images: images.length,
      sources: sources.length,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
