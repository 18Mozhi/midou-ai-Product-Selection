import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const org = "00000000-0000-4000-8000-000000000551",
  ws = "00000000-0000-4000-8000-000000000552",
  ruleId = "00000000-0000-4000-8000-000000000553",
  user = "00000000-0000-4000-8000-000000000554",
  envelope = (data: any) => ({
    data,
    request_id: "m05-05-e2e",
    trace_id: "m05-05-e2e",
  }),
  rule = {
    id: ruleId,
    name: "审批超时人工跟进",
    trigger_event_type: "approval.overdue",
    condition_severity: "warning",
    action_type: "notify_owner",
    owner_id: user,
    action_assignee_id: null,
    action_title: "审批超时，请人工处理",
    rate_limit_count: 5,
    rate_limit_window_minutes: 60,
    status: "active",
    version: 1,
    created_at: "2026-08-08T12:00:00.000Z",
    updated_at: "2026-08-08T12:00:00.000Z",
  };
async function setup(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: envelope({
        shell: "member",
        organization_id: org,
        workspace_id: ws,
        roles: ["selection_manager"],
        capabilities: ["task:read", "notification:read", "team:manage"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/automations", (r) =>
    r.fulfill({ json: envelope([rule]) }),
  );
  await page.route(`**/api/v1/automations/${ruleId}`, (r) =>
    r.fulfill({
      json: envelope({
        ...rule,
        executions: [
          {
            id: "00000000-0000-4000-8000-000000000555",
            rule_version: 1,
            notification_id: "00000000-0000-4000-8000-000000000556",
            status: "succeeded",
            attempt_count: 1,
            action_resource_type: "notification",
            action_resource_id: "00000000-0000-4000-8000-000000000557",
            last_error_code: null,
            created_at: "2026-08-08T12:01:00.000Z",
            updated_at: "2026-08-08T12:01:01.000Z",
          },
        ],
      }),
    }),
  );
}
test("M05-05.A07/A08/A15 desktop rules and execution drawer", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/automations");
  await expect(page.getByRole("heading", { name: "自动化规则", level: 2 })).toBeVisible();
  await expect(page.getByText("审批超时人工跟进")).toBeVisible();
  await expect(page).toHaveScreenshot("m05-05-automation-rules-desktop.png", {
    fullPage: true,
  });
  await page.getByRole("button", { name: "执行记录" }).click();
  await expect(page.getByText("AUTOMATION HISTORY")).toBeVisible();
  await expect(page.getByText("规则 v1 · 尝试 1 次")).toBeVisible();
});
test("M05-05.A07/A08/A15 mobile create rule layout", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/automations");
  await page.getByRole("button", { name: "创建规则" }).click();
  await expect(
    page.getByRole("heading", { name: "创建自动化规则" }),
  ).toBeVisible();
  await expect(page.getByText("规则只消费真实通知投影")).toBeVisible();
  await expect(page).toHaveScreenshot(
    "m05-05-automation-rules-mobile-390.png",
    { fullPage: true },
  );
});
