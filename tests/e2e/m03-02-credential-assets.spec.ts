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
    platform_capabilities: [
      "platform:secure",
      "platform:superadmin",
      "platform:operate",
      "platform_token:manage",
      "key_rotation:manage",
    ],
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
async function navigatePlatform(page: any, path: string) {
  const link = page.locator(`nav a[href="${path}"]`).first();
  await expect(link).toHaveCount(1);
  // Browser back/forward can leave a modal without a pointer click; invoke the real RouterLink.
  await link.evaluate((element: HTMLAnchorElement) => element.click());
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
}
const credentialCacheEvictionRoutes = [
  "/platform-admin",
  "/platform-admin/organizations",
  "/platform-admin/users",
  "/platform-admin/admins",
  "/platform-admin/permissions",
  "/platform-admin/providers",
  "/platform-admin/providers/sources",
  "/platform-admin/collection/overview",
  "/platform-admin/data",
  "/platform-admin/governance",
  "/platform-admin/content",
  "/platform-admin/notifications",
  "/platform-admin/commercial",
  "/platform-admin/security",
  "/platform-admin/open-platform",
];
async function evictCredentialSurface(page: any) {
  for (const path of credentialCacheEvictionRoutes) await navigatePlatform(page, path);
}
async function stubUnrelatedPlatformReads(page: any) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (
      path === "/api/v1/me/navigation" ||
      path.startsWith("/api/v1/platform/credential-") ||
      path === "/api/v1/platform/crawler-profiles"
    ) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], request_id: "ui2-p50-cache-eviction" }),
    });
  });
}
async function stubEmptyPlatformDashboard(page: any) {
  await page.route("**/api/v1/platform/dashboard?**", (route: any) =>
    route.fulfill({
      json: {
        data: {
          window: "24h",
          summary: {
            active_organizations: 0,
            active_users: 0,
            enabled_providers: 0,
            storage_bytes: 0,
          },
          queues: [],
          alerts: [],
          provider_health: [],
        },
        request_id: "m03-02-dashboard",
        trace_id: "m03-02-dashboard",
      },
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
test("UI2-SC50 all credential editors use the modal top layer and restore their trigger", async ({
  page,
}) => {
  await nav(page);
  await page.route("**/api/v1/platform/credential-assets", (route) =>
    route.fulfill({
      json: { data: [asset], request_id: "ui2-editor-focus-assets" },
    }),
  );
  await page.goto("/platform-admin/credentials");
  const cases = [
    {
      trigger: page.getByRole("button", { name: "新建凭证资产", exact: true }),
      dialogName: "创建凭证资产",
      firstField: "所属来源",
      closeName: "关闭凭证编辑",
    },
    {
      trigger: page.getByRole("button", { name: "更新资料", exact: true }),
      dialogName: `轮换 ${asset.name}`,
      firstField: "内容格式",
      closeName: "关闭凭证编辑",
    },
    {
      trigger: page.getByRole("button", { name: "关联运行档案", exact: true }),
      dialogName: "创建浏览器档案引用",
      firstField: "网页登录档案",
      closeName: "关闭浏览器档案编辑",
    },
    {
      trigger: page.getByRole("button", { name: "配置网页登录", exact: true }),
      dialogName: "导入已经登录的浏览器档案",
      firstField: "需要登录的来源",
      closeName: "关闭网页登录档案导入",
    },
  ];
  for (const item of cases) {
    await item.trigger.click();
    const dialog = page.getByRole("dialog", { name: item.dialogName });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveJSProperty("tagName", "DIALOG");
    await expect(dialog).toHaveAttribute("open", "");
    await expect(dialog.getByLabel(item.firstField)).toBeFocused();
    const close = dialog.getByRole("button", { name: item.closeName, exact: true }),
      lastFocusable = dialog
        .locator(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
        )
        .last();
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(lastFocusable).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(item.trigger).toBeFocused();
  }
});
test("UI2-SC50 focus loop skips controls hidden by CSS", async ({ page }) => {
  await nav(page);
  await page.route("**/api/v1/platform/credential-assets", (route) =>
    route.fulfill({ json: { data: [asset], request_id: "ui2-hidden-focus-assets" } }),
  );
  await page.goto("/platform-admin/credentials");

  await page.getByRole("button", { name: "新建凭证资产", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "创建凭证资产" });
  const form = dialog.locator("form.credential-editor");
  const close = dialog.getByRole("button", { name: "关闭凭证编辑" });
  const cancel = dialog.getByRole("button", { name: "取消", exact: true });
  const submit = dialog.getByRole("button", { name: "加密保存", exact: true });

  await dialog.getByLabel("需要加密保存的内容").fill("synthetic-focus-only");
  await submit.evaluate((element: HTMLElement) => {
    element.style.display = "none";
  });
  await cancel.focus();
  const trapped = await cancel.evaluate((element) => {
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });

  expect(trapped).toBe(true);
  await expect(close).toBeFocused();
  await expect(form).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
test("UI2-SC50 credential editor backdrop and successful save return focus", async ({ page }) => {
  await nav(page);
  const created = {
    ...asset,
    id: "00000000-0000-4000-8000-000000000813",
    name: "焦点闭环资产",
    kind: "api_key",
    version: 1,
  };
  let saved = false;
  await page.route("**/api/v1/platform/credential-assets", async (route) => {
    if (route.request().method() === "POST") {
      saved = true;
      return route.fulfill({
        status: 201,
        json: { data: created, request_id: "ui2-editor-focus-created" },
      });
    }
    return route.fulfill({
      json: {
        data: saved ? [asset, created] : [asset],
        request_id: "ui2-editor-focus-read",
      },
    });
  });
  await page.goto("/platform-admin/credentials");
  const trigger = page.getByRole("button", { name: "新建凭证资产", exact: true });
  await trigger.click();
  let dialog = page.getByRole("dialog", { name: "创建凭证资产" });
  await dialog.dispatchEvent("mousedown");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  dialog = page.getByRole("dialog", { name: "创建凭证资产" });
  await dialog.getByLabel("名称").fill(created.name);
  await dialog.getByLabel("需要加密保存的内容").fill("synthetic-focus-secret");
  await dialog.getByRole("button", { name: "加密保存", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("heading", { name: created.name, exact: true })).toBeVisible();
  await expect(page.getByText("synthetic-focus-secret")).toHaveCount(0);
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

test("UI2-SC50 partial credential reads retain the snapshot and identify the failed request", async ({
  page,
}) => {
  await nav(page);
  let failedRead: { path: string; status: number; requestId: string } | null = null;
  const response = (path: string, data: unknown) => {
    if (failedRead?.path === path) {
      return {
        status: failedRead.status,
        json: {
          error: {
            code: failedRead.status === 403 ? "authorization_denied" : "read_unavailable",
            message: "读取失败",
            action_hint: "请检查权限或依赖后重试。",
          },
          request_id: failedRead.requestId,
          trace_id: failedRead.requestId,
        },
      };
    }
    return { json: { data, request_id: `ui2-read-${path.split("/").at(-1)}` } };
  };
  await page.route("**/api/v1/platform/credential-assets", (route) =>
    route.fulfill(response("/api/v1/platform/credential-assets", [asset])),
  );
  await page.route("**/api/v1/platform/crawler-profiles", (route) =>
    route.fulfill(response("/api/v1/platform/crawler-profiles", [profile])),
  );
  await page.route("**/api/v1/platform/credential-provider-options", (route) =>
    route.fulfill(response("/api/v1/platform/credential-provider-options", [provider])),
  );
  await page.goto("/platform-admin/credentials");
  await expect(page.getByRole("heading", { name: asset.name, exact: true })).toBeVisible();

  for (const item of [
    { path: "/api/v1/platform/credential-assets", status: 503, requestId: "ui2-read-assets-503" },
    {
      path: "/api/v1/platform/crawler-profiles",
      status: 503,
      requestId: "ui2-read-profiles-503",
    },
    {
      path: "/api/v1/platform/credential-provider-options",
      status: 503,
      requestId: "ui2-read-providers-503",
    },
    { path: "/api/v1/platform/credential-assets", status: 401, requestId: "ui2-read-assets-401" },
    {
      path: "/api/v1/platform/crawler-profiles",
      status: 403,
      requestId: "ui2-read-profiles-403",
    },
    {
      path: "/api/v1/platform/credential-provider-options",
      status: 403,
      requestId: "ui2-read-providers-403",
    },
  ]) {
    failedRead = item;
    await page.getByRole("button", { name: "刷新数据", exact: true }).click();
    const notice = page.getByRole("status").filter({ hasText: "保留上一次成功读取的数据" });
    await expect(notice).toContainText("请检查权限或依赖后重试。");
    await expect(notice).toContainText(item.requestId);
    await expect(page.getByRole("heading", { name: asset.name, exact: true })).toBeVisible();
  }
});

test("UI2-SC50 asset, rotation and profile write failures stay inside their editors", async ({
  page,
}) => {
  await nav(page);
  const writeErrors: Record<string, { actionHint: string; requestId: string }> = {
    asset: { actionHint: "凭证未创建，请核对内容后重试。", requestId: "ui2-create-failed" },
    rotate: { actionHint: "凭证未轮换，请刷新版本后重试。", requestId: "ui2-rotate-failed" },
    profile: { actionHint: "档案引用未创建，请核对后重试。", requestId: "ui2-profile-failed" },
  };
  const failedWrite = (key: keyof typeof writeErrors) => {
    const { actionHint, requestId } = writeErrors[key];
    return {
      status: 409,
      json: {
        error: { code: "version_conflict", message: "版本冲突", action_hint: actionHint },
        request_id: requestId,
        trace_id: requestId,
      },
    };
  };
  await page.route("**/api/v1/platform/credential-assets", (route) =>
    route.request().method() === "POST"
      ? route.fulfill(failedWrite("asset"))
      : route.fulfill({ json: { data: [asset], request_id: "ui2-write-errors-assets" } }),
  );
  await page.route("**/api/v1/platform/credential-assets/*/rotate", (route) =>
    route.fulfill(failedWrite("rotate")),
  );
  await page.route("**/api/v1/platform/crawler-profiles", (route) =>
    route.request().method() === "POST"
      ? route.fulfill(failedWrite("profile"))
      : route.fulfill({ json: { data: [profile], request_id: "ui2-write-errors-profiles" } }),
  );
  await page.goto("/platform-admin/credentials");

  await page.getByRole("button", { name: "新建凭证资产", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "创建凭证资产" });
  await dialog.getByLabel("所属来源").selectOption(provider.id);
  await dialog.getByLabel("名称").fill("创建错误反馈测试");
  await dialog.getByLabel("需要加密保存的内容").fill("synthetic-create-only");
  await dialog.getByRole("button", { name: "加密保存", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(writeErrors.asset.actionHint);
  await expect(dialog.getByRole("status")).toContainText(writeErrors.asset.requestId);
  await expect(dialog.getByLabel("名称")).toHaveValue("创建错误反馈测试");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();

  await page.getByRole("button", { name: "更新资料", exact: true }).click();
  dialog = page.getByRole("dialog", { name: `轮换 ${asset.name}` });
  await dialog.getByLabel("需要加密保存的内容").fill("synthetic-rotate-only");
  await dialog.getByRole("button", { name: "确认轮换", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(writeErrors.rotate.actionHint);
  await expect(dialog.getByRole("status")).toContainText(writeErrors.rotate.requestId);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();

  await page.getByRole("button", { name: "关联运行档案", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "创建浏览器档案引用" });
  await dialog.getByLabel("网页登录档案").selectOption(asset.id);
  await dialog.getByLabel("内部标识").fill("sc50_profile_error");
  await dialog.getByLabel("名称").fill("引用错误反馈测试");
  await dialog.getByRole("button", { name: "保存档案引用", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(writeErrors.profile.actionHint);
  await expect(dialog.getByRole("status")).toContainText(writeErrors.profile.requestId);
  await expect(dialog.getByLabel("名称")).toHaveValue("引用错误反馈测试");
});

test("UI2-SC50 partial login save guides recovery without recreating the asset", async ({
  page,
}) => {
  await nav(page);
  const savedAsset = {
    ...asset,
    name: "登录页来源 Cookie登录档案",
    kind: "cookie_bundle",
    version: 1,
  };
  const writes: Array<{ path: string; body: any }> = [];
  let assetSaved = false;
  let savedProfile: Record<string, unknown> | null = null;
  let profileAttempts = 0;
  const envelope = (data: unknown) => ({ data, request_id: "ui2-sc50", trace_id: "ui2-sc50" });
  await page.route("**/api/v1/platform/credential-assets", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: envelope(assetSaved ? [savedAsset] : []) });
      return;
    }
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    writes.push({ path: "assets", body: route.request().postDataJSON() });
    assetSaved = true;
    await route.fulfill({ status: 201, json: envelope(savedAsset) });
  });
  await page.route("**/api/v1/platform/crawler-profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: envelope(savedProfile ? [savedProfile] : []) });
      return;
    }
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    const body = route.request().postDataJSON();
    writes.push({ path: "profiles", body });
    profileAttempts += 1;
    if (profileAttempts === 1) {
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: "dependency_unavailable",
            message: "隔离档案创建失败",
            action_hint: "稍后重试",
          },
          request_id: "ui2-sc50-failed",
          trace_id: "ui2-sc50-failed",
        },
      });
      return;
    }
    savedProfile = { ...profile, ...body, version: 1 };
    await route.fulfill({ status: 201, json: envelope(savedProfile) });
  });
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  const login = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  const payload = JSON.stringify([
    { name: "study", value: "synthetic-no-real-cookie", domain: "example.test", path: "/" },
  ]);
  await login.locator('input[type="file"]').setInputFiles({
    name: "isolated.cookies",
    mimeType: "text/plain",
    buffer: Buffer.from(payload),
  });
  await login.getByRole("button", { name: "加密保存并启用", exact: true }).click();
  await expect(login.getByRole("status")).toContainText("关闭此窗口并刷新数据");
  await expect(login.getByRole("status")).toContainText("关联运行档案");
  await expect(login.getByRole("button", { name: "加密保存并启用", exact: true })).toBeDisabled();
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual({
    path: "assets",
    body: {
      provider_id: provider.id,
      name: savedAsset.name,
      kind: "cookie_bundle",
      secret_payload: { encoding: "utf8", value: payload },
      expires_at: null,
    },
  });
  expect(writes[1].body).toMatchObject({
    provider_id: provider.id,
    credential_asset_id: savedAsset.id,
    browser_family: "chromium",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    status: "active",
  });
  await login.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "刷新数据", exact: true }).click();
  await expect(page.getByRole("heading", { name: savedAsset.name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "关联运行档案", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "创建浏览器档案引用" });
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("网页登录档案")).toHaveValue(savedAsset.id);
  await editor.getByLabel("内部标识").fill("isolated_recovery");
  await editor.getByLabel("名称", { exact: true }).fill("隔离恢复档案");
  await editor.getByRole("button", { name: "保存档案引用", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.locator(".profile-list")).toContainText("隔离恢复档案");
  expect(writes.filter((write) => write.path === "assets")).toHaveLength(1);
  expect(writes.filter((write) => write.path === "profiles")).toHaveLength(2);
  expect(writes[2].body).toEqual({
    provider_id: provider.id,
    credential_asset_id: savedAsset.id,
    code: "isolated_recovery",
    name: "隔离恢复档案",
    browser_family: "chromium",
    locale: "en-US",
    timezone: "America/Los_Angeles",
    status: "disabled",
  });
});

test("UI2-SC50 lifecycle source switch invalidates prepared login material", async ({ page }) => {
  await nav(page, [provider, secondProvider]);
  await page.route("**/api/v1/platform/credential-assets", (route) =>
    route.fulfill({
      json: { data: [], request_id: "ui2-source-switch", trace_id: "ui2-source-switch" },
    }),
  );
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  const dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" }),
    save = dialog.getByRole("button", { name: "加密保存并启用", exact: true });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "source-bound.cookies",
    mimeType: "text/plain",
    buffer: Buffer.from('[{"name":"study","value":"synthetic","domain":"example.test"}]'),
  });
  await expect(save).toBeEnabled();
  await dialog.getByLabel("需要登录的来源").selectOption({ label: secondProvider.name });
  await expect(dialog.locator(".login-provider-status strong")).toHaveText(secondProvider.name);
  await expect(dialog.locator(".archive-picker small")).toContainText("请选择 Cookie");
  await expect(save).toBeDisabled();
});

test("UI2-SC50 lifecycle ignores a file result after close and reopen", async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    Object.defineProperty(File.prototype, "text", {
      configurable: true,
      value(this: File) {
        if (this.name !== "late.cookies") return original.call(this);
        return new Promise<string>((resolve, reject) => {
          (window as any).__p50PendingFile = true;
          (window as any).__p50ResolveFile = () => original.call(this).then(resolve, reject);
        });
      },
    });
  });
  await nav(page, [provider, secondProvider]);
  await page.route("**/api/v1/platform/credential-assets", (route) =>
    route.fulfill({ json: { data: [], request_id: "ui2-late-file", trace_id: "ui2-late-file" } }),
  );
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  let dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "late.cookies",
    mimeType: "text/plain",
    buffer: Buffer.from('[{"name":"late","value":"synthetic","domain":"example.test"}]'),
  });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as any).__p50PendingFile)))
    .toBe(true);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "配置网页登录", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.getByLabel("需要登录的来源").selectOption({ label: secondProvider.name });
  await page.evaluate(() => (window as any).__p50ResolveFile());
  await expect(dialog.locator(".archive-picker small")).toContainText("请选择 Cookie");
  await expect(dialog.getByRole("button", { name: "加密保存并启用", exact: true })).toBeDisabled();
});

