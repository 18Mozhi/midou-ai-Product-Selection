import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { sourcingPagePlugin, sourcingReviewCss } from "./lib/sourcing-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const smoke = process.env.P21_SMOKE === "1",
  widths = smoke ? [390] : [1440, 390],
  motions = smoke ? ["reduce"] : ["reduce", "no-preference"],
  output = args.length ? path.resolve(`output/playwright/p21-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [],
  results = [];
const id = "00000000-0000-4000-8000-000000002121",
  envelope = (data, request_id = "p21-request") => ({ data, request_id, trace_id: request_id });
const failure = () => ({
  status: 503,
  json: {
    error: {
      code: "sourcing_unavailable",
      message: "sourcing_unavailable",
      action_hint: "本地审核恢复提示",
    },
    request_id: "p21-failure",
    trace_id: "p21-failure",
  },
});
const nav = {
  shell: "member",
  organization_id: "p21-org",
  workspace_id: "p21-workspace",
  roles: ["member"],
  capabilities: ["sourcing:read", "supplier_quote:manage"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const candidate = {
  id: "p21-candidate",
  supplier_name: "华东收纳用品厂",
  product_title: "可折叠厨房置物架",
  specification: "碳钢，三层",
  moq: 100,
  quoted_price: 18.8,
  currency: "CNY",
  lead_time_days: 12,
  location: "浙江",
  original_url: "https://example.test/p21",
  observed_at: "2026-09-20T08:00:00.000Z",
  evidence_id: "p21-evidence",
  confidence_value: 86,
  status: "ready",
  missing_fields: [],
  quote: {
    id: "p21-quote",
    version: 2,
    stability_status: "stable",
    risk_level: "low",
    observed_at: "2026-09-20T08:00:00.000Z",
    evidence_id: "p21-evidence",
  },
};
const list = {
  id,
  input_type: "keyword",
  input_ref: "可折叠厨房置物架",
  display_name: "厨房置物架找货",
  status: "completed",
  candidate_count: 1,
  missing_fields: [],
  created_at: "2026-09-20T07:00:00.000Z",
  updated_at: "2026-09-20T08:00:00.000Z",
};
const detail = {
  ...list,
  candidates: [candidate],
  collection_task_id: "p21-task",
  collection_progress: {
    status: "completed",
    total_subqueries: 3,
    successful_subqueries: 2,
    failed_subqueries: 1,
    blocked_subqueries: 0,
    active_subqueries: 0,
    available_at: "2026-09-20T08:00:00.000Z",
  },
  erp_reference: null,
};
const comparisons = [
  {
    id: "p21-comparison",
    name: "厨房置物架历史对比",
    created_at: "2026-09-20T09:00:00.000Z",
    quotes: [
      {
        id: "p21-quote",
        supplier_name: candidate.supplier_name,
        product_title: candidate.product_title,
        specification: "碳钢，三层",
        moq: 100,
        quoted_price: 18.8,
        currency: "CNY",
        lead_time_days: 12,
        location: "浙江",
        confidence_value: 86,
        stability_status: "stable",
        risk_level: "low",
        evidence_id: "p21-evidence",
      },
    ],
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
  plugins: [sourcingPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P21 actual Vue review ${origin}`);
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
            return route.fulfill({ json: envelope({ authenticated: true }, "p21-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p21-nav") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p21-theme"),
            });
          if (key === "GET /api/v1/sourcing/searches")
            return scene === "failure"
              ? route.fulfill(failure())
              : route.fulfill({ json: envelope([list], "p21-list") });
          if (key === "GET /api/v1/sourcing/comparisons")
            return route.fulfill({ json: envelope(comparisons, "p21-comparisons") });
          if (key === `GET /api/v1/sourcing/searches/${id}`)
            return route.fulfill({ json: envelope(detail, "p21-detail") });
          if (request.method() !== "GET") {
            writes.push({ key, body: request.postData() });
            return route.fulfill({ json: envelope({}, "p21-write") });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/sourcing`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".sourcing-workspace");
        await root
          .getByRole("heading", { name: "厨房置物架找货", exact: true })
          .waitFor({ timeout: 8000 });
        await root.getByText("CNY 18.8", { exact: true }).first().waitFor({ timeout: 8000 });
        check(
          await root.getByText("待费用规则计算", { exact: true }).count(),
          1,
          "landed cost remains unresolved",
        );
        check(
          await root.getByText("证据 p21-evidence", { exact: true }).count(),
          1,
          "candidate evidence visible",
        );
        check(
          await root.getByText("供应商报价对比历史", { exact: true }).count(),
          1,
          "comparison evidence remains separate",
        );
        const refresh = root.getByRole("button", { name: "重新采集", exact: true });
        await refresh.focus();
        check(
          await refresh.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "refresh focus visible",
        );
        await capture(page, "ready");
        check(writes, [], "no sourcing action submitted");
        scene = "failure";
        const failed = await context.newPage();
        await failed.goto(`${origin}/sourcing`, { waitUntil: "domcontentloaded" });
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
    "apps/web/src/components/SourcingWorkspace.vue",
    "apps/web/src/components/SourcingComparisonPanel.vue",
    "apps/web/src/sourcing.css",
    "scripts/lib/sourcing-page-preview.mjs",
    "scripts/verify-sourcing-page-preview.mjs",
    sourcingReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P21",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; navigation and sourcing responses are locally intercepted",
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
