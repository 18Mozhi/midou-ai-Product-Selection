import { test, expect } from "@playwright/test";
const provider = {
    id: "00000000-0000-4000-8000-000000000802",
    code: "browser_source",
    name: "登录页来源",
    target_url: "https://example.test/login",
    access_mode: "authenticated_browser",
  },
  secondProvider = {
    id: "00000000-0000-4000-8000-000000000805",
    code: "second_browser_source",
    name: "第二登录来源",
    target_url: "https://second.example.test/login",
    access_mode: "authenticated_browser",
  },
  asset = {
    id: "00000000-0000-4000-8000-000000000803",
    provider_id: provider.id,
    name: "北美浏览器档案",
    kind: "browser_profile",
    status: "active",
    key_version: "v1",
    fingerprint: "0123456789abcdef",
    expires_at: null,
    rotated_at: "2026-08-07T18:00:00.000Z",
    version: 2,
    updated_at: "2026-08-07T18:00:00.000Z",
  },
  profile = {
    id: "00000000-0000-4000-8000-000000000804",
    provider_id: provider.id,
    credential_asset_id: asset.id,
    code: "browser_us_a",
    name: "北美采集档案 A",
    browser_family: "chromium",
    locale: "en-US",
    timezone: "America/Los_Angeles",
    status: "disabled",
    version: 1,
    updated_at: "2026-08-07T18:00:00.000Z",
  },
  navigation = {
    shell: "platform_admin",
    organization_id: null,
    workspace_id: null,
    roles: [],
    capabilities: [],
    platform_roles: ["platform_super_admin"],
    platform_capabilities: ["platform:secure", "platform:superadmin", "key_rotation:manage"],
    guard_reason: "navigation_platform_admin_allowed",
  };
async function nav(page: any, availableProviders = [provider]) {
  await page.route("**/api/v1/me/navigation?**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: navigation, request_id: "m03-02-nav", trace_id: "m03-02-nav" }),
    }),
  );
  await page.route("**/api/v1/platform/credential-provider-options", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: availableProviders,
        request_id: "m03-02-providers",
        trace_id: "m03-02-providers",
      }),
    }),
  );
  await page.route("**/api/v1/platform/crawler-profiles", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [profile],
        request_id: "m03-02-profiles",
        trace_id: "m03-02-profiles",
      }),
    }),
  );
}
test("M03-02.A07/A08/A15 masked credential vault is responsive and visual", async ({ page }) => {
  await nav(page);
  await page.route("**/api/v1/platform/credential-assets", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [asset],
        request_id: "m03-02-assets",
        trace_id: "m03-02-assets",
      }),
    }),
  );
  await page.goto("/platform-admin/credentials");
  await expect(page.getByRole("heading", { name: "凭证与浏览器档案", level: 2 })).toBeVisible();
  await expect(page.getByText("0123456789abcdef")).toBeVisible();
  await expect(page.getByText(/secret-never|cookie-value|payload_ciphertext/)).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 1280) <= 760) {
    await expect(page.getByRole("table")).toBeHidden();
    await page.getByRole("button", { name: /登录页来源.*待关联有效运行档案/ }).click();
    const detail = page.getByRole("dialog", { name: "登录页来源" });
    await expect(detail).toContainText("北美浏览器档案");
    await expect(detail).toContainText("北美采集档案 A");
    await detail.getByRole("button", { name: "关闭详情" }).click();
  } else {
    await expect(page.getByRole("table")).toBeVisible();
  }
  const createAssetButton = page.getByRole("button", { name: "凭证资产" });
  await createAssetButton.click();
  const editor = page.getByRole("dialog", { name: "创建凭证资产" });
  await expect(editor).toBeVisible();
  await expect(page.getByLabel("所属来源")).toBeFocused();
  await expect(page.getByLabel("需要加密保存的内容")).toHaveAttribute("type", "password");
  await page.keyboard.press("Escape");
  await expect(editor).toBeHidden();
  await expect(createAssetButton).toBeFocused();
});
test("M03-02.A08/A09/A16 revoke is explicit and fail closed", async ({ page }) => {
  await nav(page);
  await page.route("**/api/v1/platform/credential-assets", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [asset],
        request_id: "m03-02-assets",
        trace_id: "m03-02-assets",
      }),
    }),
  );
  await page.goto("/platform-admin/credentials");
  await page.getByRole("button", { name: "撤销" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "撤销资产" });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await dialog.getByPlaceholder("确认撤销").fill("确认撤销");
  await expect(confirm).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
test("M03-02.A08/A16 empty, forbidden and dependency states are actionable", async ({ page }) => {
  await nav(page);
  let status = 200;
  await page.route("**/api/v1/platform/credential-assets", (r) =>
    r.fulfill(
      status === 200
        ? {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              data: [],
              request_id: "m03-02-empty",
              trace_id: "m03-02-empty",
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
              request_id: `m03-02-${status}`,
              trace_id: `m03-02-${status}`,
            }),
          },
    ),
  );
  await page.route("**/api/v1/platform/crawler-profiles", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], request_id: "profiles", trace_id: "profiles" }),
    }),
  );
  await page.goto("/platform-admin/credentials");
  await expect(page.getByRole("heading", { name: "还没有平台凭证资产" })).toBeVisible();
  status = 403;
  await page.reload();
  await expect(page.getByRole("heading", { name: "你没有此项权限" })).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
});

test("M03-02.A07/A15 provider deep link selects the exact login source", async ({ page }) => {
  await nav(page, [provider, secondProvider]);
  await page.route("**/api/v1/platform/credential-assets", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], request_id: "assets", trace_id: "assets" }),
    }),
  );
  await page.goto(`/platform-admin/credentials?provider_id=${secondProvider.id}&mode=login`);
  const dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("需要登录的来源").locator("option:checked")).toHaveText(
    secondProvider.name,
  );
  await expect(dialog.locator(".login-provider-status strong")).toHaveText(secondProvider.name);
});

test("M03-02.A08 refresh failure preserves the last successful metadata", async ({ page }) => {
  await nav(page);
  let assetRequestCount = 0;
  await page.route("**/api/v1/platform/credential-assets", (route) => {
    assetRequestCount += 1;
    return route.fulfill(
      assetRequestCount === 1
        ? {
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: [asset],
              request_id: "m03-02-initial",
              trace_id: "m03-02-initial",
            }),
          }
        : {
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: "dependency_unavailable",
                message: "依赖不可用",
                action_hint: "检查数据库后重试。",
              },
              request_id: "m03-02-refresh-failed",
              trace_id: "m03-02-refresh-failed",
            }),
          },
    );
  });
  await page.goto("/platform-admin/credentials");
  await expect(page.getByRole("heading", { name: asset.name })).toBeVisible();
  await page.getByRole("button", { name: "刷新数据" }).click();
  await expect(page.getByRole("status")).toContainText("已保留上一次成功读取的数据");
  await expect(page.getByRole("heading", { name: asset.name })).toBeVisible();
  expect(assetRequestCount).toBeGreaterThan(1);
  expect(assetRequestCount).toBeLessThanOrEqual(4);
});