test("UI2-SC50 lifecycle ignores a browser helper result after close and reopen", async ({
  page,
}) => {
  await nav(page, [provider, secondProvider]);
  await page.route("**/api/v1/platform/credential-assets", (route) =>
    route.fulfill({
      json: { data: [], request_id: "ui2-late-helper", trace_id: "ui2-late-helper" },
    }),
  );
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  await page.evaluate(() => {
    window.addEventListener("message", (event) => {
      if (event.data?.type === "SCOUTOPS_BROWSER_BRIDGE_REQUEST")
        (window as any).__p50BridgeRequest = event.data;
    });
  });
  let dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.getByLabel("导入方式").selectOption("browser");
  await dialog.getByRole("button", { name: "从当前浏览器读取 Cookie", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean((window as any).__p50BridgeRequest)))
    .toBe(true);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "配置网页登录", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.getByLabel("需要登录的来源").selectOption({ label: secondProvider.name });
  await dialog.getByLabel("导入方式").selectOption("browser");
  await page.evaluate(() => {
    const request = (window as any).__p50BridgeRequest;
    window.postMessage(
      {
        type: "SCOUTOPS_BROWSER_BRIDGE_RESULT",
        request_id: request.request_id,
        ok: true,
        data: { cookies: [{ name: "late", value: "synthetic", domain: "example.test" }] },
      },
      location.origin,
    );
  });
  await expect(dialog.locator(".login-provider-status strong")).toHaveText(secondProvider.name);
  await expect(dialog.getByRole("button", { name: "加密保存并启用", exact: true })).toBeDisabled();
});

