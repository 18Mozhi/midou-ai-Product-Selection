import { test, expect } from "@playwright/test";

test("M01-02.A07/A15 MFA security center loads through an authenticated session", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: { data: { authenticated: true }, request_id: "status", trace_id: "status" },
    }),
  );
  await page.route("**/api/v1/me/mfa", (route) =>
    route.fulfill({
      json: {
        data: { totp_enabled: false },
        request_id: "mfa-status",
        trace_id: "mfa-status",
      },
    }),
  );
  await page.goto("/security/mfa");
  await expect(page.getByRole("heading", { name: "为账号启用认证器" })).toBeVisible();
  const root = page.getByTestId("mfa");
  await expect(root).toContainText("认证器当前未启用");
  const layout = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    controls: Array.from(
      document.querySelectorAll(".p07-mfa-workspace input, .p07-mfa-workspace button"),
    ).map((element) => ({
      height: element.getBoundingClientRect().height,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
    })),
  }));
  expect(layout.scroll).toBeLessThanOrEqual(layout.client);
  expect(layout.controls.every((control) => control.height >= 44 && control.fontSize >= 16)).toBe(
    true,
  );
});

test("M01-02 account link switches the reused identity surface into MFA management", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: { data: { authenticated: true }, request_id: "status", trace_id: "status" },
    }),
  );
  await page.route("**/api/v1/me/mfa", (route) =>
    route.fulfill({
      json: { data: { totp_enabled: false }, request_id: "mfa", trace_id: "mfa" },
    }),
  );
  await page.goto("/login");
  await page.getByRole("link", { name: "管理 MFA" }).click();
  await expect(page).toHaveURL(/\/security\/mfa$/);
  await expect(page.getByRole("heading", { name: "为账号启用认证器" })).toBeVisible();
  await expect(page.getByTestId("mfa")).toContainText("认证器当前未启用");
});

test("P07 enrollment and confirmation validate locally and keep exact requests single-flight", async ({
  page,
}) => {
  const writes: Array<{ method: string; body: unknown }> = [];
  let releaseEnrollment!: () => void;
  let enrollmentSeen!: () => void;
  const enrollmentHeld = new Promise<void>((resolve) => (releaseEnrollment = resolve));
  const enrollmentStarted = new Promise<void>((resolve) => (enrollmentSeen = resolve));
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: { data: { authenticated: true }, request_id: "p07-session", trace_id: "p07-session" },
    }),
  );
  await page.route("**/api/v1/me/mfa", (route) =>
    route.fulfill({
      json: { data: { totp_enabled: false }, request_id: "p07-status", trace_id: "p07-status" },
    }),
  );
  await page.route("**/api/v1/me/mfa/totp/enrollment", async (route) => {
    writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
    enrollmentSeen();
    await enrollmentHeld;
    await route.fulfill({
      status: 201,
      json: {
        data: { secret: "synthetic-secret-for-local-test" },
        request_id: "p07-enroll",
        trace_id: "p07-enroll",
      },
    });
  });
  await page.route("**/api/v1/me/mfa/totp/confirm", async (route) => {
    writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
    await route.fulfill({
      json: {
        data: { recovery_codes: ["synthetic-recovery-1", "synthetic-recovery-2"] },
        request_id: "p07-confirm",
        trace_id: "p07-confirm",
      },
    });
  });
  await page.goto("/security/mfa");
  const root = page.getByTestId("mfa");
  await expect(root.getByText("认证器当前未启用")).toBeVisible();
  const start = root.locator(".p07-mfa-primary");
  await start.hover();
  await expect(start).toHaveCSS("background-color", "rgb(18, 59, 134)");
  await page.mouse.down();
  await expect(start).toHaveCSS("background-color", "rgb(15, 50, 111)");
  await page.mouse.up();
  await page.getByLabel("当前密码").focus();
  await page.keyboard.press("Tab");
  await expect(start).toBeFocused();
  await expect(start).toHaveCSS("outline-width", "3px");
  await expect(start).toHaveCSS("outline-color", "rgb(36, 101, 215)");
  await start.click();
  await expect(page.getByLabel("当前密码")).toBeFocused();
  expect(writes).toEqual([]);
  await page.getByLabel("当前密码").fill("correct-password-123");
  await start.click();
  await enrollmentStarted;
  await expect(start).toBeDisabled();
  await expect(start).toHaveCSS("background-color", "rgb(232, 237, 243)");
  expect(writes).toEqual([{ method: "POST", body: { current_password: "correct-password-123" } }]);
  releaseEnrollment();
  await expect(page.getByText("synthetic-secret-for-local-test", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "确认并启用" }).click();
  await expect(page.getByLabel("认证器验证码")).toBeFocused();
  expect(writes).toHaveLength(1);
  await page.getByLabel("认证器验证码").fill("123456");
  await page.getByRole("button", { name: "确认并启用" }).click();
  await expect(page.getByText("synthetic-recovery-1", { exact: true })).toBeVisible();
  await expect(root).toHaveAttribute("data-state", "ready");
  expect(writes[1]).toEqual({ method: "POST", body: { code: "123456" } });
  await page.getByRole("link", { name: "返回登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("synthetic-secret-for-local-test", { exact: true })).toHaveCount(0);
  await expect(page.getByText("synthetic-recovery-1", { exact: true })).toHaveCount(0);
});

