import { expect, test, type Page } from "@playwright/test";

const envelope = (data: unknown) => ({
  data,
  request_id: "ui2-account-request",
  trace_id: "ui2-account-trace",
});
const preference = (theme = "deep-ocean", version = 5) => ({
  theme,
  version,
  source: "saved",
  organization_id: "00000000-0000-4000-8000-000000000221",
  workspace_id: "00000000-0000-4000-8000-000000000222",
  updated_at: "2026-09-07T00:00:00.000Z",
});
const profile = {
  email: "member@example.test",
  email_verified_at: "2026-09-07T00:00:00.000Z",
  username: "member.test",
  display_name: "隔离成员",
  avatar_url: null,
  phone: null,
  phone_verified_at: null,
  locale: "zh-CN",
  timezone: "Asia/Shanghai",
  version: 3,
};

async function accountSession(page: Page) {
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({ json: envelope({ authenticated: true }) }),
  );
}

test("UI2-A01 theme preview and restore do not persist density or write preferences", async ({
  page,
}) => {
  let writes = 0;
  await page.route("**/api/v1/me/ui-preferences", async (route) => {
    if (route.request().method() !== "GET") writes += 1;
    await route.fulfill({ json: envelope(preference()) });
  });
  await page.goto("/settings/theme");
  const save = page.getByRole("button", { name: "保存主题", exact: true });
  await page.getByRole("radio", { name: /紧凑/ }).click();
  await expect(save).toBeDisabled();
  await page.getByRole("radio", { name: /档案纸/ }).press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "aurora-purple");
  await expect(save).toBeEnabled();
  await page.getByRole("button", { name: "撤销预览" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "deep-ocean");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await expect(save).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("scoutops:ui-theme"))).toBe("deep-ocean");
  await page.reload();
  await expect(page.getByRole("radio", { name: /标准/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-density", "standard");
  expect(writes).toBe(0);
});

test("UI2-A02 theme saves exact versioned payloads and uses the returned revision", async ({
  page,
}) => {
  let saved = preference();
  const bodies: unknown[] = [];
  const keys: string[] = [];
  await page.route("**/api/v1/me/ui-preferences", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as { theme: string; expected_version: number };
      bodies.push(body);
      keys.push(route.request().headers()["idempotency-key"] ?? "");
      saved = preference(body.theme, saved.version + 1);
    }
    await route.fulfill({ json: envelope(saved) });
  });
  await page.goto("/settings/theme");
  await page.getByRole("radio", { name: /档案纸/ }).click();
  await page.getByRole("button", { name: "保存主题", exact: true }).click();
  await expect(page.getByText("✓ 已保存", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: /净页白/ }).click();
  await page.getByRole("button", { name: "保存主题", exact: true }).click();
  await expect(page.getByText("✓ 已保存", { exact: true })).toBeVisible();
  expect(bodies).toEqual([
    { theme: "aurora-purple", expected_version: 5 },
    { theme: "cloud-white", expected_version: 6 },
  ]);
  expect(keys.every((key) => key.length > 0)).toBe(true);
  expect(new Set(keys).size).toBe(2);
  await page.reload();
  await expect(page.getByRole("radio", { name: /净页白/ })).toHaveAttribute("aria-checked", "true");
  expect(bodies).toHaveLength(2);
});