test("UI2-SC50 lifecycle locks a pending save and fails closed on an unknown asset result", async ({
  page,
}) => {
  await nav(page);
  let releaseWrite = () => {},
    writes = 0;
  const gate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  await page.route("**/api/v1/platform/credential-assets", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: { data: [], request_id: "ui2-unknown-get", trace_id: "ui2-unknown-get" },
      });
      return;
    }
    writes += 1;
    await gate;
    await route.abort("failed");
  });
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  const dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "unknown.cookies",
    mimeType: "text/plain",
    buffer: Buffer.from('[{"name":"study","value":"synthetic","domain":"example.test"}]'),
  });
  await dialog.getByRole("button", { name: "加密保存并启用", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "关闭网页登录档案导入", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("需要登录的来源")).toBeDisabled();
  await expect(dialog.getByLabel("导入方式")).toBeDisabled();
  releaseWrite();
  await expect(dialog.getByRole("status")).toContainText("写入结果暂时无法确认");
  await expect(dialog.getByRole("status")).toContainText("不要重新导入");
  await expect(dialog.getByRole("button", { name: "加密保存并启用", exact: true })).toBeDisabled();
  expect(writes).toBe(1);
});

test("UI2-SC50 lifecycle distinguishes an unknown profile result after the asset is saved", async ({
  page,
}) => {
  await nav(page);
  const savedAsset = {
    ...asset,
    name: "登录页来源 Cookie登录档案",
    kind: "cookie_bundle",
    version: 1,
  };
  let assetWrites = 0,
    profileWrites = 0;
  await page.route("**/api/v1/platform/credential-assets", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          data: [],
          request_id: "ui2-profile-unknown-get",
          trace_id: "ui2-profile-unknown-get",
        },
      });
      return;
    }
    assetWrites += 1;
    await route.fulfill({
      status: 201,
      json: { data: savedAsset, request_id: "ui2-profile-asset", trace_id: "ui2-profile-asset" },
    });
  });
  await page.route("**/api/v1/platform/crawler-profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: { data: [], request_id: "ui2-profile-get", trace_id: "ui2-profile-get" },
      });
      return;
    }
    profileWrites += 1;
    await route.abort("failed");
  });
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  const dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "profile-unknown.cookies",
    mimeType: "text/plain",
    buffer: Buffer.from('[{"name":"study","value":"synthetic","domain":"example.test"}]'),
  });
  await dialog.getByRole("button", { name: "加密保存并启用", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("加密档案已保存");
  await expect(dialog.getByRole("status")).toContainText("运行档案的写入结果暂时无法确认");
  await expect(dialog.getByRole("status")).toContainText("不要重新导入或直接重复关联");
  await expect(dialog.getByRole("button", { name: "加密保存并启用", exact: true })).toBeDisabled();
  expect(assetWrites).toBe(1);
  expect(profileWrites).toBe(1);
});

