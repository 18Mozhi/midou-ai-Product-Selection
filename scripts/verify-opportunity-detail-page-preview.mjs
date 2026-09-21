import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import {
  opportunityDetailPagePlugin,
  opportunityDetailReviewCss,
} from "./lib/opportunity-detail-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const smoke = process.env.P18_SMOKE === "1",
  widths = smoke ? [390] : [1440, 390],
  motions = smoke ? ["reduce"] : ["reduce", "no-preference"],
  output = args.length ? path.resolve(`output/playwright/p18-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [],
  results = [];
const id = "00000000-0000-4000-8000-000000001818",
  nav = {
    shell: "member",
    organization_id: "p18-org",
    workspace_id: "p18-workspace",
    roles: ["member"],
    capabilities: ["opportunity:read", "opportunity:decide", "competitor:read", "sourcing:read"],
    platform_roles: [],
    platform_capabilities: [],
    guard_reason: "navigation_member_allowed",
  },
  gates = {
    score: true,
    market: true,
    competition: true,
    cost: true,
    risk: true,
    all_passed: true,
  },
  envelope = (data, request_id = "p18-request") => ({ data, request_id, trace_id: request_id }),
  failure = (status, code, request_id) => ({
    status,
    json: {
      error: { code, message: code, action_hint: "本地审核恢复提示" },
      request_id,
      trace_id: request_id,
    },
  });
const detail = {
  id,
  name: "便携咖啡机收纳套装",
  image_url: null,
  market: "US",
  category: "Home & Kitchen",
  source_type: "trend_topic",
  source_ref_id: "p18-topic",
  owner_id: "p18-owner",
  lifecycle_status: "ready",
  lifecycle_entered_at: "2026-09-20T08:00:00.000Z",
  lifecycle_dwell_seconds: 3600,
  recommendation_status: "recommend",
  overall_score: 86,
  trend_score: 88,
  competition_score: 82,
  profit_status: "calculated",
  risk_level: "low",
  confidence: { status: "measured", score: 86 },
  evidence_count: 8,
  source_count: 3,
  competitor_count: 2,
  supplier_candidate_count: 1,
  matched_rule_count: 1,
  selection_stage: "recommended",
  quality_gates: gates,
  coverage_status: "complete",
  blocking_reasons: [],
  decision_status: "pending",
  version: 4,
  updated_at: "2026-09-20T09:00:00.000Z",
  operating_feedback: { facts: [], calibration: null },
  adoption_blockers: [],
  redecision_ready: false,
  score_rule_version: "org-v3",
  scored_at: "2026-09-20T08:50:00.000Z",
  latest_score_run: {
    id: "p18-score",
    status: "calculated",
    coverage_percent: 100,
    confidence_score: 86,
    recommendation_status: "recommend",
    missing_fields: [],
    scored_at: "2026-09-20T08:50:00.000Z",
  },
  score_components: [
    {
      dimension_code: "trend",
      weight_percent: 25,
      input_score: 88,
      weighted_score: 22,
      evidence_ids: ["e1"],
      missing_fields: [],
    },
    {
      dimension_code: "competition",
      weight_percent: 25,
      input_score: 82,
      weighted_score: 20.5,
      evidence_ids: ["e2"],
      missing_fields: [],
    },
    {
      dimension_code: "profit",
      weight_percent: 25,
      input_score: 85,
      weighted_score: 21.25,
      evidence_ids: ["e3"],
      missing_fields: [],
    },
    {
      dimension_code: "risk",
      weight_percent: 25,
      input_score: 89,
      weighted_score: 22.25,
      evidence_ids: ["e4"],
      missing_fields: [],
    },
  ],
  evidence: [
    {
      id: "e1",
      title: "便携咖啡机需求变化",
      publisher: "公开来源",
      canonical_url: "https://example.test/evidence",
      observed_at: "2026-09-20T08:00:00.000Z",
    },
  ],
  decisions: [],
  section_status: {
    market: "covered",
    competition: "covered",
    profit: "calculated",
    risk: "covered",
    execution: "not_available",
  },
  lineage: {
    freshness: { observed_at: "2026-09-20T08:00:00.000Z", age_seconds: 3600 },
    failure_impact: { level: "none", codes: [], affected_stages: [] },
    request_ids: ["p18-request"],
    trace_ids: ["p18-request"],
    nodes: [],
  },
};
const profit = {
  latest_run: {
    id: "p18-profit",
    status: "calculated",
    rule_version_code: "cost-v2",
    platform: "amazon",
    market: "US",
    currency: "USD",
    sale_price: 49.9,
    total_cost: 28.3,
    net_profit: 21.6,
    net_margin_percent: 43.3,
    missing_fields: [],
    calculated_at: "2026-09-20T08:52:00.000Z",
    components: [],
  },
  current_inputs: [],
  cost_input_reviews: [],
};
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [opportunityDetailPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P18 actual Vue review ${origin}`);
  for (const width of widths)
    for (const motion of motions) {
      let scene = "ready",
        checks = 0,
        writes = [];
      const errors = [],
        unexpected = [],
        context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1050 },
          locale: "zh-CN",
          reducedMotion: motion,
        });
      const check = (actual, expected, label) => {
          assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`);
          checks += 1;
        },
        capture = async (page, name) => {
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
            return route.fulfill({ json: envelope({ authenticated: true }, "p18-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p18-nav") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p18-theme"),
            });
          if (key === `GET /api/v1/opportunities/${id}`) {
            if (scene === "failure")
              return route.fulfill(failure(503, "opportunity_unavailable", "p18-failure"));
            return route.fulfill({ json: envelope(detail, "p18-detail") });
          }
          if (key === `GET /api/v1/opportunities/${id}/profit-analysis`)
            return route.fulfill({ json: envelope(profit, "p18-profit") });
          if (key === `GET /api/v1/opportunities/${id}/ai-analyses`)
            return route.fulfill({ json: envelope([], "p18-ai") });
          if (key === "GET /api/v1/competitors")
            return route.fulfill({ json: envelope([], "p18-competitors") });
          if (key === "GET /api/v1/sourcing/searches")
            return route.fulfill({ json: envelope([], "p18-sourcing") });
          if (request.method() === "POST") {
            writes.push({ key, body: request.postData() });
            return route.fulfill({ json: envelope({}, "p18-write") });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/opportunities/${id}`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".opportunity-workspace");
        await root
          .getByRole("heading", { name: "便携咖啡机收纳套装", exact: true })
          .waitFor({ timeout: 8000 });
        await root.getByText("全部通过", { exact: true }).waitFor({ timeout: 8000 });
        check(
          await root.getByRole("button", { name: "采纳建议", exact: true }).count(),
          1,
          "adopt only after five gates",
        );
        const adopt = root.getByRole("button", { name: "采纳建议", exact: true });
        await adopt.focus();
        check(
          await adopt.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "adopt focus visible",
        );
        check(
          await root.getByText("五项质量门", { exact: true }).count(),
          1,
          "quality gate summary",
        );
        await capture(page, "ready");
        await root.getByText("查看每项判断", { exact: true }).click();
        check(
          await root.getByRole("list", { name: "五项质量门" }).count(),
          1,
          "gate detail disclosure",
        );
        await capture(page, "gates");
        await root.getByRole("button", { name: "证据", exact: true }).click();
        await root.getByText("便携咖啡机需求变化", { exact: true }).waitFor({ timeout: 5000 });
        await capture(page, "evidence");
        check(writes, [], "no decision submitted");
        scene = "failure";
        const failed = await context.newPage();
        await failed.goto(`${origin}/opportunities/${id}`, { waitUntil: "domcontentloaded" });
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
    "apps/web/src/components/OpportunityWorkspace.vue",
    "apps/web/src/components/OpportunityDecisionPanel.vue",
    "apps/web/src/components/OpportunityDetailInsights.vue",
    "apps/web/src/components/OpportunityEvidencePanel.vue",
    "scripts/lib/opportunity-detail-page-preview.mjs",
    "scripts/verify-opportunity-detail-page-preview.mjs",
    opportunityDetailReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P18",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; navigation and opportunity-detail responses are locally intercepted",
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
