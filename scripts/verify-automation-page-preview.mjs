import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import {
  automationPagePlugin,
  automationReviewCss,
  automationRowReviewCss,
} from "./lib/automation-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length
  ? path.resolve(`output/playwright/p27-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output, { recursive: true });

const id = "00000000-0000-4000-8000-000000000553";
const owner = "00000000-0000-4000-8000-000000000554";
const envelope = (data, requestId = "p27-review") => ({
  data,
  request_id: requestId,
  trace_id: requestId,
});
const activeRule = {
  id,
  name: "审批超时人工跟进",
  trigger_event_type: "approval.overdue",
  condition_severity: "warning",
  action_type: "notify_owner",
  owner_id: owner,
  action_assignee_id: null,
  action_title: "审批超时，请人工处理",
  rate_limit_count: 5,
  rate_limit_window_minutes: 60,
  status: "active",
  version: 1,
  latest_execution_status: "dead_letter",
  latest_execution_at: "2026-09-20T03:20:00.000Z",
  latest_error_code: "action_failed",
  updated_at: "2026-09-20T03:20:00.000Z",
};
const pausedRule = {
  ...activeRule,
  id: "00000000-0000-4000-8000-000000000558",
  name: "竞品告警人工复核",
  trigger_event_type: "competitor.alert.queued",
  action_type: "create_task",
  action_assignee_id: owner,
  status: "paused",
  version: 3,
  latest_execution_status: "rate_limited",
  latest_error_code: "rate_limit_exceeded",
};
const preview = {
  mode: "read_only",
  matched_30d: 17,
  matched_in_rate_window: 3,
  projected_action_count: 3,
  projected_task_count: 0,
  projected_notification_count: 3,
  rate_limit_count: 20,
  rate_limit_window_minutes: 60,
  samples: [],
};
const nav = {
  shell: "member",
  organization_id: "p27-org",
  workspace_id: "p27-workspace",
  roles: ["selection_manager"],
  capabilities: ["task:read", "notification:read", "team:manage"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const images = [];
const results = [];
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [automationPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P27 actual Vue review ${origin}`);
  for (const width of [1440, 390])
    for (const motion of ["reduce", "no-preference"]) {
      let checks = 0;
      const writes = [];
      const unexpected = [];
      const errors = [];
      let currentRules = [{ ...activeRule }, { ...pausedRule }];
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
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
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const bytes = await page.screenshot({
          animations: "disabled",
          fullPage: name === "ready",
        });
        const file = `${width}-${name}.png`;
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
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin !== origin) return route.abort();
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const key = `${request.method()} ${url.pathname}`;
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: envelope({ authenticated: true }, "p27-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p27-navigation") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p27-theme"),
            });
          if (key === "GET /api/v1/automations")
            return route.fulfill({ json: envelope(currentRules, "p27-list") });
          if (key === "GET /api/v1/tasks/member-options")
            return route.fulfill({
              json: envelope([{ id: owner, label: "验收负责人" }], "p27-members"),
            });
          if (key === `GET /api/v1/automations/${id}`)
            return route.fulfill({
              json: envelope(
                {
                  ...currentRules.find((rule) => rule.id === id),
                  executions: [
                    {
                      id: "00000000-0000-4000-8000-000000000555",
                      rule_version: 1,
                      notification_id: "00000000-0000-4000-8000-000000000556",
                      status: "succeeded",
                      attempt_count: 1,
                      action_resource_type: "notification",
                      action_resource_id: "00000000-0000-4000-8000-000000000557",
                      last_error_code: null,
                      updated_at: "2026-09-20T03:21:00.000Z",
                    },
                  ],
                },
                "p27-detail",
              ),
            });
          if (key === "POST /api/v1/automations/preview") {
            const body = request.postDataJSON();
            writes.push({ key, body });
            return route.fulfill({
              json: envelope(
                { ...preview, rate_limit_count: body.rate_limit_count },
                "p27-preview",
              ),
            });
          }
          if (key === `POST /api/v1/automations/${id}/actions`) {
            const body = request.postDataJSON();
            writes.push({ key, body });
            currentRules = currentRules.map((rule) =>
              rule.id === id
                ? {
                    ...rule,
                    status: body.action === "pause" ? "paused" : "active",
                    version: rule.version + 1,
                  }
                : rule,
            );
            return route.fulfill({
              json: envelope(
                currentRules.find((rule) => rule.id === id),
                "p27-status",
              ),
            });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/automations`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".automation-center");
        await root
          .getByRole("heading", { name: "自动化规则", exact: true })
          .waitFor({ timeout: 8000 });
        check(
          await root
            .getByText("配置“发生什么情况、通知谁或创建什么任务”，并查看每次执行结果。", {
              exact: true,
            })
            .count(),
          1,
          "scope copy",
        );
        check(await root.locator(".automation-grid article").count(), 2, "two actual rule rows");
        const create = root.getByRole("button", { name: "创建规则", exact: true });
        await create.focus();
        check(
          await create.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "create focus visible",
        );
        await capture(page, "ready");

        await root.getByRole("button", { name: "查看详情", exact: true }).first().click();
        const detail = page.getByRole("dialog", { name: "审批超时人工跟进执行记录" });
        await detail.getByText("规则详情与执行记录", { exact: true }).waitFor({ timeout: 8000 });
        check(
          await detail.getByText("规则 v1 · 尝试 1 次", { exact: true }).count(),
          1,
          "execution detail",
        );
        await capture(page, "detail");
        await page.keyboard.press("Escape");
        check(await page.getByRole("dialog").count(), 0, "detail closes with escape");

        await create.click();
        const editor = page.getByRole("dialog", { name: "创建自动化规则" });
        await editor
          .getByRole("heading", { name: "创建自动化规则", exact: true })
          .waitFor({ timeout: 8000 });
        await editor.getByRole("button", { name: /审批超时提醒/ }).click();
        await editor.getByLabel("规则负责人").selectOption(owner);
        await editor.getByRole("button", { name: "试运行并预览影响", exact: true }).click();
        await editor.getByText("最近 30 天匹配 17 条", { exact: true }).waitFor({ timeout: 8000 });
        check(
          writes[0],
          {
            key: "POST /api/v1/automations/preview",
            body: {
              name: "审批超时提醒",
              description: "审批节点超时后提醒规则负责人跟进。",
              trigger_event_type: "approval.overdue",
              condition_severity: "warning",
              action_type: "notify_owner",
              owner_id: owner,
              action_assignee_id: null,
              action_title: "审批超时，请人工处理",
              rate_limit_count: 20,
              rate_limit_window_minutes: 60,
            },
          },
          "preview is exact read-only contract",
        );
        await editor.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        await capture(page, "create-preview");
        await page.keyboard.press("Escape");

        await root.getByRole("button", { name: "暂停", exact: true }).click();
        await root
          .getByRole("button", { name: "恢复", exact: true })
          .first()
          .waitFor({ timeout: 8000 });
        check(
          writes[1],
          {
            key: `POST /api/v1/automations/${id}/actions`,
            body: { action: "pause", expected_version: 1, reason: "由规则管理页人工暂停" },
          },
          "pause is exact existing action contract",
        );
        check(writes.length, 2, "one preview and one controlled status write");
        check(unexpected, [], "no unexpected API");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks, writes: writes.length });
        console.log(JSON.stringify({ width, motion, checks, writes: writes.length }));
      } finally {
        await context.close();
      }
    }
  const sources = [
    "apps/web/src/components/AutomationRuleCenter.vue",
    "apps/web/src/automation-rules.css",
    "scripts/lib/automation-page-preview.mjs",
    "scripts/verify-automation-page-preview.mjs",
    automationReviewCss,
    automationRowReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P27",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; navigation and automation responses are locally intercepted, including one read-only preview and one controlled status action per viewport/motion group",
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
      checks: results.reduce((sum, result) => sum + result.checks, 0),
      writes: results.reduce((sum, result) => sum + result.writes, 0),
      images: images.length,
      sources: sources.length,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
