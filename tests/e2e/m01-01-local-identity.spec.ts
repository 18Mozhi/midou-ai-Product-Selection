import { test, expect } from "@playwright/test";

test("M01-01.A07/A15 local identity login and registration are visually stable", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "欢迎回到智能选品" })).toBeVisible();

  await page.getByRole("button", { name: "创建本地账号" }).click();
  await expect(page.getByRole("heading", { name: "创建本地账号" })).toBeVisible();
});

test("M01-01.A08/A15 recovery and session states remain accessible at 390px", async ({ page }) => {
  await page.route("**/api/v1/me/sessions", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "UNAUTHORIZED",
          message: "请先登录后查看会话。",
          action_hint: "返回登录页重新认证。",
        },
        request_id: "m01-01-visual-request",
      }),
    });
  });
  await page.goto("/login?state=expired");
  await expect(page.getByText("链接已过期")).toBeVisible();
  await page.getByRole("button", { name: "查看安全会话" }).click();
  await expect(page.getByRole("heading", { name: "我的设备会话" })).toBeVisible();
  await expect(page.locator(".identity-page")).not.toHaveAttribute("data-state", "loading");
});

test("M01-01 regression: successful administrator login enters the operation panel instead of device sessions", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
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
    }),
  );
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
  await page.getByLabel("邮箱").fill("admin@example.test");
  await page.getByLabel("密码").fill("AdminPassword!234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/platform-admin$/);
});
