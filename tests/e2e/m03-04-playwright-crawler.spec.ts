import { test, expect } from "@playwright/test";
const navigation = {
  shell: "platform_admin",
  organization_id: null,
  workspace_id: null,
  roles: [],
  capabilities: [],
  platform_roles: ["platform_operations_admin"],
  platform_capabilities: ["platform:operate", "collection:replay"],
  guard_reason: "navigation_platform_admin_allowed",
};
const profiles = [
  {
    id: "00000000-0000-4000-8000-000000000811",
    code: "market-us",
    name: "US Market Profile",
    provider_id: "00000000-0000-4000-8000-000000000812",
    provider_name: "Market Browser",
    status: "active",
    target_domain: "market.example.test",
    credential_expires_at: "2026-08-10T20:02:00.000Z",
    login_status: "valid",
    last_failure: null,
    lease: {
      run_id: "00000000-0000-4000-8000-000000000821",
      lease_owner: "crawler-s0-01",
      leased_at: "2026-08-07T20:00:00.000Z",
      heartbeat_at: "2026-08-07T20:01:00.000Z",
      expires_at: "2026-08-07T20:02:00.000Z",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000000813",
    code: "supplier-cn",
    name: "Supplier Profile",
    provider_id: "00000000-0000-4000-8000-000000000814",
    provider_name: "Supplier Browser",
    status: "active",
    target_domain: "supplier.example.test",
    credential_expires_at: null,
    login_status: "unknown",
    last_failure: null,
    lease: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000815",
    code: "archive-only",
    name: "Disabled Profile",
    provider_id: "00000000-0000-4000-8000-000000000816",
    provider_name: "Archived Source",
    status: "disabled",
    target_domain: "archive.example.test",
    credential_expires_at: "2026-08-01T00:00:00.000Z",
    login_status: "expired",
    last_failure: null,
    lease: null,
  },
];
const runs = [
  {
    id: "00000000-0000-4000-8000-000000000821",
    organization_id: "00000000-0000-4000-8000-000000000831",
    workspace_id: "00000000-0000-4000-8000-000000000841",
    provider_id: profiles[0].provider_id,
    crawler_profile_id: profiles[0].id,
    status: "running",
    page_count: 2,
    item_count: 18,
    detail_count: 4,
    duration_ms: null,
    error_code: null,
    request_id: "request-running",
    trace_id: "trace-running",
    started_at: "2026-08-07T20:00:00.000Z",
    finished_at: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000822",
    organization_id: "00000000-0000-4000-8000-000000000832",
    workspace_id: "00000000-0000-4000-8000-000000000842",
    provider_id: profiles[1].provider_id,
    crawler_profile_id: profiles[1].id,
    status: "succeeded",
    page_count: 3,
    item_count: 42,
    detail_count: 12,
    duration_ms: 8432,
    error_code: null,
    request_id: "request-success",
    trace_id: "trace-success",
    started_at: "2026-08-07T19:45:00.000Z",
    finished_at: "2026-08-07T19:45:08.432Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000823",
    organization_id: "00000000-0000-4000-8000-000000000833",
    workspace_id: "00000000-0000-4000-8000-000000000843",
    provider_id: profiles[0].provider_id,
    crawler_profile_id: profiles[0].id,
    status: "blocked",
    page_count: 1,
    item_count: 0,
    detail_count: 0,
    duration_ms: 913,
    error_code: "blocked_captcha",
    request_id: "request-blocked",
    trace_id: "trace-blocked",
    started_at: "2026-08-07T19:30:00.000Z",
    finished_at: "2026-08-07T19:30:00.913Z",
  },
];
async function nav(page: any) {
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: navigation, request_id: "m03-04-nav", trace_id: "m03-04-nav" }),
    }),
  );
}
const runtimePath = "/platform-admin/collection/browser-runtime";
test("M03-04.A07/A08/A15 runtime monitor is responsive and visual", async ({ page }) => {
  await nav(page);
  await page.route("**/api/v1/platform/crawler-runtime", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { profiles, runs, observed_at: "2026-08-07T20:02:00.000Z" },
        request_id: "m03-04-list",
        trace_id: "m03-04-list",
      }),
    }),
  );
  await page.goto(runtimePath);
  await expect(page.getByRole("heading", { name: "采集运行监控", level: 2 })).toBeVisible();
  await expect(page.getByText("US Market Profile")).toBeVisible();
  await expect(page.getByText("过期占用", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/租约已过期，存在僵尸占用风险/)).toBeVisible();
  await expect(
    page.getByText("Market Browser · market.example.test", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/登录档案到期预警：即将到期 · 3 天后/)).toBeVisible();
  await expect(page.getByText("登录档案到期预警：未提供有效期，无法预测")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await expect(page.getByRole("button", { name: /已拦截 · 0 条.*需要验证码/ })).toBeVisible();
    await page.getByRole("button", { name: /已拦截 · 0 条/ }).click();
    await page.getByText("技术详情").click();
    await expect(page.getByText(runs[2].id, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "关闭详情" }).last().click();
  } else await expect(page.getByText("需要验证码", { exact: true })).toBeVisible();
  // Functional assertions remain here; real-data visual evidence is captured by the real API suite.
});
test("M03-04.A08 filters and confirmed recovery stay explicit", async ({ page }) => {
  await nav(page);
  await page.route("**/api/v1/platform/crawler-runtime", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { profiles, runs, observed_at: "2026-08-07T20:02:00.000Z" },
        request_id: "m03-04-list",
        trace_id: "m03-04-list",
      }),
    }),
  );
  await page.route("**/api/v1/platform/crawler-runtime/recover-expired", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { recovered: 1 },
        request_id: "m03-04-recover",
        trace_id: "m03-04-recover",
      }),
    }),
  );
  await page.goto(runtimePath);
  await page.getByLabel("运行状态").selectOption("blocked");
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await expect(page.getByRole("button", { name: /已拦截 · 0 条.*需要验证码/ })).toBeVisible();
  else await expect(page.getByText("需要验证码", { exact: true })).toBeVisible();
  await expect(page.getByText("42 条")).toHaveCount(0);
  await page.getByRole("button", { name: "回收过期运行" }).click();
  await page.getByPlaceholder("确认回收").fill("确认回收");
  await page.getByRole("button", { name: "确认回收" }).click();
  await expect(page.getByText("US Market Profile")).toBeVisible();
});
test("M03-04.A08/A09/A16 empty forbidden and dependency states are truthful", async ({ page }) => {
  await nav(page);
  let status = 200;
  await page.route("**/api/v1/platform/crawler-runtime", (route) =>
    route.fulfill(
      status === 200
        ? {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              data: { profiles: [], runs: [], observed_at: "2026-08-07T20:02:00.000Z" },
              request_id: "m03-04-empty",
              trace_id: "m03-04-empty",
            }),
          }
        : {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: status === 403 ? "authorization_denied" : "dependency_unavailable",
                message: "请求失败",
                action_hint: "按状态恢复",
              },
              request_id: `m03-04-${status}`,
              trace_id: `m03-04-${status}`,
            }),
          },
    ),
  );
  await page.goto(runtimePath);
  await expect(page.locator('[data-kind="empty"]')).toBeVisible();
  status = 403;
  await page.reload();
  await expect(page.locator('[data-kind="forbidden"]')).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.locator('[data-kind="blocked"]')).toBeVisible();
});
