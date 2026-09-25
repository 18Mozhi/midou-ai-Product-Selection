import { test, expect, type Locator } from "@playwright/test";
const orgId = "00000000-0000-4000-8000-000000000605",
  env = (data: any) => ({ data, request_id: "m06-05-e2e", trace_id: "m06-05-e2e" }),
  navigation = {
    shell: "platform_admin",
    organization_id: null,
    workspace_id: null,
    roles: [],
    capabilities: [],
    platform_roles: ["platform_security_admin"],
    platform_capabilities: ["platform:secure", "platform_token:manage"],
    guard_reason: "allowed",
  },
  data = {
    clients: [
      {
        id: "c1",
        organization_id: orgId,
        name: "报表只读 Client",
        client_prefix: "sco_open_public",
        scopes: ["status:read"],
        quota_per_minute: 60,
        status: "active",
        expires_at: "2026-11-01T00:00:00Z",
        last_used_at: null,
        version: 1,
        updated_at: "2026-08-08T00:00:00Z",
      },
    ],
    webhooks: [
      {
        id: "w1",
        organization_id: orgId,
        name: "任务事件",
        target_url: "https://example.com/hooks/scoutops",
        events: ["scoutops.test"],
        fingerprint: "0123456789abcdef",
        status: "active",
        version: 1,
        updated_at: "2026-08-08T00:00:00Z",
      },
    ],
    deliveries: [
      {
        id: "d1",
        endpoint_id: "w1",
        endpoint_name: "任务事件",
        organization_id: orgId,
        event_type: "scoutops.test",
        status: "dead_letter",
        attempt_count: 4,
        response_status: null,
        last_error_code: "webhook_timeout",
        available_at: "2026-08-08T00:00:00Z",
        updated_at: "2026-08-08T00:00:00Z",
      },
    ],
    scope: { organization_id: null },
    summary: {
      clients: { total: 1, active: 1, expired: 0 },
      webhooks: { total: 1, active: 1 },
      deliveries: { total: 1, dead_letter: 1, retry_scheduled: 0 },
    },
    pagination: {
      clients: { page: 1, page_size: 20, total: 1, total_pages: 1 },
      webhooks: { page: 1, page_size: 20, total: 1, total_pages: 1 },
      deliveries: { page: 1, page_size: 20, total: 1, total_pages: 1 },
    },
    observed_at: "2026-08-08T00:00:00Z",
  };
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (r) =>
    r.fulfill({ json: env(navigation) }),
  );
  await page.route(/\/api\/v1\/platform\/open(?:\?.*)?$/, (r) => r.fulfill({ json: env(data) }));
});
test.afterEach(() => {
  navigation.platform_roles.splice(0, navigation.platform_roles.length, "platform_security_admin");
  navigation.platform_capabilities.splice(
    0,
    navigation.platform_capabilities.length,
    "platform:secure",
    "platform_token:manage",
  );
});
test("M06-05.A07/A08/A15 desktop and 390 open platform", async ({ page }) => {
  await page.goto("/platform-admin/open-platform");
  await expect(page.getByRole("heading", { name: "开放平台", level: 1 })).toBeVisible();
  await expect(page.getByText("sco_open_public", { exact: true })).not.toBeVisible();
  await expect(page.getByText("webhook_timeout", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "创建接口访问账号" }).click();
  const createClient = page.locator(".open-create");
  await createClient.getByRole("textbox", { name: "组织内部编号" }).fill(orgId);
  await createClient.getByRole("textbox", { name: "名称", exact: true }).fill("状态观察接入");
  await createClient.getByRole("button", { name: "创建接口访问账号" }).click();
  const creationRisk = page.getByRole("alertdialog");
  await expect(creationRisk).toContainText(`组织 ${orgId}`);
  await expect(creationRisk).toContainText("读取系统状态");
  await expect(creationRisk).toContainText("不包含业务数据写入权限");
  await page.getByRole("button", { name: "取消" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("接口访问账号", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /^报表只读 Client/ }).click();
  const clientDialog = page.getByRole("dialog", { name: "报表只读 Client" });
  await clientDialog.getByText("技术详情").click();
  await expect(clientDialog.getByText("sco_open_public", { exact: true })).toBeVisible();
  await clientDialog.getByRole("button", { name: "关闭详情" }).click();
  await page.getByRole("button", { name: /^投递记录/ }).click();
  await page.getByRole("button", { name: /^任务事件/ }).click();
  const deliveryDialog = page.getByRole("dialog", { name: "任务事件" });
  await deliveryDialog.getByText("技术详情").click();
  await expect(deliveryDialog.getByText("webhook_timeout", { exact: true })).toBeVisible();
  await deliveryDialog.getByRole("button", { name: "关闭详情" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
});
test("M06-05.A08/A16 confirmation rate limit and dependency recovery", async ({ page }) => {
  await page.goto("/platform-admin/open-platform");
  const actionWrites: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/v1/platform/open") && request.method() !== "GET")
      actionWrites.push(request.method() + " " + path);
  });
  let actionTrigger: Locator;
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /^报表只读 Client/ }).click();
    const dialog = page.getByRole("dialog", { name: "报表只读 Client" });
    actionTrigger = dialog.getByRole("button", { name: "轮换密钥" });
  } else actionTrigger = page.getByRole("button", { name: "轮换", exact: true });
  await actionTrigger.click();
  const actionReason = page.getByRole("dialog", { name: "轮换接口访问密钥" });
  await expect(actionReason).toContainText("影响范围");
  const reasonInput = actionReason.getByLabel("本次变更原因");
  const closeReason = actionReason.getByRole("button", { name: "关闭操作原因窗口" });
  const continueReason = actionReason.getByRole("button", { name: "继续核对" });
  await expect(reasonInput).toBeFocused();
  await closeReason.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(continueReason).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeReason).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(actionReason).not.toBeVisible();
  await expect(actionTrigger).toBeFocused();

  await actionTrigger.click();
  await expect(actionReason).toBeVisible();
  await actionReason.getByLabel("本次变更原因").fill("轮换接口访问密钥");
  await actionReason.getByRole("button", { name: "继续核对" }).click();
  const rotationRisk = page.getByRole("alertdialog");
  await expect(rotationRisk).toContainText("轮换接口访问密钥");
  await expect(rotationRisk).toContainText("报表只读 Client");
  await expect(rotationRisk).toContainText("每分钟 60 次限额保持不变");
  await expect(rotationRisk).toContainText("旧密钥立即失效");
  await expect(rotationRisk.getByRole("button", { name: "取消" })).toBeFocused();
  await page.getByRole("button", { name: "取消" }).click();
  expect(actionWrites).toEqual([]);
  await page.unroute(/\/api\/v1\/platform\/open(?:\?.*)?$/);
  let status = 429;
  await page.route(/\/api\/v1\/platform\/open(?:\?.*)?$/, (r) =>
    r.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "blocked" },
        request_id: "m06-05-state",
        trace_id: "m06-05-state",
      }),
    }),
  );
  await page.reload();
  await expect(page.getByText("请求过于频繁")).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByText("开放平台依赖受阻")).toBeVisible();
});
test("M06-05 form validation and URL-backed workspace filters fail closed", async ({ page }) => {
  await page.goto("/platform-admin/open-platform");
  await page.getByRole("button", { name: "创建接口访问账号" }).click();
  const createClient = page.locator(".open-create");
  await createClient.getByRole("button", { name: "创建接口访问账号" }).click();
  await expect(page.getByText("请输入有效的组织内部编号。")).toBeVisible();
  await expect(page.getByText("名称需为 1–120 个字符。")).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.getByRole("button", { name: "关闭创建填写窗" }).click();
  await page.getByRole("textbox", { name: "搜索", exact: true }).fill("报表");
  await page.getByRole("combobox", { name: "状态" }).selectOption("active");
  await page.getByRole("button", { name: "应用" }).click();
  await expect(page).toHaveURL(/view=clients.*query=.*%E6%8A%A5%E8%A1%A8.*status=active/);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "搜索", exact: true })).toHaveValue("报表");
  await page.getByRole("button", { name: /^事件回调地址/ }).click();
  await page.getByRole("button", { name: "创建事件回调地址" }).click();
  const create = page.locator(".open-create");
  await create.getByRole("textbox", { name: "组织内部编号" }).fill(orgId);
  await create.getByRole("textbox", { name: "名称" }).fill("错误网址验证");
  await create.getByRole("textbox", { name: "事件回调安全网址" }).fill("http://127.0.0.1/hook");
  await create.getByRole("button", { name: "创建事件回调地址" }).click();
  await expect(page.getByText("仅允许无凭证、无片段的 HTTPS 443 地址。")).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("M06-05 one-time secrets clear on scope and view changes, and ignore late deactivated responses", async ({
  page,
}) => {
  const alternateOrgId = "00000000-0000-4000-8000-000000000606";
  navigation.platform_roles.push("platform_superadmin");
  navigation.platform_capabilities.push("platform:superadmin");

  let createCount = 0,
    releaseThirdCreate: (() => void) | undefined;
  await page.route("**/api/v1/platform/open/clients", async (route) => {
    createCount += 1;
    if (createCount === 3)
      await new Promise<void>((resolve) => {
        releaseThirdCreate = resolve;
      });
    await route.fulfill({ json: env({ secret: `synthetic-secret-${createCount}` }) });
  });

  async function createClient(name: string) {
    await page.getByRole("button", { name: "创建接口访问账号" }).first().click();
    const form = page.locator(".open-create");
    await form.getByRole("textbox", { name: "组织内部编号" }).fill(orgId);
    await form.getByRole("textbox", { name: "名称", exact: true }).fill(name);
    await form.getByRole("button", { name: "创建接口访问账号" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "确认执行" }).click();
  }

  await page.goto("/platform-admin/open-platform");
  await expect(page.getByRole("heading", { name: "开放平台", level: 1 })).toBeVisible();
  await createClient("组织范围密钥测试");
  await expect(page.getByText("synthetic-secret-1", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "读取组织内部编号" }).fill(alternateOrgId);
  await expect(page.getByText("synthetic-secret-1", { exact: true })).toHaveCount(0);

  await page.locator('[data-view="clients"]').click();
  await createClient("目录切换密钥测试");
  await expect(page.getByText("synthetic-secret-2", { exact: true })).toBeVisible();
  await page.locator('[data-view="webhooks"]').click();
  await expect(page.getByText("synthetic-secret-2", { exact: true })).toHaveCount(0);
  await page.locator('[data-view="clients"]').click();

  await page.getByRole("button", { name: "创建接口访问账号" }).first().click();
  const form = page.locator(".open-create");
  await form.getByRole("textbox", { name: "组织内部编号" }).fill(orgId);
  await form.getByRole("textbox", { name: "名称", exact: true }).fill("离开页面中的密钥测试");
  await form.getByRole("button", { name: "创建接口访问账号" }).click();
  const pendingWrite = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/platform/open/clients"),
    ),
    refreshedRead = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname.endsWith("/platform/open"),
    );
  const startedWrite = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/platform/open/clients"),
  );
  await page.getByRole("alertdialog").getByRole("button", { name: "确认执行" }).click();
  await startedWrite;
  await page
    .getByRole("navigation", { name: "面包屑" })
    .getByRole("link", { name: "安全中心" })
    .click();
  await expect(page).toHaveURL(/\/platform-admin\/security$/);
  releaseThirdCreate?.();
  await pendingWrite;
  await refreshedRead;
  await page.goBack();
  await expect(page).toHaveURL(/\/platform-admin\/open-platform$/);
  await expect(page.getByText("synthetic-secret-3", { exact: true })).toHaveCount(0);
});

