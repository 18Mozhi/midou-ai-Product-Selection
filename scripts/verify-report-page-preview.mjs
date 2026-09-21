import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { reportPagePlugin, reportReviewCss } from "./lib/report-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  !args.length ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const out = args.length ? path.resolve(`output/playwright/p28-page-composition-${args[1]}`) : null;
if (out) await mkdir(out, { recursive: true });
const env = (data, id = "p28") => ({ data, request_id: id, trace_id: id });
const exportId = "00000000-0000-4000-8000-000000000563";
const report = {
  type: "opportunity",
  summary: {
    total: 28,
    adopted: 8,
    observing: 9,
    rejected: 4,
    complete_coverage: 17,
    average_score: 78.6,
  },
  series: [
    { label: "recommend", value: 12 },
    { label: "observe", value: 9 },
    { label: "not_recommend", value: 4 },
    { label: "insufficient_data", value: 3 },
  ],
  observed_at: "2026-08-08T12:00:00.000Z",
};
const exportRow = {
  id: exportId,
  report_type: "opportunity",
  format: "csv",
  status: "succeeded",
  attempt_count: 1,
  filename: "scoutops-opportunity.csv",
  row_count: 28,
  byte_size: 4096,
  expires_at: "2026-10-09T12:00:00.000Z",
  last_error_code: null,
  queue_position: null,
  estimated_completion_at: null,
  estimate_sample_size: 0,
  version: 3,
  created_at: "2026-09-08T12:00:00.000Z",
  updated_at: "2026-09-08T12:01:00.000Z",
};
const activeExport = {
  id: "00000000-0000-4000-8000-000000000564",
  report_type: "trend",
  format: "csv",
  status: "leased",
  attempt_count: 1,
  filename: "scoutops-trend.csv",
  row_count: null,
  byte_size: null,
  expires_at: "2026-10-09T12:00:00.000Z",
  last_error_code: null,
  queue_position: 1,
  estimated_completion_at: "2026-09-20T12:04:00.000Z",
  estimate_sample_size: 10,
  version: 2,
  created_at: "2026-09-08T12:02:00.000Z",
  updated_at: "2026-09-08T12:02:01.000Z",
};
const expiredExport = {
  ...exportRow,
  id: "00000000-0000-4000-8000-000000000565",
  report_type: "team",
  status: "expired",
  filename: "scoutops-team.csv",
  version: 4,
  expires_at: "2026-09-01T12:00:00.000Z",
};
const nav = {
  shell: "member",
  organization_id: "p28-org",
  workspace_id: "p28-ws",
  roles: ["selection_manager"],
  capabilities: ["task:read", "report:read"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const images = [],
  results = [],
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [reportPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P28 actual Vue review ${origin}`);
  for (const width of [1440, 390])
    for (const motion of ["reduce", "no-preference"]) {
      let checks = 0;
      const writes = [],
        unexpected = [],
        errors = [];
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      const check = (a, b, label) => {
        assert.deepEqual(a, b, `${width}/${motion}: ${label}`);
        checks++;
      };
      const capture = async (page, name) => {
        if (!out || motion !== "reduce") return;
        const bytes = await page.screenshot({ animations: "disabled", fullPage: name === "ready" });
        const file = `${width}-${name}.png`;
        await writeFile(path.join(out, file), bytes);
        images.push({
          file,
          sha256: hash(bytes),
          pixelWidth: bytes.readUInt32BE(16),
          pixelHeight: bytes.readUInt32BE(20),
        });
      };
      try {
        context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
        await context.route("**/*", async (route) => {
          const q = route.request(),
            u = new URL(q.url()),
            k = `${q.method()} ${u.pathname}`;
          if (u.origin !== origin) return route.abort();
          if (!u.pathname.startsWith("/api/")) return route.continue();
          if (k === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: env({ authenticated: true }, "p28-session") });
          if (k === "GET /api/v1/me/navigation")
            return route.fulfill({ json: env(nav, "p28-nav") });
          if (k === "GET /api/v1/me/ui-preferences")
            return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }, "p28-theme") });
          if (k === "GET /api/v1/reports/opportunity")
            return route.fulfill({ json: env(report, "p28-report") });
          if (k === "GET /api/v1/report-exports")
            return route.fulfill({
              json: env([exportRow, activeExport, expiredExport], "p28-exports"),
            });
          if (k === `GET /api/v1/report-exports/${exportId}`)
            return route.fulfill({ json: env(exportRow, "p28-detail") });
          if (k === "POST /api/v1/report-exports") {
            writes.push({ k, body: q.postDataJSON() });
            return route.fulfill({
              status: 202,
              json: env(
                {
                  ...activeExport,
                  id: "00000000-0000-4000-8000-000000000567",
                  report_type: "opportunity",
                  status: "queued",
                },
                "p28-create",
              ),
            });
          }
          unexpected.push(k);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/reports`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".report-center");
        await root
          .getByRole("heading", { name: "报表与导出", exact: true })
          .waitFor({ timeout: 8000 });
        check(
          await root
            .getByText("共 28 个机会，已采纳 8 个，证据完整 17 个。", { exact: true })
            .count(),
          1,
          "factual conclusion",
        );
        check(
          await root.locator(".report-export-list article").count(),
          3,
          "export lifecycle rows",
        );
        const create = root.getByRole("button", { name: "导出当前报表 CSV", exact: true });
        await create.focus();
        check(
          await create.evaluate((n) => getComputedStyle(n).outlineWidth),
          "3px",
          "export focus",
        );
        await capture(page, "ready");
        await root.getByRole("button", { name: "查看详情", exact: true }).first().click();
        const detail = page.getByRole("dialog", { name: "机会分析导出详情" });
        await detail.getByText("数据行数", { exact: true }).waitFor({ timeout: 8000 });
        check(await detail.getByText("4096 字节", { exact: true }).count(), 1, "detail file facts");
        await capture(page, "detail");
        await page.keyboard.press("Escape");
        check(await page.getByRole("dialog").count(), 0, "escape closes detail");
        await page.waitForFunction(() => !new URL(location.href).searchParams.has("export"));
        const created = page.waitForRequest("**/api/v1/report-exports");
        await create.click();
        await created;
        check(
          writes[0],
          { k: "POST /api/v1/report-exports", body: { report_type: "opportunity", format: "csv" } },
          "exact csv creation",
        );
        check(writes.length, 1, "one controlled export write");
        check(unexpected, [], "no unexpected API");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks, writes: writes.length });
        console.log(JSON.stringify({ width, motion, checks, writes: writes.length }));
      } finally {
        await context.close();
      }
    }
  const sources = [
    "apps/web/src/components/ReportCenter.vue",
    "apps/web/src/report-center.css",
    "scripts/lib/report-page-preview.mjs",
    "scripts/verify-report-page-preview.mjs",
    reportReviewCss,
  ];
  if (out)
    await writeFile(
      path.join(out, "manifest.json"),
      JSON.stringify(
        {
          page: "P28",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope: "local actual Vue C review; report and export responses are locally intercepted",
          sources: Object.fromEntries(
            await Promise.all(sources.sort().map(async (f) => [f, hash(await readFile(f))])),
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
      checks: results.reduce((n, r) => n + r.checks, 0),
      writes: results.reduce((n, r) => n + r.writes, 0),
      images: images.length,
      sources: sources.length,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
