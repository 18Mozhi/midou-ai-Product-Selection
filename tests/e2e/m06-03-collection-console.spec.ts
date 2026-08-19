import { expect, test, type Page } from "@playwright/test";

const envelope = (data: unknown) => ({
  data,
  request_id: "m06-03-e2e",
  trace_id: "m06-03-e2e",
});
const providerId = "00000000-0000-4000-8000-000000000630";
const data = {
  filters: {
    organization_id: null,
    workspace_id: null,
    provider_id: null,
    window: "24h",
    error_code: null,
  },
  source_options: [{ id: providerId, code: "news", name: "公开趋势 RSS" }],
  sources: [
    {
      id: providerId,
      code: "news",
      name: "公开趋势 RSS",
      status: "enabled",
      owner_label: "运营组",
      schedule_minutes: 60,
      concurrency_limit: 1,
      parser_version: "v1",
      health_status: "ready",
      last_checked_at: "2026-08-08T12:00:00Z",
      last_latency_ms: 80,
      last_error_code: null,
      consecutive_failures: 0,
    },
  ],
  task_states: [
    { status: "running", total: 2 },
    { status: "dead_letter", total: 1 },
  ],
  dead_letters: [
    {
      id: "d1",
      task_id: "00000000-0000-4000-8000-000000000631",
      organization_id: "00000000-0000-4000-8000-000000000632",
      workspace_id: "00000000-0000-4000-8000-000000000633",
      error_code: "parser_failed",
      status: "open",
      created_at: "2026-08-08T11:00:00Z",
    },
  ],
  quality: [{ severity: "warning", status: "open", total: 3 }],
  attempts: [
    {
      id: "a1",
      task_id: "00000000-0000-4000-8000-000000000631",
      organization_id: "00000000-0000-4000-8000-000000000632",
      workspace_id: "00000000-0000-4000-8000-000000000633",
      attempt_number: 2,
      worker_id: "worker-1",
      status: "failed_terminal",
      error_code: "parser_failed",
      started_at: "2026-08-08T10:00:00Z",
      finished_at: "2026-08-08T10:01:00Z",
      trace_id: "trace-m0603",
    },
  ],
  root_causes: [
    {
      error_code: "parser_failed",
      total: 1,
      latest_at: "2026-08-08T11:00:00Z",
    },
  ],
  links: {
    provider_registry: "/platform-admin/providers",
    adapter_health: "/platform-admin/providers/adapters",
    source_catalog: "/platform-admin/providers/sources",
    task_monitor: "/platform-admin/collection",
    browser_runtime: "/platform-admin/collection/browser-runtime",
    data_quality: "/platform-admin/data",
  },
  observed_at: "2026-08-08T12:00:00Z",
};

async function navigation(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (route) =>
    route.fulfill({
      json: envelope({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_operations_admin"],
        platform_capabilities: ["platform:operate"],
        guard_reason: "allowed",
      }),
    }),
  );
}

test("M06-03.A07/A08/A15 filters source and time, drills exact root cause, and renders responsive UI", async ({
  page,
}) => {
  await navigation(page);
  let consoleUrl = "";
  await page.route("**/api/v1/platform/collection/console?**", (route) => {
    consoleUrl = route.request().url();
    return route.fulfill({ json: envelope(data) });
  });
  await page.goto("/platform-admin/collection/overview");
  await expect(page.getByRole("heading", { name: "来源与采集控制台", level: 2 })).toBeVisible();
  await expect(
    page.locator(".collection-ops table").first().getByText("公开趋势 RSS"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "来源配置" })).toBeVisible();
  await expect(page.getByText("provider_registry")).toHaveCount(0);

  await page.getByLabel("采集来源筛选").selectOption(providerId);
  await page.getByLabel("观测时间筛选").selectOption("7d");
  await page.getByRole("button", { name: "应用范围" }).click();
  await expect.poll(() => consoleUrl).toContain(`provider_id=${providerId}`);
  expect(consoleUrl).toContain("window=7d");

  await page.getByRole("button", { name: /页面解析失败/ }).click();
  await expect.poll(() => consoleUrl).toContain("error_code=parser_failed");
  await expect(page.getByText("终止失败")).toBeVisible();
  await expect(page).toHaveScreenshot("m06-03-collection-console-desktop.png", {
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("最近尝试")).toBeVisible();
  await expect(page.getByRole("button", { name: "应用范围" })).toHaveCSS("white-space", "nowrap");
  await expect(page).toHaveScreenshot("m06-03-collection-console-mobile.png", {
    fullPage: true,
  });
});

test("M06-03.A08/A16 empty forbidden blocked", async ({ page }) => {
  await navigation(page);
  let status = 200;
  await page.route("**/api/v1/platform/collection/console?**", (route) =>
    route.fulfill(
      status === 200
        ? {
            json: envelope({
              ...data,
              sources: [],
              task_states: [],
              dead_letters: [],
              quality: [],
              attempts: [],
              root_causes: [],
            }),
          }
        : {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              error: { action_hint: "按状态恢复" },
              request_id: `m06-03-${status}`,
              trace_id: "x",
            }),
          },
    ),
  );
  await page.goto("/platform-admin/collection/overview");
  await expect(page.getByRole("heading", { name: "当前范围没有采集事实" })).toBeVisible();
  status = 403;
  await page.reload();
  await expect(page.getByRole("heading", { name: "你没有此项权限" })).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByRole("heading", { name: "采集控制台依赖受阻" })).toBeVisible();
});