test("UI2-SC50 KeepAlive deactivation closes the login editor and clears prepared material", async ({
  page,
}) => {
  await nav(page, [provider, secondProvider]);
  await stubEmptyPlatformDashboard(page);
  let credentialReads = 0;
  await page.route("**/api/v1/platform/credential-assets", (route) => {
    credentialReads += 1;
    return route.fulfill({
      json: { data: [], request_id: "ui2-cache-assets", trace_id: "ui2-cache-assets" },
    });
  });
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  let dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "cached-secret.cookies",
    mimeType: "text/plain",
    buffer: Buffer.from(
      '[{"name":"cached","value":"synthetic-cache-secret","domain":"example.test"}]',
    ),
  });
  await expect(dialog.getByText(/已读取导入材料：cached-secret\.cookies/)).toBeVisible();
  await navigatePlatform(page, "/platform-admin");
  await page.goBack();
  await expect(page).toHaveURL(/\/platform-admin\/credentials\?/);
  await expect(page.getByRole("dialog", { name: "导入已经登录的浏览器档案" })).toHaveCount(0);
  await page.getByRole("button", { name: "配置网页登录", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await expect(dialog.locator(".archive-picker small")).toContainText("请选择 Cookie");
  await expect(dialog.getByRole("button", { name: "加密保存并启用", exact: true })).toBeDisabled();
  await expect(page.getByText("cached-secret.cookies")).toHaveCount(0);
  expect(credentialReads).toBe(1);
});