test("UI2-A03 theme conflict requires fresh preference before the next versioned save", async ({
  page,
}) => {
  const bodies: unknown[] = [];
  let reads = 0;
  await page.route("**/api/v1/me/ui-preferences", async (route) => {
    if (route.request().method() === "GET") {
      reads += 1;
      return route.fulfill({
        json: envelope(reads === 1 ? preference() : preference("cloud-white", 9)),
      });
    }
    const body = route.request().postDataJSON() as { theme: string; expected_version: number };
    bodies.push(body);
    if (bodies.length === 1)
      return route.fulfill({
        status: 409,
        json: {
          error: { code: "preference_version_conflict", action_hint: "刷新最新偏好后重新选择。" },
          request_id: "ui2-theme-conflict",
          trace_id: "ui2-theme-conflict",
        },
      });
    await route.fulfill({ json: envelope(preference(body.theme, 10)) });
  });
  await page.goto("/settings/theme");
  await page.getByRole("radio", { name: /档案纸/ }).click();
  await page.getByRole("button", { name: "保存主题", exact: true }).click();
  await expect(page.getByText("主题偏好已在其他窗口更新", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存主题", exact: true })).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  await page.getByRole("button", { name: "刷新偏好" }).click();
  await expect(page.getByRole("radio", { name: /净页白/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /档案纸/ }).click();
  await page.getByRole("button", { name: "保存主题", exact: true }).click();
  await expect(page.getByText("✓ 已保存", { exact: true })).toBeVisible();
  expect(bodies).toEqual([
    { theme: "aurora-purple", expected_version: 5 },
    { theme: "aurora-purple", expected_version: 9 },
  ]);
});

test("UI2-A04 profile remains writable when tenant sections fail without requesting member navigation", async ({
  page,
}) => {
  await accountSession(page);
  let saved = { ...profile };
  const bodies: unknown[] = [];
  let navigationReads = 0;
  await page.route("**/api/v1/me/navigation**", (route) => {
    navigationReads += 1;
    return route.abort();
  });
  await page.route("**/api/v1/me/profile", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as { display_name: string };
      bodies.push(body);
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      saved = { ...saved, display_name: body.display_name, version: saved.version + 1 };
    }
    await route.fulfill({ json: envelope(saved) });
  });
  await page.route("**/api/v1/me/sessions", (route) => route.fulfill({ json: envelope([]) }));
  for (const endpoint of ["authorization", "notification-preferences", "assets"]) {
    await page.route(`**/api/v1/me/${endpoint}`, (route) =>
      route.fulfill({
        status: 403,
        json: {
          error: { code: "forbidden", action_hint: "当前隔离账号尚未选择工作区。" },
          request_id: "ui2-section-unavailable",
          trace_id: "ui2-section-unavailable",
        },
      }),
    );
  }
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "隔离成员", exact: true })).toBeVisible();
  await expect(page.getByText("个人资料已读取，另有 3 个分区暂不可用，可稍后刷新。")).toBeVisible();
  await expect(page.getByLabel("邮箱", { exact: false }).first()).toBeDisabled();
  await page.getByLabel("显示名称", { exact: true }).fill("隔离成员新名称");
  await page.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(page.getByRole("heading", { name: "隔离成员新名称", exact: true })).toBeVisible();
  expect(bodies).toEqual([
    {
      username: "member.test",
      display_name: "隔离成员新名称",
      avatar_url: "",
      phone: "",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      reason: "更新个人资料",
      expected_version: 3,
    },
  ]);
  expect(navigationReads).toBe(0);
});

test("UI2-A05 notification preferences keep five booleans and the latest server version", async ({
  page,
}) => {
  await accountSession(page);
  const initial = {
    version: 7,
    in_app_enabled: true,
    email_enabled: false,
    task_enabled: true,
    approval_enabled: true,
    competitor_enabled: true,
  };
  const bodies: unknown[] = [];
  let version = initial.version;
  await page.route("**/api/v1/me/profile", (route) => route.fulfill({ json: envelope(profile) }));
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({ json: envelope({ roles: [], capabilities: [], data_scopes: [] }) }),
  );
  await page.route("**/api/v1/me/sessions", (route) => route.fulfill({ json: envelope([]) }));
  await page.route("**/api/v1/me/assets", (route) =>
    route.fulfill({ json: envelope({ followed_trends: [], decisions: [], tasks: [] }) }),
  );
  await page.route("**/api/v1/me/notification-preferences", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      bodies.push(body);
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      version += 1;
      return route.fulfill({
        json: envelope({
          version,
          in_app_enabled: body.in_app_enabled,
          email_enabled: body.email_enabled,
          task_enabled: body.task_enabled,
          approval_enabled: body.approval_enabled,
          competitor_enabled: body.competitor_enabled,
        }),
      });
    }
    await route.fulfill({ json: envelope(initial) });
  });
  await page.goto("/me?section=notifications");
  await expect(page.getByRole("heading", { name: "通知偏好", exact: true })).toBeVisible();
  await expect(
    page.getByText("基本资料已显示，正在后台读取权限、安全、通知和资产信息…"),
  ).toHaveCount(0);
  await page.getByRole("checkbox", { name: "邮件通知", exact: true }).check();
  await page.getByRole("checkbox", { name: "任务通知", exact: true }).uncheck();
  await page.getByRole("button", { name: "保存偏好", exact: true }).click();
  await expect(page.getByText("偏好已保存；邮件服务商未配置前只记录待投递状态。")).toBeVisible();
  await page.getByRole("checkbox", { name: "邮件通知", exact: true }).uncheck();
  await page.getByRole("button", { name: "保存偏好", exact: true }).click();
  await expect(page.locator(".personal-notice")).toContainText("通知偏好已保存。");
  expect(bodies).toEqual([
    {
      expected_version: 7,
      in_app_enabled: true,
      email_enabled: true,
      task_enabled: false,
      approval_enabled: true,
      competitor_enabled: true,
    },
    {
      expected_version: 8,
      in_app_enabled: true,
      email_enabled: false,
      task_enabled: false,
      approval_enabled: true,
      competitor_enabled: true,
    },
  ]);
});
