import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import {
  competitorRulesPagePlugin,
  competitorRulesReviewCss,
} from "./lib/competitor-rules-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const smoke = process.env.P20_SMOKE === "1",
  widths = smoke ? [390] : [1440, 390],
  motions = smoke ? ["reduce"] : ["reduce", "no-preference"],
  output = args.length ? path.resolve(`output/playwright/p20-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [],
  results = [];
const competitorId = "00000000-0000-4000-8000-000000002020";
const envelope = (data, request_id = "p20-request") => ({ data, request_id, trace_id: request_id });
const failure = () => ({
  status: 503,
  json: {
    error: {
      code: "competitor_rules_unavailable",
      message: "competitor_rules_unavailable",
      action_hint: "本地审核恢复提示",
    },
    request_id: "p20-failure",
    trace_id: "p20-failure",
  },
});
const nav = {
  shell: "member",
  organization_id: "p20-org",
  workspace_id: "p20-workspace",
  roles: ["member"],
  capabilities: ["competitor:read", "competitor:manage"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const snapshot = {
  id: "p20-snapshot",
  current_price: 29.99,
  currency: "USD",
  rank_value: 80,
  review_count: 120,
  rating_value: 4.5,
  availability: "in_stock",
  captured_at: "2026-09-20T08:30:00.000Z",
  freshness: "fresh",
  source_status: "healthy",
  evidence_id: "p20-evidence",
};
const competitor = {
  id: competitorId,
  market: "US",
  source_site: "Amazon",
  external_id: "B0P20TEST",
  product_url: "https://example.test/p20",
  title: "可调节厨房置物架",
  status: "active",
  revision: 2,
  snapshot_count: 1,
  latest_snapshot: snapshot,
};
const detail = { ...competitor, snapshots: [snapshot], changes: [], alerts: [] };
const rules = [
  {
    id: "p20-price",
    competitor_id: competitorId,
    metric: "price",
    direction: "decrease",
    threshold_value: 2,
    status: "enabled",
    revision: 4,
    updated_at: "2026-09-20T08:00:00.000Z",
  },
  {
    id: "p20-stock",
    competitor_id: null,
    metric: "availability",
    direction: "became_unavailable",
    threshold_value: null,
    status: "disabled",
    revision: 1,
    updated_at: "2026-09-19T08:00:00.000Z",
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
  plugins: [competitorRulesPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P20 actual Vue review ${origin}`);
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
            return route.fulfill({ json: envelope({ authenticated: true }, "p20-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p20-nav") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p20-theme"),
            });
          if (key === "GET /api/v1/competitors")
            return scene === "failure"
              ? route.fulfill(failure())
              : route.fulfill({ json: envelope([competitor], "p20-list") });
          if (key === "GET /api/v1/competitor-monitor-rules")
            return route.fulfill({ json: envelope(scene === "empty" ? [] : rules, "p20-rules") });
          if (key === `GET /api/v1/competitors/${competitorId}`)
            return route.fulfill({ json: envelope(detail, "p20-detail") });
          if (request.method() !== "GET") {
            writes.push({ key, body: request.postData() });
            return route.fulfill({ json: envelope({}, "p20-write") });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/competitors/monitoring-rules`, {
          waitUntil: "domcontentloaded",
        });
        const root = page.locator(".competitor-monitor");
        await root
          .getByRole("heading", { name: "监控规则", exact: true })
          .waitFor({ timeout: 8000 });
        await root.getByText("价格 · 减少 USD 2", { exact: true }).waitFor({ timeout: 8000 });
        check(await root.getByText("已生效", { exact: true }).count(), 1, "enabled rule state");
        check(await root.getByText("已停用", { exact: true }).count(), 1, "disabled rule state");
        check(
          await root.getByText("工作区全部竞品", { exact: true }).count(),
          1,
          "global scope stays explicit",
        );
        const create = root.getByRole("button", { name: "新建监控规则", exact: true });
        await create.focus();
        check(
          await create.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "create focus visible",
        );
        await capture(page, "ready");
        check(writes, [], "no rule submitted");
        scene = "empty";
        const empty = await context.newPage();
        await empty.goto(`${origin}/competitors/monitoring-rules`, {
          waitUntil: "domcontentloaded",
        });
        await empty.getByText("尚未配置监控规则", { exact: true }).waitFor({ timeout: 8000 });
        check(
          await empty.getByRole("button", { name: "创建第一条规则", exact: true }).count(),
          1,
          "empty create path",
        );
        await capture(empty, "empty");
        scene = "failure";
        const failed = await context.newPage();
        await failed.goto(`${origin}/competitors/monitoring-rules`, {
          waitUntil: "domcontentloaded",
        });
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
    "scripts/lib/competitor-rules-page-preview.mjs",
    "scripts/verify-competitor-rules-page-preview.mjs",
    competitorRulesReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P20",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; navigation and competitor-rule responses are locally intercepted",
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
