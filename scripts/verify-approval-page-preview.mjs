import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { buildApprovalDesignData } from "./lib/ui-phase2-approval-design-data.mjs";
import { approvalPagePlugin, approvalReviewCss } from "./lib/approval-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length
  ? path.resolve(`output/playwright/p25-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output, { recursive: true });
const data = await buildApprovalDesignData(process.cwd()),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  images = [],
  results = [];
const envelope = (value, id = "p25-request", meta) => ({
  data: value,
  request_id: id,
  trace_id: id,
  ...(meta ? { meta } : {}),
});
const nav = {
  shell: "member",
  organization_id: "p25-org",
  workspace_id: "p25-workspace",
  roles: ["selection_manager"],
  capabilities: ["task:read", "task:assign"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const approvalId = data.detail.id,
  list = data.list.data ?? data.list,
  templates = data.templates,
  members = data.members;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [approvalPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P25 actual Vue review ${origin}`);
  for (const width of [1440, 390])
    for (const motion of ["reduce", "no-preference"]) {
      let failed = false,
        checks = 0;
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
        checks += 1;
      };
      const capture = async (page, name) => {
        if (!output || motion !== "reduce") return;
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
            return route.fulfill({ json: envelope({ authenticated: true }, "p25-session") });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(nav, "p25-nav") });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              json: envelope({ theme: "deep-ocean", version: 1 }, "p25-theme"),
            });
          if (key === `GET /api/v1/tasks/approvals/${approvalId}`)
            return failed
              ? route.fulfill({
                  status: 404,
                  json: {
                    error: {
                      code: "approval_not_found",
                      message: "approval_not_found",
                      action_hint: "本地审核恢复提示",
                    },
                    request_id: "p25-missing",
                    trace_id: "p25-missing",
                  },
                })
              : route.fulfill({ json: envelope(data.detail, "p25-detail") });
          if (key === "GET /api/v1/tasks/approvals")
            return route.fulfill({ json: envelope(list, "p25-list", { total: 1 }) });
          if (key === "GET /api/v1/tasks/approval-templates")
            return route.fulfill({ json: envelope(templates, "p25-templates") });
          if (key === "GET /api/v1/tasks/member-options")
            return route.fulfill({ json: envelope(members, "p25-members") });
          if (key === `POST /api/v1/tasks/approvals/${approvalId}/actions`) {
            writes.push({ key, body: request.postDataJSON() });
            return route.fulfill({
              json: envelope(
                { ...data.detail, status: "approved", version: data.detail.version + 1 },
                "p25-action",
              ),
            });
          }
          unexpected.push(key);
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/tasks/approvals`, { waitUntil: "domcontentloaded" });
        const root = page.locator(".approval-workspace");
        await root
          .getByRole("heading", { name: "审批中心", exact: true })
          .waitFor({ timeout: 8000 });
        check(
          await root
            .getByText("先处理到达当前节点的事项；证据差异和历史记录按需展开。", { exact: true })
            .count(),
          1,
          "approval scope copy",
        );
        const queue = root.getByRole("button", { name: "待我处理", exact: true });
        await queue.focus();
        check(
          await queue.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "queue focus visible",
        );
        await capture(page, "ready");
        await root.getByRole("button", { name: /便携净水杯采纳决策复核/ }).click();
        const dialog = page.getByRole("dialog");
        await dialog
          .getByRole("heading", { name: "提交快照与当前证据", exact: true })
          .waitFor({ timeout: 8000 });
        check(
          await dialog.getByText("已有变化", { exact: true }).count(),
          1,
          "captured versus current diff",
        );
        const approve = dialog.getByRole("button", { name: "批准并流转", exact: true });
        check(await approve.isDisabled(), true, "reason required");
        await dialog
          .getByLabel("审批原因（批准与驳回均必填）")
          .fill("证据变化已核对，记录本次批准依据。");
        await capture(page, "detail-decision");
        await approve.click();
        await page.waitForFunction(() => !document.querySelector(".approval-detail[open]"));
        check(
          writes[0],
          {
            key: `POST /api/v1/tasks/approvals/${approvalId}/actions`,
            body: {
              action: "approve",
              reason: "证据变化已核对，记录本次批准依据。",
              expected_version: data.detail.version,
            },
          },
          "exact approve body",
        );
        check(writes.length, 1, "single decision write");
        check(unexpected, [], "no unexpected API");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks, writes: writes.length });
        console.log(JSON.stringify({ width, motion, checks, writes: writes.length }));
      } finally {
        await context.close();
      }
    }
  const sources = [
    "apps/web/src/components/ApprovalWorkspace.vue",
    "apps/web/src/components/ApprovalQueuePanel.vue",
    "scripts/lib/approval-page-preview.mjs",
    "scripts/verify-approval-page-preview.mjs",
    approvalReviewCss,
  ];
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P25",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          scope:
            "local actual Vue C review; navigation and approval responses are locally intercepted",
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
