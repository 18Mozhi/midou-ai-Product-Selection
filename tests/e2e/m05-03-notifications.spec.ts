import { test, expect, type Page } from "@playwright/test";
const id = "00000000-0000-4000-8000-000000000931",
  env = (data: unknown) => ({
    data,
    request_id: "m05-03-e2e",
    trace_id: "m05-03-trace",
  }),
  item = {
    id,
    category: "approval",
    severity: "warning",
    title: "审批状态更新",
    body: "approval.overdue 已产生新的可审计事件。",
    resource_type: "approval_request",
    resource_id: "00000000-0000-4000-8000-000000000932",
    read_at: null,
    version: 1,
    created_at: "2026-08-08T10:00:00.000Z",
  };
async function setup(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: env({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000933",
        workspace_id: "00000000-0000-4000-8000-000000000934",
        roles: ["selection_manager"],
        capabilities: ["notification:read"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/notifications/summary", (r) =>
    r.fulfill({
      json: env({
        total: 3,
        unread: 1,
        task: 1,
        approval: 2,
        competitor: 0,
        system: 0,
      }),
    }),
  );
  await page.route("**/api/v1/me/notification-preferences", (r) =>
    r.fulfill({
      json: env({
        in_app_enabled: true,
        email_enabled: false,
        task_enabled: true,
        approval_enabled: true,
        competitor_enabled: true,
        version: 1,
      }),
    }),
  );
  await page.route(`**/api/v1/notifications/${id}`, (r) =>
    r.fulfill({ json: env(item) }),
  );
  await page.route("**/api/v1/notifications?*", (r) =>
    r.fulfill({
      json: { ...env([item]), meta: { page: 1, page_size: 100, total: 1 } },
    }),
  );
}
test("M05-03.A07/A08/A09/A15 renders recipient notification inbox and detail on desktop and 390", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", { name: "通知中心", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("审批状态更新")).toBeVisible();
  await page.getByRole("button", { name: /审批状态更新/ }).click();
  await expect(page.getByText(/站内消息来自事务消息/)).toBeVisible();
  await expect(page).toHaveScreenshot("m05-03-notifications.png", {
    fullPage: true,
  });
});
