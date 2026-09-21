import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { costRulePagePlugin, costRuleReviewCss } from "./lib/cost-rule-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const smoke = process.env.P22_SMOKE === "1",
  widths = smoke ? [390] : [1440, 390],
  motions = smoke ? ["reduce"] : ["reduce", "no-preference"],
  output = args.length ? path.resolve(`output/playwright/p22-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [],
  results = [];
const envelope = (data, request_id = "p22-request") => ({ data, request_id, trace_id: request_id });
const failure = () => ({
  status: 503,
  json: {
    error: {
      code: "cost_rules_unavailable",
      message: "cost_rules_unavailable",
      action_hint: "本地审核恢复提示",
    },
    request_id: "p22-failure",
    trace_id: "p22-failure",
  },
});
const nav = {
  shell: "member",
  organization_id: "p22-org",
  workspace_id: "p22-workspace",
  roles: ["selection_manager", "organization_admin"],
  capabilities: ["opportunity:read", "opportunity:approve"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const active = {
  id: "00000000-0000-4000-8000-000000002222",
  market: "US",
  platform: "amazon",
  version_code: "US-AMZ-2026-01",
  name: "美国 Amazon 厨房用品成本规则",
  status: "active",
  fee_lines: [
    { type: "platform_fee", mode: "percentage_of_sale", value: 15, currency: null },
    { type: "payment_fee", mode: "percentage_of_sale", value: 3, currency: null },
    { type: "tax", mode: "percentage_of_sale", value: 1.5, currency: null },
    { type: "fulfillment", mode: "fixed_amount", value: 4.2, currency: "USD" },
  ],
  conversion_rates: [
    {
      base_currency: "CNY",
      quote_currency: "USD",
      rate_value: 0.14,
      effective_on: "2026-09-20",
      source_url: "https://example.test/rate",
    },
  ],
  automatic_scope: null,
  effective_from: "2026-09-20",
  revision: 5,
  approvals: ["selection_manager", "organization_admin"],
  published_at: "2026-09-20T08:00:00.000Z",
  updated_at: "2026-09-20T08:00:00.000Z",
};
const draft = {
  ...active,
  id: "00000000-0000-4000-8000-000000002223",
  version_code: "US-AMZ-2026-02",
  name: "美国 Amazon 厨房用品下一版本",
  status: "draft",
  revision: 1,
  approvals: [],
  published_at: null,
};
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [costRulePagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P22 actual Vue review ${origin}`);
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
            return route.fulfill({ json: envelope({ authenticated: true }, "p22-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p22-nav") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p22-theme"),
            });
          if (key === "GET /api/v1/cost-rules")
            return scene === "failure"
              ? route.fulfill(failure())
              : route.fulfill({ json: envelope([active, draft], "p22-list") });
          if (request.method() !== "GET") {
            writes.push({ key, body: request.postData() });
            return route.fulfill({ json: envelope({}, "p22-write") });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/sourcing/cost-rules`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".cost-console");
        await root
          .getByRole("heading", { name: "成本质量门", exact: true })
          .waitFor({ timeout: 8000 });
        await root
          .getByText("美国 Amazon 厨房用品成本规则", { exact: true })
          .first()
          .waitFor({ timeout: 8000 });
        check(
          await root.getByText("生效中", { exact: true }).count(),
          3,
          "active state visible in list and detail",
        );
        check(
          await root.getByText("按售价百分比", { exact: true }).count(),
          3,
          "fee modes shown as facts",
        );
        check(
          await root.getByText("1 CNY = 0.14 USD", { exact: true }).count(),
          1,
          "conversion source displayed",
        );
        const create = root.getByRole("button", { name: "新建规则版本", exact: true });
        await create.focus();
        check(
          await create.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "create focus visible",
        );
        await capture(page, "ready");
        check(writes, [], "no cost action submitted");
        scene = "failure";
        const failed = await context.newPage();
        await failed.goto(`${origin}/sourcing/cost-rules`, { waitUntil: "domcontentloaded" });
        await failed.getByText("依赖暂时受阻", { exact: true }).waitFor({ timeout: 8000 });
        check(
          await failed.getByRole("button", { name: "刷新列表", exact: true }).count(),
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
    "apps/web/src/components/CostRuleConsole.vue",
    "apps/web/src/components/shared/QualityGateSetupSummary.vue",
    "apps/web/src/profit.css",
    "scripts/lib/cost-rule-page-preview.mjs",
    "scripts/verify-cost-rule-page-preview.mjs",
    costRuleReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P22",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; navigation and cost-rule responses are locally intercepted",
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