test("UI2-SC50 KeepAlive deactivation rejects a late browser-helper result", async ({ page }) => {
  await nav(page, [provider, secondProvider]);
  await stubEmptyPlatformDashboard(page);
  await page.route("**/api/v1/platform/credential-assets", (route) =>
    route.fulfill({
      json: { data: [], request_id: "ui2-cache-helper", trace_id: "ui2-cache-helper" },
    }),
  );
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  await page.evaluate(() => {
    window.addEventListener("message", (event) => {
      if (event.data?.type === "SCOUTOPS_BROWSER_BRIDGE_REQUEST")
        (window as any).__p50CachedBridgeRequest = event.data;
    });
  });
  let dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.getByLabel("导入方式").selectOption("browser");
  await dialog.getByRole("button", { name: "从当前浏览器读取 Cookie", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean((window as any).__p50CachedBridgeRequest)))
    .toBe(true);
  await navigatePlatform(page, "/platform-admin");
  await page.evaluate(() => {
    const request = (window as any).__p50CachedBridgeRequest;
    window.postMessage(
      {
        type: "SCOUTOPS_BROWSER_BRIDGE_RESULT",
        request_id: request.request_id,
        ok: true,
        data: { cookies: [{ name: "late", value: "synthetic-cache-late" }] },
      },
      location.origin,
    );
  });
  await page.goBack();
  await expect(page).toHaveURL(/\/platform-admin\/credentials\?/);
  await expect(page.getByRole("dialog", { name: "导入已经登录的浏览器档案" })).toHaveCount(0);
  await page.getByRole("button", { name: "配置网页登录", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.getByLabel("导入方式").selectOption("browser");
  await expect(dialog.getByRole("button", { name: "加密保存并启用", exact: true })).toBeDisabled();
  await expect(page.getByText(/已读取 1 条 Cookie/)).toHaveCount(0);
});

test("UI2-SC50 KeepAlive deactivation aborts and restarts an unfinished credential read", async ({
  page,
}) => {
  await nav(page, [provider, secondProvider]);
  await stubEmptyPlatformDashboard(page);
  await page.unroute("**/api/v1/platform/crawler-profiles");
  await page.unroute("**/api/v1/platform/credential-provider-options");
  let releaseFirst = () => {},
    totalReads = 0;
  const firstReadGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  for (const [pattern, response] of [
    ["**/api/v1/platform/credential-assets", [asset]],
    ["**/api/v1/platform/crawler-profiles", [profile]],
    ["**/api/v1/platform/credential-provider-options", [provider, secondProvider]],
  ] as const)
    await page.route(pattern, async (route) => {
      totalReads += 1;
      if (totalReads <= 3) await firstReadGate;
      try {
        await route.fulfill({
          json: { data: response, request_id: "ui2-cache-read", trace_id: "ui2-cache-read" },
        });
      } catch {}
    });
  await page.goto("/platform-admin/credentials");
  await expect.poll(() => totalReads).toBe(3);
  await navigatePlatform(page, "/platform-admin");
  releaseFirst();
  await page.goBack();
  await expect(page).toHaveURL(/\/platform-admin\/credentials$/);
  await expect(page.getByRole("heading", { name: "北美浏览器档案", exact: true })).toBeVisible();
  expect(totalReads).toBe(6);
});

test("UI2-SC50 detached asset creation locks mutations and refreshes confirmed facts", async ({
  page,
}) => {
  await nav(page, [provider, secondProvider]);
  await stubEmptyPlatformDashboard(page);
  const createdAsset = {
    ...asset,
    id: "00000000-0000-4000-8000-000000000806",
    name: "离页后已确认资产",
    kind: "api_key",
    version: 1,
  };
  let releaseWrite = () => {},
    writeStarted = false,
    assetReads = 0;
  const writeGate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  await page.route("**/api/v1/platform/credential-assets", async (route) => {
    if (route.request().method() === "POST") {
      writeStarted = true;
      await writeGate;
      return route.fulfill({
        status: 201,
        json: {
          data: createdAsset,
          request_id: "ui2-detached-asset-write",
          trace_id: "ui2-detached-asset-write",
        },
      });
    }
    assetReads += 1;
    return route.fulfill({
      json: {
        data: assetReads > 1 ? [asset, createdAsset] : [asset],
        request_id: `ui2-detached-asset-read-${assetReads}`,
        trace_id: `ui2-detached-asset-read-${assetReads}`,
      },
    });
  });
  await page.goto("/platform-admin/credentials");
  await page.getByRole("button", { name: "新建凭证资产", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "创建凭证资产" });
  await editor.getByLabel("名称").fill("离页后已确认资产");
  await editor.getByLabel("需要加密保存的内容").fill("synthetic-detached-secret");
  await editor.getByRole("button", { name: "加密保存", exact: true }).click();
  await expect.poll(() => writeStarted).toBe(true);
  await navigatePlatform(page, "/platform-admin");
  await page.goBack();
  await expect(page.getByRole("button", { name: "配置网页登录", exact: true })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("凭证资产保存仍在等待服务器响应");
  releaseWrite();
  await expect(page.getByRole("heading", { name: createdAsset.name, exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("凭证资产保存已完成");
  expect(assetReads).toBe(2);
});

test("UI2-SC50 detached rotation treats a network result as unknown and rereads facts", async ({
  page,
}) => {
  await nav(page, [provider, secondProvider]);
  await stubEmptyPlatformDashboard(page);
  let releaseWrite = () => {},
    writeStarted = false,
    assetReads = 0;
  const writeGate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  await page.route("**/api/v1/platform/credential-assets/*/rotate", async (route) => {
    writeStarted = true;
    await writeGate;
    await route.abort("failed");
  });
  await page.route("**/api/v1/platform/credential-assets", (route) => {
    assetReads += 1;
    return route.fulfill({
      json: {
        data: [asset],
        request_id: `ui2-detached-rotate-read-${assetReads}`,
        trace_id: `ui2-detached-rotate-read-${assetReads}`,
      },
    });
  });
  await page.goto("/platform-admin/credentials");
  await page.getByRole("button", { name: "更新资料", exact: true }).click();
  const editor = page.getByRole("dialog", { name: `轮换 ${asset.name}` });
  await editor.getByLabel("需要加密保存的内容").fill("synthetic-rotate-secret");
  await editor.getByRole("button", { name: "确认轮换", exact: true }).click();
  await expect.poll(() => writeStarted).toBe(true);
  await navigatePlatform(page, "/platform-admin");
  await page.goBack();
  await expect(page.getByRole("status")).toContainText("凭证资料轮换仍在等待服务器响应");
  releaseWrite();
  await expect(page.getByRole("status")).toContainText("凭证资料轮换结果暂时无法确认");
  await expect(page.getByRole("status")).toContainText("请核对后再操作");
  expect(assetReads).toBe(2);
});

test("UI2-SC50 detached profile failure belongs to the returned credential page", async ({
  page,
}) => {
  await nav(page, [provider, secondProvider]);
  await stubEmptyPlatformDashboard(page);
  let releaseWrite = () => {},
    writeStarted = false;
  const writeGate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  await page.route("**/api/v1/platform/credential-assets", (route) =>
    route.fulfill({
      json: { data: [asset], request_id: "ui2-profile-assets", trace_id: "ui2-profile-assets" },
    }),
  );
  await page.route("**/api/v1/platform/crawler-profiles", async (route) => {
    if (route.request().method() === "POST") {
      writeStarted = true;
      await writeGate;
      return route.fulfill({
        status: 409,
        json: {
          error: {
            code: "crawler_profile_version_conflict",
            message: "档案引用冲突",
            action_hint: "档案引用冲突，请重新读取后重试。",
          },
          request_id: "ui2-detached-profile-conflict",
          trace_id: "ui2-detached-profile-conflict",
        },
      });
    }
    return route.fulfill({
      json: { data: [profile], request_id: "ui2-profile-read", trace_id: "ui2-profile-read" },
    });
  });
  await page.goto("/platform-admin/credentials");
  await page.getByRole("button", { name: "关联运行档案", exact: true }).click();
  const profileEditor = page.getByRole("dialog", { name: "创建浏览器档案引用" });
  await profileEditor.getByLabel("内部标识").fill("detached_profile");
  await profileEditor.getByLabel("名称").fill("离页档案引用");
  await profileEditor
    .getByRole("button", {
      name: "保存档案引用",
      exact: true,
    })
    .click();
  await expect.poll(() => writeStarted).toBe(true);
  await navigatePlatform(page, "/platform-admin");
  await page.goBack();
  await expect(page.getByRole("status")).toContainText("运行档案关联仍在等待服务器响应");
  releaseWrite();
  await expect(page.getByRole("status")).toContainText("档案引用冲突，请重新读取后重试。");
  await expect(page.getByText("ui2-detached-profile-conflict", { exact: true })).toBeVisible();
});

test("UI2-SC50 revoke locks its confirmation and renders the owned failure", async ({ page }) => {
  await nav(page, [provider, secondProvider]);
  let releaseWrite = () => {},
    writeStarted = false;
  const writeGate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  await page.route("**/api/v1/platform/credential-assets/*/revoke", async (route) => {
    writeStarted = true;
    await writeGate;
    return route.fulfill({
      status: 409,
      json: {
        error: {
          code: "credential_version_conflict",
          message: "凭证版本冲突",
          action_hint: "凭证版本已经变化，请重新读取后再撤销。",
        },
        request_id: "ui2-revoke-conflict",
        trace_id: "ui2-revoke-conflict",
      },
    });
  });
  await page.route("**/api/v1/platform/credential-assets", (route) =>
    route.fulfill({
      json: { data: [asset], request_id: "ui2-revoke-read", trace_id: "ui2-revoke-read" },
    }),
  );
  await page.goto("/platform-admin/credentials");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByPlaceholder("确认撤销").fill("确认撤销");
  await dialog.getByRole("button", { name: "撤销资产", exact: true }).click();
  await expect.poll(() => writeStarted).toBe(true);
  await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "正在撤销…", exact: true })).toBeDisabled();
  releaseWrite();
  await expect(dialog).toContainText("凭证版本已经变化，请重新读取后再撤销。");
  await expect(dialog).toContainText("ui2-revoke-conflict");
});

test("UI2-SC50 detached login continues its submitted two-step save and rereads facts", async ({
  page,
}) => {
  await nav(page, [provider, secondProvider]);
  await stubEmptyPlatformDashboard(page);
  await page.unroute("**/api/v1/platform/crawler-profiles");
  const savedAsset = {
      ...asset,
      id: "00000000-0000-4000-8000-000000000807",
      name: "离页登录 Cookie 档案",
      kind: "cookie_bundle",
      version: 1,
    },
    savedProfile = {
      ...profile,
      id: "00000000-0000-4000-8000-000000000808",
      credential_asset_id: savedAsset.id,
      name: "离页登录运行档案",
      status: "active",
    };
  let releaseAsset = () => {},
    assetWriteStarted = false,
    assetWrites = 0,
    profileWrites = 0,
    assetReads = 0,
    profileReads = 0;
  const assetGate = new Promise<void>((resolve) => {
    releaseAsset = resolve;
  });
  await page.route("**/api/v1/platform/credential-assets", async (route) => {
    if (route.request().method() === "POST") {
      assetWrites += 1;
      assetWriteStarted = true;
      await assetGate;
      return route.fulfill({
        status: 201,
        json: {
          data: savedAsset,
          request_id: "ui2-login-detached-asset",
          trace_id: "ui2-login-detached-asset",
        },
      });
    }
    assetReads += 1;
    return route.fulfill({
      json: {
        data: assetWrites ? [savedAsset] : [],
        request_id: `ui2-login-detached-assets-${assetReads}`,
        trace_id: `ui2-login-detached-assets-${assetReads}`,
      },
    });
  });
  await page.route("**/api/v1/platform/crawler-profiles", async (route) => {
    if (route.request().method() === "POST") {
      profileWrites += 1;
      return route.fulfill({
        status: 201,
        json: {
          data: savedProfile,
          request_id: "ui2-login-detached-profile",
          trace_id: "ui2-login-detached-profile",
        },
      });
    }
    profileReads += 1;
    return route.fulfill({
      json: {
        data: profileWrites ? [savedProfile] : [],
        request_id: `ui2-login-detached-profiles-${profileReads}`,
        trace_id: `ui2-login-detached-profiles-${profileReads}`,
      },
    });
  });
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  const dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "detached-login.cookies",
    mimeType: "text/plain",
    buffer: Buffer.from('[{"name":"study","value":"synthetic","domain":"example.test"}]'),
  });
  await dialog.getByRole("button", { name: "加密保存并启用", exact: true }).click();
  await expect.poll(() => assetWriteStarted).toBe(true);
  await navigatePlatform(page, "/platform-admin");
  await page.goBack();
  await expect(page.getByRole("status")).toContainText("网页登录档案保存仍在等待服务器响应");
  await expect(page.getByRole("button", { name: "配置网页登录", exact: true })).toBeDisabled();
  releaseAsset();
  await expect(page.getByRole("heading", { name: savedAsset.name, exact: true })).toBeVisible();
  await expect(page.locator(".profile-list")).toContainText(savedProfile.name);
  await expect(page.getByRole("status")).toContainText("网页登录档案保存已完成");
  expect({ assetWrites, profileWrites, assetReads, profileReads }).toEqual({
    assetWrites: 1,
    profileWrites: 1,
    assetReads: 2,
    profileReads: 2,
  });
});

test("UI2-SC50 detached login asset unknown rereads without creating a profile", async ({
  page,
}) => {
  await nav(page, [provider, secondProvider]);
  await stubEmptyPlatformDashboard(page);
  await page.unroute("**/api/v1/platform/crawler-profiles");
  let releaseAsset = () => {},
    assetWriteStarted = false,
    assetWrites = 0,
    profileWrites = 0,
    assetReads = 0;
  const assetGate = new Promise<void>((resolve) => {
    releaseAsset = resolve;
  });
  await page.route("**/api/v1/platform/credential-assets", async (route) => {
    if (route.request().method() === "POST") {
      assetWrites += 1;
      assetWriteStarted = true;
      await assetGate;
      return route.abort("failed");
    }
    assetReads += 1;
    return route.fulfill({
      json: {
        data: [],
        request_id: `ui2-login-asset-unknown-${assetReads}`,
        trace_id: `ui2-login-asset-unknown-${assetReads}`,
      },
    });
  });
  await page.route("**/api/v1/platform/crawler-profiles", async (route) => {
    if (route.request().method() === "POST") profileWrites += 1;
    return route.fulfill({
      json: { data: [], request_id: "ui2-login-profile-none", trace_id: "ui2-login-profile-none" },
    });
  });
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  const dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "detached-unknown.cookies",
    mimeType: "text/plain",
    buffer: Buffer.from('[{"name":"study","value":"synthetic","domain":"example.test"}]'),
  });
  await dialog.getByRole("button", { name: "加密保存并启用", exact: true }).click();
  await expect.poll(() => assetWriteStarted).toBe(true);
  await navigatePlatform(page, "/platform-admin");
  await page.goBack();
  await expect(page.getByRole("status")).toContainText("网页登录档案保存仍在等待服务器响应");
  releaseAsset();
  await expect(page.getByRole("status")).toContainText("凭证资产写入结果暂时无法确认");
  await expect(page.getByRole("status")).toContainText("避免重新导入");
  expect({ assetWrites, profileWrites, assetReads }).toEqual({
    assetWrites: 1,
    profileWrites: 0,
    assetReads: 2,
  });
});

