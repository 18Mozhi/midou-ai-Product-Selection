import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { opportunityPagePlugin, opportunityReviewCss } from "./lib/opportunity-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const smoke = process.env.P15_SMOKE === "1",
  widths = smoke ? [390] : [1440, 390],
  motions = smoke ? ["reduce"] : ["reduce", "no-preference"],
  output = args.length ? path.resolve(`output/playwright/p15-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [],
  results = [];
const nav = {
  shell: "member",
  organization_id: "p15-org",
  workspace_id: "p15-workspace",
  roles: ["member"],
  capabilities: ["opportunity:read", "opportunity:decide", "trend:read", "task:read"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const gates = {
  score: true,
  market: true,
  competition: true,
  cost: true,
  risk: true,
  all_passed: true,
};
const opportunity = (id, name, overrides = {}) => ({
  id,
  name,
  image_url: null,
  market: "US",
  category: "Home & Kitchen",
  source_type: "trend_topic",
  source_ref_id: "p15-topic",
  owner_id: "p15-owner",
  lifecycle_status: "ready",
  lifecycle_entered_at: "2026-09-20T07:00:00.000Z",
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
  competitor_count: 5,
  supplier_candidate_count: 4,
  matched_rule_count: 1,
  selection_stage: "recommended",
  quality_gates: gates,
  coverage_status: "complete",
  blocking_reasons: [],
  decision_status: "pending",
  version: 3,
  updated_at: "2026-09-20T08:00:00.000Z",
  ...overrides,
});
const recommended = opportunity("p15-recommended", "便携咖啡机收纳套装"),
  candidate = opportunity("p15-candidate", "可折叠厨房置物架", {
    selection_stage: "rule_candidate",
    quality_gates: { ...gates, cost: false, all_passed: false },
    overall_score: null,
    risk_level: "unknown",
    evidence_count: 4,
    source_count: 3,
  }),
  pending = opportunity("p15-pending", "旅行收纳压缩袋", {
    selection_stage: "not_eligible",
    quality_gates: {
      score: false,
      market: false,
      competition: false,
      cost: false,
      risk: false,
      all_passed: false,
    },
    matched_rule_count: 1,
    evidence_count: 1,
    source_count: 1,
    overall_score: null,
    risk_level: "unknown",
  }),
  manual = opportunity("p15-manual", "手工补录的厨房挂钩", {
    source_type: "manual",
    source_ref_id: null,
    selection_stage: "not_eligible",
    matched_rule_count: 0,
    quality_gates: {
      score: false,
      market: false,
      competition: false,
      cost: false,
      risk: false,
      all_passed: false,
    },
    overall_score: null,
    risk_level: "unknown",
  });
const envelope = (data, request_id = "p15-request", meta) => ({
  data,
  request_id,
  trace_id: request_id,
  ...(meta ? { meta } : {}),
});
const failure = (status, code, request_id) => ({
  status,
  json: {
    error: { code, message: code, action_hint: "本地审核恢复提示" },
    request_id,
    trace_id: request_id,
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
  plugins: [opportunityPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P15 actual Vue review ${origin}`);
  for (const width of widths)
    for (const motion of motions) {
      let scene = "ready",
        checks = 0,
        writes = [];
      const errors = [],
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
            return route.fulfill({ json: envelope({ authenticated: true }, "p15-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p15-nav") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p15-theme"),
            });
          if (key === "GET /api/v1/opportunities") {
            if (scene === "failure")
              return route.fulfill(failure(503, "opportunities_unavailable", "p15-failure"));
            const view = url.searchParams.get("selection_view");
            const items =
              view === "rule_candidates"
                ? [candidate]
                : view === "evidence_pending"
                  ? [pending]
                  : view === "all"
                    ? [recommended, manual]
                    : [recommended];
            return route.fulfill({
              json: envelope(items, "p15-list", { total: items.length, page: 1, page_size: 20 }),
            });
          }
          if (key === "GET /api/v1/opportunities/member-options")
            return route.fulfill({
              json: envelope([{ id: "p15-owner", label: "运营负责人" }], "p15-members"),
            });
          if (
            [
              "/api/v1/opportunity-score-rules",
              "/api/v1/cost-rules",
              "/api/v1/competitor-monitor-rules",
            ].includes(url.pathname)
          ) {
            const data = url.pathname.endsWith("opportunity-score-rules")
              ? [
                  {
                    id: "score",
                    status: "active",
                    dimensions: [
                      { code: "market", weight: 25, evidence_group: "market" },
                      { code: "competition", weight: 25, evidence_group: "competition" },
                      { code: "cost", weight: 25, evidence_group: "cost" },
                      { code: "risk", weight: 25, evidence_group: "risk" },
                    ],
                  },
                ]
              : url.pathname.endsWith("cost-rules")
                ? [
                    {
                      id: "cost",
                      status: "active",
                      platform: "amazon",
                      fee_lines: [{ type: "logistics", currency: "USD" }],
                      conversion_rates: [{ base_currency: "CNY", quote_currency: "USD" }],
                      automatic_scope: { product_family: "phone_case" },
                    },
                  ]
                : [{ id: "competitor", status: "enabled" }];
            return route.fulfill({ json: envelope(data, "p15-readiness") });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/opportunities`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".p15-opportunity");
        await root
          .getByRole("heading", { name: "先核对质量门，再由人决定采纳", exact: true })
          .waitFor({ timeout: 8000 });
        check(
          await root
            .getByText(
              "规则命中只是候选。评分、市场、竞争、成本、风险五项均通过，才进入待你采纳。",
              { exact: true },
            )
            .count(),
          1,
          "five gate boundary",
        );
        await root
          .getByRole("heading", { name: "1 个商品建议采纳", exact: true })
          .waitFor({ timeout: 8000 });
        check(
          await root.getByRole("heading", { name: "1 个商品建议采纳", exact: true }).count(),
          1,
          "recommended queue",
        );
        const selected = root.getByRole("button", { name: "规则命中候选", exact: true });
        await selected.focus();
        check(
          await selected.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "queue focus visible",
        );
        await capture(page, "recommended");
        await selected.click();
        await root
          .getByRole("heading", { name: "1 个规则命中候选", exact: true })
          .waitFor({ timeout: 8000 });
        check(
          (await root.getByText("质量门", { exact: true }).count()) > 0,
          true,
          "candidate progress facts",
        );
        await capture(page, "rule-candidates");
        await root.getByRole("button", { name: "全部机会", exact: true }).click();
        await root
          .getByRole("button", { name: "手工添加", exact: true })
          .waitFor({ timeout: 8000 });
        const checkbox = root.getByRole("checkbox", { name: /选择机会：便携咖啡机/ });
        await checkbox.check();
        await root.getByRole("button", { name: "批量复核", exact: true }).click();
        await root.getByRole("dialog", { name: "机会批量操作影响预览" }).waitFor();
        check(
          await root
            .getByText("仅提交当前页已选条目；每项会保留独立事件和原因。", { exact: true })
            .count(),
          1,
          "batch scope disclosure",
        );
        await capture(page, "all-batch");
        await page.keyboard.press("Escape");
        const prefill = await context.newPage();
        await prefill.goto(
          `${origin}/opportunities?source_topic_id=p15-topic&name=%E4%BE%BF%E6%90%BA%E5%92%96%E5%95%A1%E6%9C%BA&market=US&category=Home%20%26%20Kitchen`,
          { waitUntil: "domcontentloaded" },
        );
        const dialog = prefill.getByRole("dialog", { name: /创建机会候选/ });
        await dialog.waitFor({ timeout: 8000 });
        check(await dialog.getByLabel("机会名称").inputValue(), "便携咖啡机", "trend prefill name");
        check(
          await dialog.getByLabel("来源趋势 ID（可选，只接受当前工作区主题）").inputValue(),
          "p15-topic",
          "trend prefill source",
        );
        check(writes, [], "no automatic create or adopt");
        await capture(prefill, "trend-prefill");
        scene = "failure";
        const failed = await context.newPage();
        await failed.goto(`${origin}/opportunities`, { waitUntil: "domcontentloaded" });
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
    "apps/web/src/components/OpportunityListPanel.vue",
    "apps/web/src/components/AutomaticSelectionReadinessPanel.vue",
    "apps/web/src/components/OpportunityWorkspaceDialogs.vue",
    "scripts/lib/opportunity-page-preview.mjs",
    "scripts/verify-opportunity-page-preview.mjs",
    opportunityReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P15",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; navigation and opportunity responses are locally intercepted",
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
      checks: results.reduce((n, item) => n + item.checks, 0),
      writes: results.reduce((n, item) => n + item.writes, 0),
      images: images.length,
      sources: sources.length,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
