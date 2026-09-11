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
async function navigatePlatform(page: any, path: string) {
  const link = page
    .getByRole("navigation", { name: "平台管理后台导航", exact: true })
    .locator(`a[href="${path}"]`);
  await expect(link).toHaveCount(1);
  // Browser back/forward can leave a modal without a pointer click; invoke the real RouterLink.
  await link.evaluate((element: HTMLAnchorElement) => element.click());
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
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
  await expect(dialog.getByRole("button", { name: "关闭", exact: true })).toBeDisabled();
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
