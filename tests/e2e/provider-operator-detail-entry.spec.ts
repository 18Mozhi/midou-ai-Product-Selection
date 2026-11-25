import { test, expect } from "@playwright/test";

const navigation = {
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
const base = {
  id: "00000000-0000-4000-8000-000000000768",
  code: "1688_search",
  name: "1688 图搜",
  access_mode: "authenticated_browser",
  provider_status: "enabled",
  adapter_registered: true,
  adapter_version: "fixture-only",
  health_status: "blocked",
  last_checked_at: "2026-11-25T10:10:00Z",
  last_latency_ms: 50,
  last_error_code: "captcha",
  consecutive_failures: 5,
  latest_runtime_category: "login_required",
  runtime_sample_count_24h: 5,
  runtime_success_rate_basis_points_24h: 0,
  runtime_duration_p95_ms_24h: 50,
  runtime_network_failure_count_24h: 0,
  runtime_parser_failure_count_24h: 0,
  runtime_login_failure_count_24h: 5,
  runtime_empty_success_count_24h: 0,
  runtime_circuit_state: "open",
  runtime_consecutive_failures: 5,
  runtime_failure_threshold: 5,
  runtime_error_budget_remaining: 0,
  runtime_last_error_code: "captcha",
  runtime_circuit_opened_at: "2026-11-25T10:00:00Z",
  runtime_last_recovered_at: null,
  runtime_recovery_gate_met: false,
  compatibility_matrix: [],
  version: 1,
  updated_at: "2026-11-25T10:10:00Z",
};
const cases = [
  { error: "captcha", title: "需要人工过验证码", instruction: "不等于登录失效", external: true },
  { error: "login_required", title: "需要重新登录", instruction: "重新登录", external: true },
  {
    error: "rate_limited",
    title: "最近检查遇到限流",
    instruction: "先不要继续点检查或重登",
    external: false,
  },
  {
    error: "network_error",
    title: "最近检查未能连接采集服务",
    instruction: "不要据此重置登录",
    external: false,
  },
  { error: null, title: "健康检查已通过", instruction: "按审计流程", external: false },
];
for (const scene of cases) {
  test(`operator detail entry ${scene.error ?? "recovery"} is readable without a health POST`, async ({
    page,
    baseURL,
  }, testInfo) => {
    const origin = new URL(baseURL!).origin;
    const unexpected: string[] = [],
      writes: string[] = [];
    let reads = 0;
    await page.route("**/*", (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (!["GET", "HEAD"].includes(request.method()))
        writes.push(request.method() + " " + url.pathname);
      if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
      unexpected.push(url.origin + url.pathname);
      return route.abort();
    });
    await page.route("**/api/v1/me/navigation?**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: navigation,
          request_id: "fixture-nav",
          trace_id: "fixture-nav",
        }),
      }),
    );
    await page.route("**/api/v1/platform/provider-adapters", (route) => {
      if (route.request().method() !== "GET") {
        writes.push(route.request().method());
        return route.abort();
      }
      reads++;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              ...base,
              last_error_code: scene.error,
              runtime_last_error_code: scene.error,
              health_status: scene.error ? "blocked" : "ready",
              runtime_recovery_gate_met: !scene.error,
            },
          ],
          request_id: "fixture-adapters",
          trace_id: "fixture-adapters",
        }),
      });
    });
    await page.goto("/platform-admin/providers/adapters");
    await expect(page.getByRole("heading", { name: "采集诊断目录", exact: true })).toBeVisible();
    const record =
      testInfo.project.name === "mobile-390"
        ? page.locator(".responsive-data-view__mobile article")
        : page.locator(".adapter-table-wrap tbody tr");
    await expect(record).toBeVisible();
    await expect(record).toContainText("1688 图搜");
    await page.screenshot({ path: testInfo.outputPath("before-entry.png"), fullPage: true });
    const entry =
      testInfo.project.name === "mobile-390"
        ? page.getByRole("button", { name: /1688 图搜.*查看详情/ })
        : page.getByRole("button", { name: "1688 图搜查看详情", exact: true });
    await expect(entry).toBeVisible({ timeout: 2000 });
    const readsBeforeOpen = reads;
    await entry.focus();
    await entry.press("Enter");
    const dialog = page.getByRole("dialog", { name: "1688 图搜", exact: true });
    await expect(dialog).toBeVisible();
    const feedback = dialog.locator(".adapter-detail-feedback").filter({ hasText: scene.title });
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText(scene.instruction);
    const link = feedback.getByRole("link");
    if (scene.external) {
      await expect(link).toHaveAttribute("href", "https://xingxing.medouai.com/#/adminDashboard");
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    } else if (!scene.error) {
      await expect(link).toHaveAttribute("href", "/platform-admin/crawler-scheduler");
    } else await expect(link).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "关闭详情", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("operator-detail.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(entry).toBeFocused();
    expect(reads).toBe(readsBeforeOpen);
    expect(writes).toEqual([]);
    expect(unexpected).toEqual([]);
  });
}
