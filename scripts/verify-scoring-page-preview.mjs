import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { scoringPagePlugin, scoringReviewCss } from "./lib/scoring-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const smoke = process.env.P17_SMOKE === "1",
  widths = smoke ? [390] : [1440, 390],
  motions = smoke ? ["reduce"] : ["reduce", "no-preference"],
  output = args.length ? path.resolve(`output/playwright/p17-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [],
  results = [];
const nav = {
  shell: "member",
  organization_id: "p17-org",
  workspace_id: "p17-workspace",
  roles: ["member"],
  capabilities: ["opportunity:read", "opportunity:decide", "opportunity:approve"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const dimensions = [
  {
    code: "market_demand",
    label: "市场需求",
    weight: 25,
    required: true,
    evidence_group: "market",
  },
  { code: "competition", label: "竞争", weight: 20, required: true, evidence_group: "competition" },
  { code: "profit", label: "利润", weight: 20, required: true, evidence_group: "cost" },
  { code: "risk", label: "风险", weight: 20, required: true, evidence_group: "other" },
  { code: "data_quality", label: "数据质量", weight: 15, required: false, evidence_group: "other" },
];
const rule = (id, code, status, revision) => ({
  id,
  version_code: code,
  name: `${code} 质量门规则`,
  status,
  dimensions,
  thresholds: { recommend_min: 80, observe_min: 60 },
  revision,
  submitted_at: "2026-09-20T07:00:00.000Z",
  approved_at: status === "draft" ? null : "2026-09-20T07:20:00.000Z",
  activated_at: status === "active" ? "2026-09-20T07:30:00.000Z" : null,
  updated_at: "2026-09-20T08:00:00.000Z",
});
const rules = [
  rule("p17-active", "org-v3", "active", 4),
  rule("p17-pending", "org-v4", "pending_approval", 2),
  rule("p17-approved", "org-v2", "approved", 3),
  rule("p17-draft", "org-v5", "draft", 1),
];
const envelope = (data, request_id = "p17-request") => ({ data, request_id, trace_id: request_id });
const fail = (status, code, id) => ({
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
  plugins: [scoringPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P17 actual Vue review ${origin}`);
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
            return route.fulfill({ json: envelope({ authenticated: true }, "p17-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p17-nav") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p17-theme"),
            });
          if (key === "GET /api/v1/opportunity-score-rules") {
            if (scene === "failure")
              return route.fulfill(fail(503, "score_rules_unavailable", "p17-failure"));
            return route.fulfill({ json: envelope(rules, "p17-rules") });
          }
          if (key === "GET /api/v1/opportunity-score-rules/p17-pending/preview")
            return route.fulfill({
              json: envelope(
                {
                  rule_id: "p17-pending",
                  rule_version_code: "org-v4",
                  rule_status: "pending_approval",
                  page: 1,
                  page_size: 20,
                  total: 1,
                  items: [
                    {
                      opportunity_id: "p17-opportunity",
                      opportunity_name: "便携咖啡机收纳套装",
                      lifecycle_status: "ready",
                      current_score: 76,
                      current_recommendation_status: "observe",
                      current_rule_version: "org-v3",
                      projected_score: 84,
                      projected_recommendation_status: "recommend",
                      projected_coverage_percent: 92,
                      score_delta: 8,
                      recommendation_changed: true,
                      missing_fields: [],
                    },
                  ],
                  page_summary: {
                    increased: 1,
                    decreased: 0,
                    unchanged: 0,
                    newly_calculable: 0,
                    insufficient_data: 0,
                    recommendation_changed: 1,
                  },
                  read_only: true,
                },
                "p17-preview",
              ),
            });
          if (request.method() === "POST") {
            writes.push({ key, body: request.postData() });
            return route.fulfill({ json: envelope({}, "p17-write") });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/opportunities/scoring-rules`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".score-rules");
        await root
          .getByRole("heading", { name: "评分与质量门", exact: true })
          .waitFor({ timeout: 3000 });
        await root.getByText("评分规则覆盖", { exact: true }).waitFor({ timeout: 3000 });
        check(
          await root
            .getByText(
              "只有已启用规则要求真实市场、竞争、成本和风险证据时，候选才可能进入“建议采纳”。",
              { exact: true },
            )
            .count(),
          1,
          "gate boundary",
        );
        const preview = root.getByRole("button", { name: "预览影响", exact: true }).first();
        await preview.focus();
        check(
          await preview.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "preview focus visible",
        );
        await capture(page, "default");
        await preview.click();
        await page.getByRole("dialog", { name: /发布影响预览/ }).waitFor({ timeout: 3000 });
        check(
          await page.getByText(/只比较当前页，不改规则、机会或历史评分。/).count(),
          1,
          "read-only preview boundary",
        );
        await capture(page, "preview");
        check(writes, [], "no action submitted");
        scene = "failure";
        const failed = await context.newPage();
        await failed.goto(`${origin}/opportunities/scoring-rules`, {
          waitUntil: "domcontentloaded",
        });
        await failed.getByText("依赖暂时受阻", { exact: true }).waitFor({ timeout: 3000 });
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
    "apps/web/src/components/ScoreRuleConsole.vue",
    "apps/web/src/components/shared/QualityGateSetupSummary.vue",
    "scripts/lib/scoring-page-preview.mjs",
    "scripts/verify-scoring-page-preview.mjs",
    scoringReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P17",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; navigation and score-rule responses are locally intercepted",
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
