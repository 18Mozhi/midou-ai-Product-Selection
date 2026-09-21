import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { allTaskPagePlugin, allTaskReviewCss } from "./lib/all-task-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const smoke = process.env.P23_SMOKE === "1",
  widths = smoke ? [390] : [1440, 390],
  motions = smoke ? ["reduce"] : ["reduce", "no-preference"],
  output = args.length ? path.resolve(`output/playwright/p23-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  images = [],
  results = [];
const envelope = (data, request_id = "p23-request", meta) => ({
  data,
  request_id,
  trace_id: request_id,
  ...(meta ? { meta } : {}),
});
const failure = () => ({
  status: 503,
  json: {
    error: {
      code: "tasks_unavailable",
      message: "tasks_unavailable",
      action_hint: "本地审核恢复提示",
    },
    request_id: "p23-failure",
    trace_id: "p23-failure",
  },
});
const nav = {
  shell: "member",
  organization_id: "p23-org",
  workspace_id: "p23-workspace",
  roles: ["member"],
  capabilities: ["task:read", "task:create", "task:update", "task:assign"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const task = (id, title, status, extra = {}) => ({
  id,
  title,
  description: "当前工作区的真实任务事实",
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
  version: 3,
  ...extra,
});
const list = [
    task("p23-progress", "复核便携咖啡机成本", "in_progress"),
    task("p23-todo", "核对竞品变化", "todo"),
    task("p23-paused", "等待供应商补齐规格", "paused"),
  ],
  summary = { todo: 1, in_progress: 1, paused: 1, completed: 2, cancelled: 0, overdue: 0 };
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [allTaskPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P23 actual Vue review ${origin}`);
  for (const width of widths)
    for (const motion of motions) {
      let scene = "ready",
        checks = 0;
      const writes = [],
        errors = [],
        unexpected = [],
        context = await browser.newContext({
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
            return route.fulfill({ json: envelope({ authenticated: true }, "p23-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p23-nav") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p23-theme"),
            });
          if (key === "GET /api/v1/tasks")
            return scene === "failure"
              ? route.fulfill(failure())
              : route.fulfill({ json: envelope(list, "p23-list", { total: 23 }) });
          if (key === "GET /api/v1/tasks/summary")
            return route.fulfill({ json: envelope(summary, "p23-summary") });
          if (key === "GET /api/v1/tasks/member-options")
            return route.fulfill({
              json: envelope([{ id: "member-1", label: "当前成员" }], "p23-members"),
            });
          if (request.method() !== "GET") {
            writes.push({ key, body: request.postData() });
            return route.fulfill({ json: envelope({}, "p23-write") });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/tasks`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".p13-workspace");
        await root
          .getByRole("heading", { name: "在任务目录中定位下一项工作", exact: true })
          .waitFor({ timeout: 8000 });
        check(
          await root
            .getByText("这里展示当前工作区任务；下方本人汇总只用于提示优先事项，不代表目录总量。", {
              exact: true,
            })
            .count(),
          1,
          "all-directory scope wording",
        );
        check(
          await root.getByText("工作区任务目录", { exact: true }).count(),
          1,
          "directory not personal queue",
        );
        const create = root.getByRole("button", { name: "新建任务", exact: true });
        await create.focus();
        check(
          await create.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "create focus visible",
        );
        check(writes, [], "no task action submitted");
        await capture(page, "ready");
        scene = "failure";
        const failed = await context.newPage();
        await failed.goto(`${origin}/tasks`, { waitUntil: "domcontentloaded" });
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
    "apps/web/src/task-workspace.css",
    "scripts/lib/all-task-page-preview.mjs",
    "scripts/verify-all-task-page-preview.mjs",
    allTaskReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P23",
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
