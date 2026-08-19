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
    root_cause_key: "approval.overdue:approval_request:00000000-0000-4000-8000-000000000932",
    workflow_status: "open",
    action_route:
      "/tasks/approvals?approval=00000000-0000-4000-8000-000000000932",
    group_count: 3,
    read_at: "2026-08-08T10:01:00.000Z",
    version: 1,
    created_at: "2026-08-08T10:00:00.000Z",
  };
async function setup(page: Page) {
  const listRequests: string[] = [];
  let workflowStatus = item.workflow_status,
    version = item.version;
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
        unread: 0,
        task: 1,
        approval: 2,
        competitor: 0,
        system: 0,
        open: workflowStatus === "open" ? 3 : 0,
        in_progress: workflowStatus === "in_progress" ? 3 : 0,
        closed: workflowStatus === "closed" ? 3 : 0,
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
    r.fulfill({ json: env({ ...item, workflow_status: workflowStatus, version }) }),
  );
  await page.route("**/api/v1/notifications?*", (r) =>
    {
      listRequests.push(r.request().url());
      return r.fulfill({
      json: { ...env([item]), meta: { page: 1, page_size: 100, total: 1 } },
      });
    },
  );
  await page.route(`**/api/v1/notifications/${id}/actions`, async (r) => {
    expect(r.request().headers()["idempotency-key"]).toBeTruthy();
    expect(r.request().headers()["x-request-id"]).toBeTruthy();
    expect(r.request().headers()["x-trace-id"]).toBeTruthy();
    const body = r.request().postDataJSON();
    workflowStatus =
      body.action === "start"
        ? "in_progress"
        : body.action === "close"
          ? "closed"
          : body.action === "reopen"
            ? "open"
            : workflowStatus;
    version += 1;
    await r.fulfill({
      json: env({
        id,
        read_at: item.read_at,
        workflow_status: workflowStatus,
        version,
      }),
    });
  });
  return { listRequests };
}
test("M05-03.A07/A08/A09/A15 renders recipient notification inbox and detail on desktop and 390", async ({
  page,
}) => {
  const { listRequests } = await setup(page);
  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", { name: "通知中心", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("审批状态更新")).toBeVisible();
  await expect(page.getByText("同根因 3 条")).toBeVisible();
  await page.getByRole("button", { name: /审批状态更新/ }).click();
  await expect(page.getByText(/站内消息来自事务消息/)).toBeVisible();
  await expect(page.getByText("同一根因的 3 条通知已自动合并展示。")).toBeVisible();
  await expect(page.getByText("需关注", { exact: true })).toBeVisible();
  await expect(
    page.locator(".notification-detail article"),
  ).toHaveText("审批状态已变化，请查看关联记录。");
  await expect(page.getByText("approval.overdue", { exact: false })).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: "定位异常记录" }),
  ).toHaveAttribute("href", item.action_route);
  await expect(page.getByText(item.resource_id, { exact: true })).not.toBeVisible();
  await expect(page).toHaveScreenshot("m05-03-notifications.png", {
    fullPage: true,
  });
  await page.getByRole("button", { name: "开始处理" }).click();
  await expect(page.getByText("通知已进入处理中。")).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByText("通知已关闭。")).toBeVisible();
  await page.getByRole("button", { name: "关闭消息详情" }).click();
  await page.getByRole("button", { name: "处理中", exact: true }).click();
  await expect
    .poll(() => listRequests.some((url) => url.includes("workflow_status=in_progress")))
    .toBe(true);
});