test("P07 read failure remains unknown until explicit retry succeeds", async ({ page }) => {
  let reads = 0;
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: { data: { authenticated: true }, request_id: "p07-session", trace_id: "p07-session" },
    }),
  );
  await page.route("**/api/v1/me/mfa", (route) => {
    reads += 1;
    return reads === 1
      ? route.fulfill({
          status: 400,
          json: {
            error: { code: "mfa_unavailable", message: "暂时无法读取安全状态。" },
            request_id: "p07-read-failure",
            trace_id: "p07-read-trace",
          },
        })
      : route.fulfill({
          json: {
            data: { totp_enabled: false },
            request_id: "p07-read-retry",
            trace_id: "p07-read-retry",
          },
        });
  });
  await page.goto("/security/mfa");
  const root = page.getByTestId("mfa");
  await expect(root).toHaveAttribute("data-state", "error");
  await expect(root).toContainText("暂时无法读取安全状态。");
  await expect(root).toContainText("p07-read-failure");
  await expect(root.getByText("认证器当前未启用")).toHaveCount(0);
  await expect(page.getByLabel("当前密码")).toHaveCount(0);
  await page.getByRole("button", { name: "重新读取安全状态" }).click();
  await expect(root.getByText("认证器当前未启用")).toBeVisible();
  expect(reads).toBe(2);
});

test("first-time security setup uses native MFA validation and preserves the same request bodies", async ({
  page,
}) => {
  const writes: Array<{ url: string; method: string; body: unknown }> = [];
  await page.route("**/api/v1/auth/login", async (route) => {
    writes.push({
      url: "/auth/login",
      method: route.request().method(),
      body: route.request().postDataJSON(),
    });
    await route.fulfill({
      json: {
        data: {
          security_setup: {
            required: true,
            must_change_password: false,
            must_enroll_mfa: true,
          },
        },
        request_id: "seed-login",
        trace_id: "seed-login",
      },
    });
  });
  await page.route("**/api/v1/me/mfa/totp/enrollment", async (route) => {
    writes.push({
      url: "/me/mfa/totp/enrollment",
      method: route.request().method(),
      body: route.request().postDataJSON(),
    });
    await route.fulfill({
      status: 201,
      json: {
        data: { secret: "synthetic-seed-secret" },
        request_id: "seed-enroll",
        trace_id: "seed-enroll",
      },
    });
  });
  await page.route("**/api/v1/me/mfa/totp/confirm", async (route) => {
    writes.push({
      url: "/me/mfa/totp/confirm",
      method: route.request().method(),
      body: route.request().postDataJSON(),
    });
    await route.fulfill({
      json: {
        data: { recovery_codes: ["synthetic-seed-recovery"] },
        request_id: "seed-confirm",
        trace_id: "seed-confirm",
      },
    });
  });
  await page.goto("/login");
  await page.getByLabel("账号（邮箱或用户名）").fill("seed@example.invalid");
  await page.getByLabel("密码").fill("synthetic-seed-password");
  await page.getByRole("button", { name: "登录" }).click();
  const setup = page.getByTestId("security-setup");
  await expect(setup).toBeVisible();
  const currentPassword = page.getByLabel("当前密码");
  await currentPassword.fill("");
  const start = setup.locator("button[type=submit]");
  await start.click();
  await expect(currentPassword).toBeFocused();
  expect(writes).toHaveLength(1);
  await currentPassword.fill("synthetic-seed-password");
  await start.click();
  await expect(page.getByText("synthetic-seed-secret", { exact: true })).toBeVisible();
  expect(writes[1]).toEqual({
    url: "/me/mfa/totp/enrollment",
    method: "POST",
    body: { current_password: "synthetic-seed-password" },
  });
  const code = page.getByLabel("认证器验证码");
  const confirm = setup.locator("button[type=submit]");
  await confirm.click();
  await expect(code).toBeFocused();
  expect(writes).toHaveLength(2);
  await code.fill("123456");
  await confirm.click();
  await expect(page.getByText("synthetic-seed-recovery", { exact: true })).toBeVisible();
  expect(writes[2]).toEqual({
    url: "/me/mfa/totp/confirm",
    method: "POST",
    body: { code: "123456" },
  });
});

