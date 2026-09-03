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
  await expect(page.getByRole("heading", { name: "多因素认证" })).toBeVisible();
  await expect(page.getByTestId("mfa")).toContainText("认证器 TOTP");
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
  await expect(page.getByRole("heading", { name: "多因素认证" })).toBeVisible();
  await expect(page.getByTestId("mfa")).toContainText("认证器 TOTP");
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
