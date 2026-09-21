import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { taskPagePlugin, taskReviewCss } from "./lib/task-page-preview.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const smoke = process.env.P13_SMOKE === "1",
  widths = smoke ? [390] : [1440, 390],
  motions = smoke ? ["reduce"] : ["reduce", "no-preference"],
  output = args.length ? path.resolve(`output/playwright/p13-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  images = [],
  results = [];
const nav = {
  shell: "member",
  organization_id: "p13-org",
  workspace_id: "p13-workspace",
  roles: ["member"],
  capabilities: [
    "task:read",
    "task:create",
    "task:update",
    "task:assign",
    "trend:read",
    "opportunity:read",
    "competitor:read",
    "sourcing:read",
    "notification:read",
  ],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const task = (id, title, status, extra = {}) => ({
  id,
  title,
  description: "来自当前工作区的任务事实",
  status,
  priority: status === "in_progress" ? "high" : "normal",
  assignee_id: "member-1",
  due_at: "2026-09-21T08:00:00.000Z",
  sla_status: status === "in_progress" ? "due_soon" : "on_track",
  source_type: "manual",
  source_ref_id: null,
  collection_task_id: null,
  progress_percent: status === "in_progress" ? 40 : 0,
  progress_note: null,
  version: status === "in_progress" ? 7 : 3,
  ...extra,
});
const list = () => [
    task("p13-progress", "复核便携咖啡机成本", "in_progress"),
    task("p13-todo", "核对竞品变化", "todo"),
  ],
  summary = () => ({ todo: 1, in_progress: 1, paused: 0, completed: 2, cancelled: 0, overdue: 0 }),
  envelope = (data, id = "p13-request", meta) => ({
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
  plugins: [taskPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P13 actual Vue review ${origin}`);
  for (const width of widths)
    for (const motion of motions) {
      let scene = "ready",
        tasks = list(),
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
            return route.fulfill({ json: envelope({ authenticated: true }, "p13-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p13-nav") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p13-theme"),
            });
          if (key === "GET /api/v1/tasks") {
            if (scene === "failure")
              return route.fulfill(failure(503, "tasks_unavailable", "p13-failure"));
            return route.fulfill({ json: envelope(tasks, "p13-list", { total: 12 }) });
          }
          if (key === "GET /api/v1/tasks/summary")
            return route.fulfill({ json: envelope(summary(), "p13-summary") });
          if (key === "GET /api/v1/tasks/member-options")
            return route.fulfill({
              json: envelope(
                [
                  { id: "member-1", label: "当前成员" },
                  { id: "member-2", label: "运营同事" },
                ],
                "p13-members",
              ),
            });
          if (key === "POST /api/v1/tasks") {
            writes.push({ key, body: request.postDataJSON() });
            tasks = [task("p13-new", "整理供应商证据", "todo"), ...tasks];
            return route.fulfill({ status: 201, json: envelope(tasks[0], "p13-create") });
          }
          if (key === "POST /api/v1/tasks/p13-progress/actions") {
            writes.push({ key, body: request.postDataJSON() });
            tasks = tasks.map((item) =>
              item.id === "p13-progress" ? { ...item, status: "paused", version: 8 } : item,
            );
            return route.fulfill({ json: envelope(tasks[0], "p13-action") });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/work`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".p13-workspace");
        await root
          .getByRole("heading", { name: "先决定下一项需要推进的工作", exact: true })
          .waitFor({ timeout: 8000 });
        check(
          await root
            .getByText("这里是当前工作区中分配给你的全部任务，不等同于仅今天到期。", {
              exact: true,
            })
            .count(),
          1,
          "mine scope wording",
        );
        const create = root.getByRole("button", { name: "新建任务", exact: true });
        await create.focus();
        check(
          await create.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "create focus visible",
        );
        await capture(page, "ready");
        await create.click();
        const dialog = page.getByRole("dialog", { name: "新建任务" });
        await dialog.getByLabel("标题").fill("整理供应商证据");
        await dialog.getByRole("button", { name: "创建任务", exact: true }).click();
        await page.waitForFunction(() => !document.querySelector(".p13-task-dialog[open]"));
        await page.waitForFunction(() => document.querySelectorAll(".task-row-main").length >= 3);
        check(
          writes[0],
          {
            key: "POST /api/v1/tasks",
            body: { title: "整理供应商证据", description: "", priority: "normal", due_at: null },
          },
          "exact create body",
        );
        await capture(page, "created");
        const progressBox = root.getByLabel("选择任务：复核便携咖啡机成本");
        await progressBox.check();
        await root.getByRole("button", { name: "批量暂停", exact: true }).click();
        const batch = page.getByRole("dialog", { name: "确认批量任务操作" });
        await batch.getByLabel("操作原因").fill("等待成本复核");
        await batch.getByRole("button", { name: "确认执行", exact: true }).click();
        await root.getByText(/批量操作完成 1 项/, { exact: false }).waitFor({ timeout: 8000 });
        check(
          writes[1],
          {
            key: "POST /api/v1/tasks/p13-progress/actions",
            body: { action: "pause", expected_version: 7, reason: "等待成本复核" },
          },
          "exact batch action body",
        );
        await capture(page, "batch-paused");
        scene = "failure";
        const failed = await context.newPage();
        await failed.goto(`${origin}/work`, { waitUntil: "domcontentloaded" });
        const failedRoot = failed.locator(".p13-workspace");
        await failedRoot.getByText("任务服务暂不可用", { exact: true }).waitFor({ timeout: 8000 });
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
    "apps/web/src/components/TaskWorkspace.vue",
    "apps/web/src/components/TaskListPanel.vue",
    "apps/web/src/components/TaskBatchActions.vue",
    "scripts/lib/task-page-preview.mjs",
    "scripts/verify-task-page-preview.mjs",
    taskReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P13",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope: "local actual Vue C review; navigation and task responses are locally intercepted",
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
