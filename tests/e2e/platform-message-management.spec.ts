import { expect, test } from "@playwright/test";

const messageId = "00000000-0000-4000-8000-000000000801";
const envelope = (data: unknown) => ({
  data,
  request_id: "platform-message-e2e",
  trace_id: "platform-message-e2e",
});

for (const status of ["draft", "published", "cancelled"]) {
  test(`UI2-PN57 ${status} message exposes its complete body without a write`, async ({ page }) => {
    const body = Array.from(
      { length: 18 },
      (_, index) => `第 ${index + 1} 行：通知正文应当完整可读。`,
    ).join("\n");
    let reads = 0;
    const writes: string[] = [];
    await page.route("**/api/v1/me/navigation?**", (route) =>
      route.fulfill({
        json: envelope({
          shell: "platform_admin",
          organization_id: null,
          workspace_id: null,
          roles: [],
          capabilities: [],
          platform_roles: ["platform_super_admin"],
          platform_capabilities: ["platform:operate"],
          guard_reason: "navigation_platform_admin_allowed",
        }),
      }),
    );
    await page.route("**/api/v1/platform/management**", async (route) => {
      if (route.request().method() !== "GET") {
        writes.push(route.request().method());
        return route.fulfill({ status: 500, json: {} });
      }
      reads += 1;
      return route.fulfill({
        json: envelope({
          domain: "notifications",
          summary: { total: 0, unread: 0, critical: 0 },
          items: [],
          templates: [],
          channels: [],
          subscriptions: {},
          alert_routes: [],
          pagination: { page: 1, page_size: 20, total: 0, total_pages: 1 },
          message_pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
          messages: [
            {
              id: messageId,
              kind: "notification",
              title: "长正文审核通知",
              body,
              status,
              version: 2,
              category: "system",
              severity: "info",
              audience_type: "all_users",
              in_app_enabled: true,
              email_enabled: false,
              updated_at: "2026-09-08T00:00:00.000Z",
            },
          ],
          audience_options: { organizations: [], users: [] },
          observed_at: "2026-09-08T00:00:00.000Z",
        }),
      });
    });
    await page.goto("/platform-admin/notifications");
    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "长正文审核通知" }) });
    const disclosure = card.locator("details");
    const trigger = disclosure.locator("summary");
    const content = disclosure.locator("p");
    await expect(trigger).toHaveText("完整正文");
    await expect(content).not.toBeVisible();
    await trigger.focus();
    await trigger.press("Enter");
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(content).toBeVisible();
    await expect(content).toHaveText(body);
    await expect
      .poll(() => content.evaluate((element) => element.scrollHeight - element.clientHeight))
      .toBeLessThanOrEqual(1);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(1);
    await trigger.press("Space");
    await expect(content).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(card.getByRole("button", { name: "编辑", exact: true })).toHaveCount(
      status === "draft" ? 1 : 0,
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(reads).toBe(1);
    expect(writes).toEqual([]);
  });
}

test("platform administrator can create and publish a Chinese notification", async ({ page }) => {
  let messages: any[] = [];
  let createBody: any = null;
  let actionBody: any = null;
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      json: envelope({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_super_admin"],
        platform_capabilities: ["platform:operate"],
        guard_reason: "navigation_platform_admin_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      json: envelope({
        summary: {
          drafts: messages.filter((item) => item.status === "draft").length,
        },
        items: [],
        templates: [],
        channels: [],
        subscriptions: [],
        alert_routes: [],
        messages,
        audience_options: { organizations: [], users: [] },
      }),
    }),
  );
  await page.route("**/api/v1/platform/management/messages", async (route) => {
    createBody = route.request().postDataJSON();
    messages = [
      {
        id: messageId,
        ...createBody,
        status: "draft",
        version: 1,
        updated_at: "2026-08-19T04:00:00.000Z",
      },
    ];
    await route.fulfill({
      status: 201,
      json: envelope({ id: messageId, status: "draft", version: 1 }),
    });
  });
  await page.route(`**/api/v1/platform/management/messages/${messageId}/actions`, async (route) => {
    actionBody = route.request().postDataJSON();
    messages = messages.map((item) => ({
      ...item,
      status: "published",
      version: 2,
    }));
    await route.fulfill({
      json: envelope({
        id: messageId,
        status: "published",
        version: 2,
        recipient_count: 3,
        in_app_count: 3,
        email_count: 0,
      }),
    });
  });

  await page.goto("/platform-admin/notifications");
  await page.getByRole("button", { name: "发布通知" }).click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "平台通知" }) });
  await expect(dialog.getByRole("checkbox", { name: "邮件（服务未接入）" })).toBeDisabled();
  await dialog.getByLabel("标题").fill("系统维护提醒");
  await dialog.getByLabel("正文").fill("今晚十点进行系统维护，请提前保存工作。");
  await dialog.getByRole("button", { name: "保存草稿" }).click();
  await expect.poll(() => createBody?.title).toBe("系统维护提醒");
  await expect(page.getByRole("heading", { name: "系统维护提醒" })).toBeVisible();

  await page.getByRole("button", { name: "发布", exact: true }).click();
  const reasonDialog = page.getByRole("dialog", { name: "填写发布原因" });
  await reasonDialog.getByRole("textbox", { name: "原因（至少 2 个字）" }).fill("发布维护通知");
  await reasonDialog.getByRole("button", { name: "确认提交" }).click();
  await expect
    .poll(() => actionBody)
    .toMatchObject({
      action: "publish",
      expected_version: 1,
      reason: "发布维护通知",
    });
  await expect(page.getByText("发布完成：覆盖 3 人，站内 3 条，邮件队列 0 条。")).toBeVisible();
  await expect(page.getByText("已发布", { exact: true })).toBeVisible();
});

test("mail management entry stays closed while provider is pending", async ({ page }) => {
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      json: envelope({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_super_admin"],
        platform_capabilities: ["platform:operate"],
        guard_reason: "navigation_platform_admin_allowed",
      }),
    }),
  );
  await page.goto("/platform-admin/email");
  await expect(page.getByRole("heading", { name: "没有找到这个页面" })).toBeVisible();
  await expect(page.getByRole("link", { name: "邮箱管理" })).toHaveCount(0);
});
