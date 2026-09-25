import { expect, test } from "@playwright/test";
const env = (data: any) => ({ data, request_id: "m06-06-e2e", trace_id: "m06-06-e2e" });
const data = {
  summary: { total: 1, draft: 0, active: 1, retired: 0 },
  pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
  adjustment_pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
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
  organization: { id: "o1", name: "测试组织", status: "active" },
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
  await page.getByRole("button", { name: "方案目录 全局配置与额度" }).click();
  await expect(page.getByText("当前只展示已配置额度，不包含价格或计费")).toBeVisible();
  await page.getByRole("button", { name: "组织配额 读取组织、分配与用量" }).click();
  await expect(page.getByRole("button", { name: "确认调整" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("380 / 1050")).toBeVisible();
  await page.getByRole("button", { name: "方案目录 全局配置与额度" }).click();
  await expect(page.locator(".commercial-catalog").getByText("成长配额方案")).toBeVisible();
  await expect(page.getByText(/会员|续期|套餐/)).toHaveCount(0);
});
test("M06-06 create dialog C composition, native code constraint and pending/denied feedback", async ({
  page,
}) => {
  let resolveCreate!: (response: {
    status: number;
    contentType: string;
    body: string;
  }) => Promise<void>;
  let submittedBody: any;
  let postCount = 0;
  await page.route("**/api/v1/platform/commercial/plans", async (route) => {
    postCount += 1;
    submittedBody = route.request().postDataJSON();
    await new Promise<void>((resolve) => {
      resolveCreate = async (response) => {
        await route.fulfill(response);
        resolve();
      };
    });
  });

  await page.goto("/platform-admin/commercial");
  await page.getByRole("button", { name: "新建配额方案", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "创建配额方案草稿" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "创建配额方案草稿" })).toBeVisible();
  await expect(dialog.getByRole("complementary", { name: "表单内容说明" })).toContainText(
    "额度是配置值，不是使用量，也不是收费价格。",
  );
  await expect(dialog.getByRole("region", { name: "方案资料" })).toBeVisible();
  await expect(dialog.locator("input, textarea")).toHaveCount(7);
  await expect(dialog).toHaveJSProperty("open", true);
  expect(
    await dialog
      .locator("form")
      .evaluate((form) => getComputedStyle(form).gridTemplateColumns.split(" ").length),
  ).toBe((page.viewportSize()?.width ?? 0) > 760 ? 2 : 1);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(
    await dialog.locator("header").evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(16, 42, 99)");

  const code = dialog.getByLabel("内部标识");
  await code.fill("bad code");
  expect(await code.evaluate((input: HTMLInputElement) => input.validity.patternMismatch)).toBe(
    true,
  );
  await code.fill("basic_2026");
  expect(await code.evaluate((input: HTMLInputElement) => input.validity.patternMismatch)).toBe(
    false,
  );
  await dialog.getByLabel("方案名称").fill("基础配额方案");
  await expect(dialog.getByText("采集任务", { exact: true })).toBeVisible();
  await expect(dialog.getByText("外部接口请求", { exact: true })).toBeVisible();
  await expect(dialog.getByText("报表导出", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "创建草稿", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("正在创建草稿");
  await expect(dialog.locator("input:disabled, textarea:disabled")).toHaveCount(7);
  await expect(dialog.getByRole("button", { name: "关闭新建配额方案" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "创建中…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  await expect.poll(() => postCount).toBe(1);
  expect(submittedBody).toMatchObject({
    code: "basic_2026",
    name: "基础配额方案",
    quotas: { collection_tasks: 100, open_api_requests: 1000, report_exports: 20 },
  });
  await resolveCreate({
    status: 403,
    contentType: "application/json",
    body: JSON.stringify({
      error: {
        code: "authorization_denied",
        message: "当前账号不能创建方案。",
        action_hint: "请联系平台管理员核对当前权限。",
      },
      request_id: "m06-06-create-403",
      trace_id: "m06-06-create-403",
    }),
  });
  const alert = dialog.getByRole("alert", { name: "本次创建反馈" });
  await expect(alert).toContainText("请联系平台管理员核对当前权限。");
  await alert.getByText("技术详情").click();
  await expect(alert).toContainText("m06-06-create-403");
  await expect(code).toHaveValue("basic_2026");
  await expect(code).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "关闭新建配额方案" })).toBeEnabled();
  expect(postCount).toBe(1);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
test("M06-06 create dialog preserves the existing successful draft request and completion flow", async ({
  page,
}) => {
  let body: any;
  let idempotencyKey = "";
  await page.route("**/api/v1/platform/commercial/plans", async (route) => {
    body = route.request().postDataJSON();
    idempotencyKey = route.request().headers()["idempotency-key"] ?? "";
    await route.fulfill({
      status: 201,
      json: env({ id: "p-created", status: "draft", version: 1 }),
    });
  });
  await page.goto("/platform-admin/commercial");
  await page.getByRole("button", { name: "新建配额方案", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "创建配额方案草稿" });
  await dialog.getByLabel("内部标识").fill("basic_2026");
  await dialog.getByLabel("方案名称").fill("基础配额方案");
  await dialog.getByRole("button", { name: "创建草稿", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".notice")).toContainText("配额方案草稿已创建；启用前不影响任何组织。");
  await expect.poll(() => new URL(page.url()).searchParams.get("query")).toBe("basic_2026");
  expect(new URL(page.url()).searchParams.get("status")).toBe("draft");
  expect(body).toMatchObject({
    code: "basic_2026",
    name: "基础配额方案",
    description: "",
    quotas: { collection_tasks: 100, open_api_requests: 1000, report_exports: 20 },
    reason: "商业配置变更",
  });
  expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
  await page.getByRole("button", { name: "新建配额方案", exact: true }).click();
  await expect(dialog.getByLabel("内部标识")).toHaveValue("");
});
test("M06-06 edit, renew, status confirmation and dependency recovery", async ({ page }) => {
  let renewal: any = null;
  await page.route("**/api/v1/platform/commercial/assignments", async (route) => {
    renewal = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: env({ id: "a1", status: "active", version: 2 }) });
  });
  await page.goto("/platform-admin/commercial?organization_id=o1");
  await expect(page.getByText("380 / 1050")).toBeVisible();
  await page.getByRole("button", { name: "方案目录 全局配置与额度" }).click();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.getByRole("heading", { name: "编辑配额方案" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
  await page.getByRole("button", { name: "组织配额 读取组织、分配与用量" }).click();
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
  await page.getByRole("button", { name: "方案目录 全局配置与额度" }).click();
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
