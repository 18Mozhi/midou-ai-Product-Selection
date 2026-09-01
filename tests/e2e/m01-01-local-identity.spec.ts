import { test, expect } from "@playwright/test";

test("M01-01.A07/A15 local identity login and registration are visually stable", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "欢迎回到智能选品" })).toBeVisible();

  await page.getByRole("button", { name: "创建本地账号" }).click();
  await expect(page.getByRole("heading", { name: "创建本地账号" })).toBeVisible();
});

test("M01-01.A08/A15 anonymous security entry returns to login without protected 401", async ({
  page,
}) => {
  let protectedRequests = 0;
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: {
        data: { authenticated: false },
        request_id: "anonymous-status",
        trace_id: "anonymous-status",
      },
    }),
  );
  await page.route("**/api/v1/me/sessions", (route) => {
    protectedRequests += 1;
    return route.abort();
  });
  await page.goto("/login?state=expired");
  await expect(page.getByText("链接已过期")).toBeVisible();
  await page.getByRole("link", { name: "查看安全会话" }).click();
  await expect(page).toHaveURL(/\/login\?reason=authentication_required/);
  await expect(page.getByText("请先登录，再进入安全会话或 MFA 设置。")).toBeVisible();
  expect(protectedRequests).toBe(0);
});

test("M01-01 regression: successful administrator login enters the operation panel instead of device sessions", async ({
  page,
}) => {
  let loginPayload: Record<string, string> | null = null;
  await page.route("**/api/v1/auth/login", (route) => {
    loginPayload = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          user: { id: "admin" },
          session: { id: "session" },
          security_setup: { required: false },
        },
        request_id: "login-admin",
        trace_id: "login-admin",
      }),
    });
  });
  await page.route("**/api/v1/me/landing", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          shell: "platform_admin",
          route: "/platform-admin",
          reason: "landing_platform_admin",
        },
        request_id: "landing-admin",
        trace_id: "landing-admin",
      }),
    }),
  );
  await page.goto("/login");
  await page.getByLabel("账号（邮箱或用户名）").fill("Admin.Operator");
  await page.getByLabel("密码").fill("AdminPassword!234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/platform-admin$/);
  expect(loginPayload).toEqual({ identifier: "Admin.Operator", password: "AdminPassword!234" });
});