test("P07 disable stays on the page only after success and requires explicit relogin", async ({
  page,
}) => {
  const writes: Array<{ method: string; body: unknown }> = [];
  let releaseDisable!: () => void;
  let disableSeen!: () => void;
  const disableHeld = new Promise<void>((resolve) => (releaseDisable = resolve));
  const disableStarted = new Promise<void>((resolve) => (disableSeen = resolve));
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: { data: { authenticated: true }, request_id: "p07-session", trace_id: "p07-session" },
    }),
  );
  await page.route("**/api/v1/me/mfa", (route) =>
    route.fulfill({
      json: { data: { totp_enabled: true }, request_id: "p07-status", trace_id: "p07-status" },
    }),
  );
  await page.route("**/api/v1/me/mfa/totp", async (route) => {
    writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
    disableSeen();
    await disableHeld;
    await route.fulfill({ status: 204 });
  });
  await page.goto("/security/mfa");
  const password = page.getByLabel("当前密码");
  const code = page.getByLabel("当前验证码或恢复码");
  const disable = page.locator(".p07-mfa-danger-button");
  await disable.click();
  expect(writes).toEqual([]);
  await password.fill("correct-password-123");
  await code.fill("123456");
  await disable.click();
  await disableStarted;
  await expect(disable).toBeDisabled();
  expect(writes).toEqual([
    {
      method: "DELETE",
      body: { current_password: "correct-password-123", code: "123456" },
    },
  ]);
  releaseDisable();
  const root = page.getByTestId("mfa");
  await expect(root.getByText("认证器已停用", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/security\/mfa$/);
  await expect(disable).toHaveCount(0);
  await page.getByRole("link", { name: "返回登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("M01-02.A08/A15 stale MFA state returns to password login at desktop and 390px", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 202,
      json: {
        data: { mfa_required: true, expires_at: "2026-09-01T10:00:00.000Z" },
        request_id: "login-request",
        trace_id: "login-request",
      },
    }),
  );
  await page.route("**/api/v1/auth/mfa/totp/verify", (route) =>
    route.fulfill({
      status: 401,
      json: {
        error: {
          code: "mfa_challenge_invalid",
          message: "MFA 登录挑战无效或已过期。",
          action_hint: "重新输入邮箱和密码后重试。",
        },
        request_id: "challenge-request",
        trace_id: "challenge-trace",
      },
    }),
  );
  await page.goto("/login?mode=mfa-challenge");
  await expect(page.getByLabel("账号（邮箱或用户名）")).toBeVisible();
  await page.getByLabel("账号（邮箱或用户名）").fill("member@example.com");
  await page.getByLabel("密码").fill("Correct-Horse-42");
  await page.getByRole("button", { name: "登录" }).click();
  const code = page.getByLabel("认证器验证码或恢复码");
  await code.focus();
  await code.fill("123456");
  await expect(page.getByRole("button", { name: "验证并登录" })).toBeEnabled();
  await page.getByRole("button", { name: "验证并登录" }).click();
  await expect(page.getByLabel("账号（邮箱或用户名）")).toBeVisible();
  await expect(page.getByTestId("error")).toContainText("MFA 登录挑战无效或已过期");
});