test("UI2-SC50 detached login profile failure rereads the saved asset for recovery", async ({
  page,
}) => {
  await nav(page, [provider, secondProvider]);
  await stubEmptyPlatformDashboard(page);
  await page.unroute("**/api/v1/platform/crawler-profiles");
  const savedAsset = {
    ...asset,
    id: "00000000-0000-4000-8000-000000000809",
    name: "部分成功 Cookie 档案",
    kind: "cookie_bundle",
    version: 1,
  };
  let releaseProfile = () => {},
    profileWriteStarted = false,
    assetWrites = 0,
    profileWrites = 0,
    assetReads = 0;
  const profileGate = new Promise<void>((resolve) => {
    releaseProfile = resolve;
  });
  await page.route("**/api/v1/platform/credential-assets", async (route) => {
    if (route.request().method() === "POST") {
      assetWrites += 1;
      return route.fulfill({
        status: 201,
        json: {
          data: savedAsset,
          request_id: "ui2-login-partial-asset",
          trace_id: "ui2-login-partial-asset",
        },
      });
    }
    assetReads += 1;
    return route.fulfill({
      json: {
        data: assetWrites ? [savedAsset] : [],
        request_id: `ui2-login-partial-assets-${assetReads}`,
        trace_id: `ui2-login-partial-assets-${assetReads}`,
      },
    });
  });
  await page.route("**/api/v1/platform/crawler-profiles", async (route) => {
    if (route.request().method() === "POST") {
      profileWrites += 1;
      profileWriteStarted = true;
      await profileGate;
      return route.fulfill({
        status: 409,
        json: {
          error: {
            code: "crawler_profile_conflict",
            message: "运行档案冲突",
            action_hint: "运行档案未创建，请重新读取后继续。",
          },
          request_id: "ui2-login-partial-profile",
          trace_id: "ui2-login-partial-profile",
        },
      });
    }
    return route.fulfill({
      json: { data: [], request_id: "ui2-login-partial-read", trace_id: "ui2-login-partial-read" },
    });
  });
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  const dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "detached-partial.cookies",
    mimeType: "text/plain",
    buffer: Buffer.from('[{"name":"study","value":"synthetic","domain":"example.test"}]'),
  });
  await dialog.getByRole("button", { name: "加密保存并启用", exact: true }).click();
  await expect.poll(() => profileWriteStarted).toBe(true);
  await navigatePlatform(page, "/platform-admin");
  await page.goBack();
  await expect(page.getByRole("status")).toContainText("网页登录档案保存仍在等待服务器响应");
  releaseProfile();
  await expect(page.getByRole("heading", { name: savedAsset.name, exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("加密档案已保存，但运行档案未创建");
  await expect(page.getByRole("status")).toContainText("关联运行档案");
  await expect(page.getByText("ui2-login-partial-profile", { exact: true })).toBeVisible();
  expect({ assetWrites, profileWrites, assetReads }).toEqual({
    assetWrites: 1,
    profileWrites: 1,
    assetReads: 2,
  });
});

test("UI2-SC50 detached login profile unknown rereads before any manual recovery", async ({
  page,
}) => {
  await nav(page, [provider, secondProvider]);
  await stubEmptyPlatformDashboard(page);
  await page.unroute("**/api/v1/platform/crawler-profiles");
  const savedAsset = {
    ...asset,
    id: "00000000-0000-4000-8000-000000000810",
    name: "待核对 Cookie 档案",
    kind: "cookie_bundle",
    version: 1,
  };
  let releaseProfile = () => {},
    profileWriteStarted = false,
    assetWrites = 0,
    profileWrites = 0,
    assetReads = 0;
  const profileGate = new Promise<void>((resolve) => {
    releaseProfile = resolve;
  });
  await page.route("**/api/v1/platform/credential-assets", async (route) => {
    if (route.request().method() === "POST") {
      assetWrites += 1;
      return route.fulfill({
        status: 201,
        json: {
          data: savedAsset,
          request_id: "ui2-login-profile-unknown-asset",
          trace_id: "ui2-login-profile-unknown-asset",
        },
      });
    }
    assetReads += 1;
    return route.fulfill({
      json: {
        data: assetWrites ? [savedAsset] : [],
        request_id: `ui2-login-profile-unknown-assets-${assetReads}`,
        trace_id: `ui2-login-profile-unknown-assets-${assetReads}`,
      },
    });
  });
  await page.route("**/api/v1/platform/crawler-profiles", async (route) => {
    if (route.request().method() === "POST") {
      profileWrites += 1;
      profileWriteStarted = true;
      await profileGate;
      return route.abort("failed");
    }
    return route.fulfill({
      json: { data: [], request_id: "ui2-login-unknown-read", trace_id: "ui2-login-unknown-read" },
    });
  });
  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  const dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "detached-profile-unknown.cookies",
    mimeType: "text/plain",
    buffer: Buffer.from('[{"name":"study","value":"synthetic","domain":"example.test"}]'),
  });
  await dialog.getByRole("button", { name: "加密保存并启用", exact: true }).click();
  await expect.poll(() => profileWriteStarted).toBe(true);
  await navigatePlatform(page, "/platform-admin");
  await page.goBack();
  await expect(page.getByRole("status")).toContainText("网页登录档案保存仍在等待服务器响应");
  releaseProfile();
  await expect(page.getByRole("heading", { name: savedAsset.name, exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("运行档案写入结果暂时无法确认");
  await expect(page.getByRole("status")).toContainText("避免重新导入或重复关联");
  expect({ assetWrites, profileWrites, assetReads }).toEqual({
    assetWrites: 1,
    profileWrites: 1,
    assetReads: 2,
  });
});

test("UI2-SC50 settles an in-flight login chain into a replacement evicted page", async ({
  page,
}) => {
  await nav(page, [provider, secondProvider]);
  await stubUnrelatedPlatformReads(page);
  const savedAsset = {
      ...asset,
      id: "00000000-0000-4000-8000-000000000811",
      name: "跨实例 Cookie 登录资料",
      kind: "cookie_bundle",
      version: 1,
    },
    savedProfile = {
      ...profile,
      id: "00000000-0000-4000-8000-000000000812",
      credential_asset_id: savedAsset.id,
      code: "browser_source_login_test",
      name: "跨实例网页登录档案",
      status: "active",
    };
  let releaseAssetWrite = () => {},
    releaseProfileWrite = () => {},
    assetWriteStarted = false,
    profileWriteStarted = false,
    assetWrites = 0,
    profileWrites = 0,
    assetReads = 0,
    profileReads = 0,
    providerReads = 0,
    assets: (typeof asset)[] = [],
    profiles: (typeof profile)[] = [];
  const assetWriteGate = new Promise<void>((resolve) => {
      releaseAssetWrite = resolve;
    }),
    profileWriteGate = new Promise<void>((resolve) => {
      releaseProfileWrite = resolve;
    });
  await page.route("**/api/v1/platform/credential-provider-options", (route) => {
    providerReads += 1;
    return route.fulfill({ json: { data: [provider], request_id: "ui2-p50-cross-provider" } });
  });
  await page.route("**/api/v1/platform/credential-assets", async (route) => {
    if (route.request().method() === "POST") {
      assetWrites += 1;
      assetWriteStarted = true;
      await assetWriteGate;
      assets = [savedAsset];
      return route.fulfill({
        status: 201,
        json: { data: savedAsset, request_id: "ui2-p50-cross-asset" },
      });
    }
    assetReads += 1;
    return route.fulfill({
      json: { data: assets, request_id: `ui2-p50-cross-assets-${assetReads}` },
    });
  });
  await page.route("**/api/v1/platform/crawler-profiles", async (route) => {
    if (route.request().method() === "POST") {
      profileWrites += 1;
      profileWriteStarted = true;
      await profileWriteGate;
      profiles = [savedProfile];
      return route.fulfill({
        status: 201,
        json: { data: savedProfile, request_id: "ui2-p50-cross-profile" },
      });
    }
    profileReads += 1;
    return route.fulfill({
      json: { data: profiles, request_id: `ui2-p50-cross-profiles-${profileReads}` },
    });
  });

  await page.goto(`/platform-admin/credentials?provider_id=${provider.id}&mode=login`);
  const dialog = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "cross-instance.cookies",
    mimeType: "text/plain",
    buffer: Buffer.from('[{"name":"study","value":"synthetic","domain":"example.test"}]'),
  });
  await dialog.getByRole("button", { name: "加密保存并启用", exact: true }).click();
  await expect.poll(() => assetWriteStarted).toBe(true);

  await evictCredentialSurface(page);
  releaseAssetWrite();
  await expect.poll(() => profileWriteStarted).toBe(true);
  await navigatePlatform(page, "/platform-admin/providers/sources");
  await navigatePlatform(page, "/platform-admin/credentials");
  await expect(page.getByRole("status")).toContainText("网页登录档案保存仍在等待服务器响应");
  await expect(page.getByRole("button", { name: "新建凭证资产", exact: true })).toBeDisabled();

  releaseProfileWrite();
  await expect(page.getByRole("heading", { name: savedAsset.name, exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("网页登录档案保存已完成");
  await expect(page.getByRole("status")).toContainText("当前凭证资料已重新读取");
  await expect(page.getByRole("button", { name: "新建凭证资产", exact: true })).toBeEnabled();
  expect({ assetWrites, profileWrites, assetReads, profileReads, providerReads }).toEqual({
    assetWrites: 1,
    profileWrites: 1,
    assetReads: 3,
    profileReads: 3,
    providerReads: 3,
  });
});