test("M06-05 delayed one-time secret is ignored after the organization input changes", async ({
  page,
}) => {
  const alternateOrgId = "00000000-0000-4000-8000-000000000607";
  let releaseCreate: (() => void) | undefined;
  await page.route("**/api/v1/platform/open/clients", async (route) => {
    await new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    await route.fulfill({ json: env({ secret: "synthetic-late-organization-secret" }) });
  });

  await page.goto("/platform-admin/open-platform");
  await expect(page.getByRole("heading", { name: "开放平台", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "创建接口访问账号" }).first().click();
  const form = page.locator(".open-create");
  await form.getByRole("textbox", { name: "组织内部编号" }).fill(orgId);
  await form.getByRole("textbox", { name: "名称", exact: true }).fill("迟到组织密钥测试");
  await form.getByRole("button", { name: "创建接口访问账号" }).click();
  const creation = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/platform/open/clients"),
  );
  const submitted = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/platform/open/clients"),
  );
  await page.getByRole("alertdialog").getByRole("button", { name: "确认执行" }).click();
  await submitted;
  await page.getByRole("textbox", { name: "读取组织内部编号" }).fill(alternateOrgId);
  releaseCreate?.();
  await creation;
  await expect(page.locator(".open-action-result")).toContainText("操作成功并已写入审计");
  await expect(page.getByText("synthetic-late-organization-secret", { exact: true })).toHaveCount(
    0,
  );
});
