import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", (route) => route.abort());
  const envelope = (data: unknown) => ({
    data,
    request_id: "logout-read",
    trace_id: "logout-read",
  });
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({ json: envelope({ authenticated: true }) }),
  );
  await page.route("**/api/v1/me/profile", (route) =>
    route.fulfill({
      json: envelope({
        email: "member@example.test",
        display_name: "成员",
        username: "member",
        version: 1,
        locale: "zh-CN",
        timezone: "Asia/Shanghai",
      }),
    }),
  );
});

for (const status of [204, 401]) {
  test(`logout ${status} destroys protected views and enters login`, async ({ page }) => {
    const writes: { method: string; key: string | undefined; body: string | null }[] = [];
    await page.route("**/api/v1/auth/logout", async (route) => {
      writes.push({
        method: route.request().method(),
        key: route.request().headers()["idempotency-key"],
        body: route.request().postData(),
      });
      await route.fulfill({ status });
    });
    await page.goto("/me");
    await page.getByRole("button", { name: "退出登录", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "安全登录" })).toBeVisible();
    await expect(page.locator(".account-shell")).toHaveCount(0);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ method: "POST", body: null });
    expect(writes[0].key).toMatch(/^[a-f0-9-]{36}$/);
  });
}

test("logout does not repeat a pending POST or claim success after failure", async ({ page }) => {
  const keys: string[] = [];
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/auth/logout", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      await pending;
      await route.fulfill({
        status: 503,
        json: { error: { code: "unavailable", user_message: "暂不可用", action_hint: "稍后重试" } },
      });
    } else await route.fulfill({ status: 204 });
  });
  await page.goto("/me");
  const logout = page.getByRole("button", { name: "退出登录", exact: true });
  await logout.click();
  await expect(page.getByRole("button", { name: "正在退出…" })).toBeDisabled();
  expect(keys).toHaveLength(1);
  release();
  await expect(page.getByRole("alert").filter({ hasText: "暂时无法确认退出结果" })).toBeVisible();
  await expect(page).toHaveURL(/\/me$/);
  expect(keys).toHaveLength(1);
  await logout.click();
  await expect(page).toHaveURL(/\/login$/);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});
