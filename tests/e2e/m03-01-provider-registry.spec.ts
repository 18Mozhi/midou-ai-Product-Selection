import { test, expect } from "@playwright/test";
const definition = {
    id: "00000000-0000-4000-8000-000000000702",
    code: "public_signal_rss",
    name: "公开趋势 RSS",
    target_url: "https://example.test/feed",
    access_mode: "public_rss",
    markets: ["US", "CA"],
    languages: ["en-US"],
    fields: ["title", "summary", "published_at", "canonical_url", "publisher"],
    schedule_minutes: 30,
    concurrency_limit: 1,
    timeout_ms: 15000,
    retry_limit: 2,
    circuit_failure_threshold: 5,
    dedupe_key: "canonical_url",
    retention_days: 365,
    failure_rules: ["timeout", "rate_limited", "parser_changed", "empty"],
    parser_version: "v1",
    healthcheck_url: "https://example.test/health",
    owner_label: "平台运营",
    terms_review_status: "approved",
    terms_reference_url: "https://example.test/terms",
    terms_version: "2026-08",
    terms_expires_at: "2027-08-07T17:00:00.000Z",
    terms_reviewed_at: "2026-08-07T17:00:00.000Z",
    status: "disabled",
    version: 1,
    updated_at: "2026-08-07T17:00:00.000Z",
  },
  navigation = {
    shell: "platform_admin",
    organization_id: null,
    workspace_id: null,
    roles: [],
    capabilities: [],
    platform_roles: ["platform_super_admin"],
    platform_capabilities: [
      "platform:operate",
      "platform:secure",
      "platform:superadmin",
      "provider:configure",
    ],
    guard_reason: "navigation_platform_admin_allowed",
  };
async function nav(page: any) {
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: navigation, request_id: "m03-01-nav", trace_id: "m03-01-nav" }),
    }),
  );
}
test("M03-01.A07/A08/A15 provider list and editor are responsive and visual", async ({
  page,
}, testInfo) => {
  await nav(page);
  await page.route("**/api/v1/platform/providers", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [definition],
        request_id: "m03-01-list",
        trace_id: "m03-01-list",
      }),
    }),
  );
  await page.goto("/platform-admin/providers");
  await expect(page.getByRole("heading", { name: "来源注册中心", level: 2 })).toBeVisible();
  if (testInfo.project.name === "mobile-390") {
    await expect(page.getByText("公开趋势 RSS · 未启用", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /公开趋势 RSS · 未启用/ }).click();
    const dialog = page.getByRole("dialog", { name: "公开趋势 RSS" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("公开订阅源", { exact: true })).toBeVisible();
    await dialog.getByText("技术详情").click();
    await expect(dialog.getByText(definition.id)).toBeVisible();
    await dialog.getByRole("button", { name: "关闭详情" }).click();
  } else {
    await expect(page.getByText("公开趋势 RSS", { exact: true })).toBeVisible();
    await expect(page.getByText("未启用", { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "新建来源" }).click();
  await expect(page.getByRole("heading", { name: "登记来源" })).toBeVisible();
  await page.getByRole("button", { name: "4 合规与发布" }).click();
  await expect(page.getByLabel("状态")).toHaveValue("disabled");
  await expect(page).toHaveScreenshot("m03-01-provider-registry.png", { fullPage: true });
  if (testInfo.project.name === "mobile-390")
    await expect(page.locator(".provider-editor")).toBeVisible();
});
test("M03-01.A08/A16 empty, forbidden and dependency states stay actionable", async ({ page }) => {
  await nav(page);
  let status = 200;
  await page.route("**/api/v1/platform/providers", (route) =>
    route.fulfill(
      status === 200
        ? {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              data: [],
              request_id: "m03-01-empty",
              trace_id: "m03-01-empty",
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
              request_id: `m03-01-${status}`,
              trace_id: `m03-01-${status}`,
            }),
          },
    ),
  );
  await page.goto("/platform-admin/providers");
  await expect(page.getByRole("heading", { name: "还没有来源定义" })).toBeVisible();
  status = 403;
  await page.reload();
  await expect(page.getByRole("heading", { name: "你没有此项权限" })).toBeVisible();
  await expect(page.getByText("m03-01-403")).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
  await page.getByRole("button", { name: /重试|重新/ }).click();
});
