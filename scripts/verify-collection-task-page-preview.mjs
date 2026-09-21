import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { collectionTaskPagePlugin } from "./lib/collection-task-page-preview.mjs";

const out =
  process.argv[2] === "--capture-review"
    ? path.resolve(`output/playwright/p51-page-composition-${process.argv[3]}`)
    : null;
if (out) await mkdir(out, { recursive: true });
const ids = {
  warning: "00000000-0000-4000-8000-000000000951",
  dead: "00000000-0000-4000-8000-000000000952",
  org: "00000000-0000-4000-8000-000000000961",
  workspace: "00000000-0000-4000-8000-000000000971",
};
const env = (data) => ({ data, request_id: "p51-review", trace_id: "p51-review" });
const tasks = [
  {
    id: ids.warning,
    organization_id: ids.org,
    workspace_id: ids.workspace,
    status: "completed_with_warnings",
    coverage_status: "partial",
    priority: "high",
    scheduled_at: "2026-08-07T20:00:00.000Z",
    available_at: "2026-08-07T20:00:00.000Z",
    attempt_count: 2,
    successful_subquery_count: 2,
    failed_subquery_count: 1,
    blocked_subquery_count: 0,
    available_result_count: 38,
    missing_fields: ["supplier.moq"],
    last_error_code: "parse_failed",
    replay_of_task_id: null,
    replay_reason: null,
    request_id: "p51-warning-request",
    trace_id: "p51-warning-trace",
    version: 8,
    created_at: "2026-08-07T20:00:00.000Z",
    updated_at: "2026-08-07T20:08:00.000Z",
  },
  {
    id: ids.dead,
    organization_id: ids.org,
    workspace_id: ids.workspace,
    status: "dead_letter",
    coverage_status: null,
    priority: "critical",
    scheduled_at: "2026-08-07T18:00:00.000Z",
    available_at: "2026-08-07T18:21:00.000Z",
    attempt_count: 4,
    successful_subquery_count: 0,
    failed_subquery_count: 1,
    blocked_subquery_count: 0,
    available_result_count: 0,
    missing_fields: ["market.price"],
    last_error_code: "timeout",
    replay_of_task_id: null,
    replay_reason: null,
    request_id: "p51-dead-request",
    trace_id: "p51-dead-trace",
    version: 14,
    created_at: "2026-08-07T18:00:00.000Z",
    updated_at: "2026-08-07T18:37:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000954",
    organization_id: ids.org,
    workspace_id: ids.workspace,
    status: "running",
    coverage_status: null,
    priority: "normal",
    scheduled_at: "2026-08-07T20:10:00.000Z",
    available_at: "2026-08-07T20:10:00.000Z",
    attempt_count: 1,
    successful_subquery_count: 0,
    failed_subquery_count: 0,
    blocked_subquery_count: 0,
    available_result_count: 0,
    missing_fields: [],
    last_error_code: null,
    replay_of_task_id: null,
    replay_reason: null,
    request_id: "p51-running-request",
    trace_id: "p51-running-trace",
    version: 3,
    created_at: "2026-08-07T20:10:00.000Z",
    updated_at: "2026-08-07T20:11:00.000Z",
  },
];
const detail = {
  task: tasks[1],
  subqueries: [
    {
      id: "00000000-0000-4000-8000-000000000981",
      provider_id: "00000000-0000-4000-8000-000000000982",
      provider_name: "Market Signals",
      ordinal: 1,
      is_required: true,
      status: "failed",
      available_result_count: 0,
      missing_fields: ["market.price"],
      error_code: "timeout",
      result_kind: null,
      robots_decision: null,
      retryable: false,
      started_at: "2026-08-07T18:21:00.000Z",
      finished_at: "2026-08-07T18:37:00.000Z",
    },
  ],
  attempts: [1, 2, 3, 4].map((attempt_number) => ({
    id: `attempt-${attempt_number}`,
    attempt_number,
    status: attempt_number === 4 ? "dead_letter" : "retry_scheduled",
    error_code: "timeout",
  })),
  events: [
    {
      id: "event-1",
      event_type: "collection.task.dead_letter",
      from_status: "running",
      to_status: "dead_letter",
      occurred_at: "2026-08-07T18:37:00.000Z",
    },
  ],
  dead_letter: {
    id: "dead-1",
    error_code: "timeout",
    status: "open",
    created_at: "2026-08-07T18:37:00.000Z",
  },
};
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [collectionTaskPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
});
let browser;
const manifest = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const reads = [],
      errors = [],
      writes = [];
    const ctx = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    try {
      await ctx.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const key = `${request.method()} ${url.pathname}`;
        if (url.origin !== `http://127.0.0.1:${port}`) return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (request.method() !== "GET") {
          writes.push(key);
          return route.abort();
        }
        reads.push(key);
        if (key === "GET /api/v1/auth/session-status")
          return route.fulfill({ json: env({ authenticated: true }) });
        if (key === "GET /api/v1/me/navigation")
          return route.fulfill({
            json: env({
              shell: "platform_admin",
              organization_id: null,
              workspace_id: null,
              roles: [],
              capabilities: [],
              platform_roles: ["platform_operations_admin"],
              platform_capabilities: ["platform:operate", "collection:replay"],
            }),
          });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        if (key === "GET /api/v1/platform/collection/tasks")
          return route.fulfill({
            json: { ...env(tasks), meta: { page: 1, page_size: 50, total: tasks.length } },
          });
        if (key === `GET /api/v1/platform/collection/tasks/${ids.dead}`)
          return route.fulfill({ json: env(detail) });
        return route.abort();
      });
      const page = await ctx.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/platform-admin/collection`, {
        waitUntil: "domcontentloaded",
      });
      const root = page.locator(".collection-task-center");
      await root.getByRole("heading", { name: "采集任务监控" }).waitFor({ timeout: 8000 });
      assert.equal((await root.getByText("部分完成", { exact: true }).count()) > 0, true);
      const refresh = root.getByRole("button", { name: "刷新任务" });
      await refresh.focus();
      assert.equal(await refresh.evaluate((node) => getComputedStyle(node).outlineWidth), "3px");
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-ready.png`), fullPage: true });
      await page.goto(`http://127.0.0.1:${port}/platform-admin/collection?task=${ids.dead}`, {
        waitUntil: "domcontentloaded",
      });
      await root.getByText("Market Signals", { exact: true }).waitFor({ timeout: 8000 });
      assert.equal(await root.getByRole("button", { name: "人工重放" }).count(), 1);
      assert.equal(writes.length, 0);
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-detail.png`), fullPage: true });
      assert.deepEqual(errors, []);
      manifest.push({ width, checks: 8, interceptedReads: reads.length, writes: writes.length });
      console.log(JSON.stringify(manifest.at(-1)));
    } finally {
      await ctx.close();
    }
  }
  if (out)
    await writeFile(
      path.join(out, "manifest.json"),
      `${JSON.stringify({ groups: manifest, source: "actual CollectionTaskCenter Vue surface" }, null, 2)}\n`,
    );
} finally {
  await browser?.close();
  await server.close();
}
