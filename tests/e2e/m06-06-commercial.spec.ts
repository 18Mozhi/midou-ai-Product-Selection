import { expect, test } from "@playwright/test";
const env = (data: any) => ({ data, request_id: "m06-06-e2e", trace_id: "m06-06-e2e" });
const data = {
  plans: [
    {
      id: "p1",
      code: "growth",
      name: "成长配额方案",
      description: "当前只展示已配置额度，不包含价格或计费",
      quotas: { collection_tasks: 100, open_api_requests: 1000, report_exports: 20 },
      status: "active",
      version: 2,
      assignment_count: 3,
      updated_at: "2026-08-08T00:00:00Z",
    },
  ],
  assignment: {
    id: "a1",
    organization_id: "o1",
    plan_id: "p1",
    plan_code: "growth",
    plan_name: "成长配额方案",
    quotas: { collection_tasks: 100, open_api_requests: 1000, report_exports: 20 },
    period_start: "2026-08-01T00:00:00Z",
    period_end: "2026-09-01T00:00:00Z",
    status: "active",
    version: 1,
    updated_at: "2026-08-08T00:00:00Z",
  },
  adjustments: [
    {
      id: "q1",
      quota_key: "open_api_requests",
      delta_value: 50,
      reason: "运营核准",
      status: "active",
      effective_at: "2026-08-08T00:00:00Z",
      expires_at: null,
      version: 1,
      updated_at: "2026-08-08T00:00:00Z",
    },
  ],
  usage: { collection_tasks: 42, open_api_requests: 380, report_exports: 4 },
  effective_quotas: { collection_tasks: 100, open_api_requests: 1050, report_exports: 20 },
  observed_at: "2026-08-08T00:00:00Z",
  scope: { organization_id: "o1" },
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (route) =>
    route.fulfill({
      json: env({
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
  await page.route("**/api/v1/platform/commercial?**", (route) =>
    route.fulfill({ json: env(data) }),
  );
});
test("M06-06.A07/A08/A15 desktop and 390 quota management", async ({ page }) => {
  await page.goto("/platform-admin/commercial?organization_id=o1");
  await expect(page.getByRole("heading", { name: "组织配额与用量" })).toBeVisible();
  await expect(page.getByText("380 / 1050")).toBeVisible();
  await expect(page.getByText("当前只展示已配置额度，不包含价格或计费")).toBeVisible();
  await expect(page.getByRole("button", { name: "确认调整" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("成长配额方案").first()).toBeVisible();
  await expect(page.getByText(/会员|续期|套餐/)).toHaveCount(0);
});
test("M06-06 edit, renew, status confirmation and dependency recovery", async ({ page }) => {
  let renewal: any = null;
  await page.route("**/api/v1/platform/commercial/assignments", async (route) => {
    renewal = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: env({ id: "a1", status: "active", version: 2 }) });
  });
  await page.goto("/platform-admin/commercial?organization_id=o1");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.getByRole("heading", { name: "编辑配额方案" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
  await page.getByLabel("结束", { exact: true }).fill("2026-10-01T00:00");
  await page.getByRole("button", { name: "确认调整" }).click();
  await expect(page.getByText("确认调整组织配额方案？")).toBeVisible();
  const impact = page.getByLabel("配额变更影响范围");
  await expect(impact).toContainText("组织 o1");
  await expect(impact).toContainText("采集任务");
  await expect(impact).toContainText("100（当前余量 58）");
  await expect(impact).toContainText("新周期用量将在变更后重新统计");
  await page.getByRole("button", { name: "确认执行" }).click();
  await expect
    .poll(() => renewal)
    .toMatchObject({ organization_id: "o1", plan_id: "p1", reason: "分配或调整配额方案" });
  await page.getByRole("button", { name: "退役", exact: true }).click();
  await expect(page.getByText("确认退役配额方案？")).toBeVisible();
  await expect(page.getByLabel("配额变更影响范围")).toContainText("3 个当前仍分配该方案的组织");
  await page.getByRole("button", { name: "取消" }).click();
  await page.unroute("**/api/v1/platform/commercial?**");
  let status = 429;
  await page.route("**/api/v1/platform/commercial?**", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "blocked" },
        request_id: "m06-06-state",
        trace_id: "m06-06-state",
      }),
    }),
  );
  await page.reload();
  await expect(page.getByText("请求过于频繁")).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByText("配额管理依赖受阻")).toBeVisible();
});
