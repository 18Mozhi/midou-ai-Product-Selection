import { expect, test } from "@playwright/test";

const messageId = "00000000-0000-4000-8000-000000000801";
const envelope = (data: unknown) => ({
  data,
  request_id: "platform-message-e2e",
  trace_id: "platform-message-e2e",
});

test("platform administrator can create and publish a Chinese notification", async ({
  page,
}) => {
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
  await page.route(
    `**/api/v1/platform/management/messages/${messageId}/actions`,
    async (route) => {
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
    },
  );

  await page.goto("/platform-admin/notifications");
  await page.getByRole("button", { name: "发布通知" }).click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "平台通知" }) });
  await expect(
    dialog.getByRole("checkbox", { name: "邮件（服务未接入）" }),
  ).toBeDisabled();
  await dialog.getByLabel("标题").fill("系统维护提醒");
  await dialog
    .getByLabel("正文")
    .fill("今晚十点进行系统维护，请提前保存工作。");
  await dialog.getByRole("button", { name: "保存草稿" }).click();
  await expect.poll(() => createBody?.title).toBe("系统维护提醒");
  await expect(
    page.getByRole("heading", { name: "系统维护提醒" }),
  ).toBeVisible();

  page.once("dialog", (prompt) => prompt.accept("发布维护通知"));
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect
    .poll(() => actionBody)
    .toMatchObject({ action: "publish", expected_version: 1 });
  await expect(
    page.getByText("发布完成：覆盖 3 人，站内 3 条，邮件队列 0 条。"),
  ).toBeVisible();
  await expect(page.getByText("已发布", { exact: true })).toBeVisible();
});

test("mail management entry stays closed while provider is pending", async ({
  page,
}) => {
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
  await expect(page.getByRole("heading", { name: "页面不存在" })).toBeVisible();
  await expect(page.getByRole("link", { name: "邮箱管理" })).toHaveCount(0);
});
